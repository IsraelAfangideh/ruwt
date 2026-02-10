'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { FileTree, buildFileTree, type FileNode } from '@/components/editor/FileTree';
import { ChatPanel } from '@/components/ai/ChatPanel';
import { CostTracker } from '@/components/ai/CostTracker';
import { ConstraintDisplay } from '@/components/ai/ConstraintDisplay';
import {
  getWebContainer,
  mountFiles,
  writeFile,
  readFile,
  createStarterFiles,
  spawn,
} from '@/lib/sandbox/webcontainer';

// Dynamic imports for components that use browser APIs
const CodeEditor = dynamic(
  () => import('@/components/editor/CodeEditor').then((mod) => mod.CodeEditor),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full">Loading editor...</div> }
);

const Terminal = dynamic(
  () => import('@/components/editor/Terminal').then((mod) => mod.Terminal),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-full">Loading terminal...</div> }
);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  starterCode?: string;
  maxTokens?: number;
  maxCost?: number;
  wallClockLimit?: number;
  testCode?: string;
}

export default function ArenaPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params.challengeId as string;
  const terminalRef = useRef<HTMLDivElement>(null);

  // Challenge state
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>('index.js');
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [containerReady, setContainerReady] = useState(false);

  // AI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Cost tracking
  const [totalCost, setTotalCost] = useState(0);
  const [inputTokens, setInputTokens] = useState(0);
  const [outputTokens, setOutputTokens] = useState(0);
  const [callCount, setCallCount] = useState(0);
  const [userCredits] = useState(10000); // TODO: Fetch from API

  // Attempt state
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  // Load challenge data
  useEffect(() => {
    async function loadChallenge() {
      try {
        // TODO: Fetch from API
        // For now, use a placeholder challenge
        setChallenge({
          id: challengeId,
          title: 'Sample Challenge',
          description: 'Write a function that adds two numbers.',
          difficulty: 'easy',
          starterCode: '// Write your solution here\n\nfunction add(a, b) {\n  // TODO: Implement\n}\n\nmodule.exports = { add };\n',
          testCode: `
const { add } = require('./index.js');

try {
  console.log('Running tests...');
  
  if (add(1, 2) !== 3) {
    throw new Error('Test failed: add(1, 2) should equal 3');
  }
  
  if (add(-1, 1) !== 0) {
    throw new Error('Test failed: add(-1, 1) should equal 0');
  }
  
  console.log('All tests passed!');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
`,
          maxTokens: 50000,
          maxCost: 1000, // $0.10
          wallClockLimit: 1800, // 30 minutes
        });
        setLoading(false);
      } catch (err) {
        setError('Failed to load challenge');
        setLoading(false);
      }
    }

    loadChallenge();
  }, [challengeId]);

  // Initialize WebContainer
  useEffect(() => {
    if (!challenge) return;

    const currentChallenge = challenge;

    async function initContainer() {
      try {
        const container = await getWebContainer();
        const starterFiles = createStarterFiles(currentChallenge.starterCode);
        await mountFiles(starterFiles);

        // Build file tree
        const filePaths = ['package.json', 'index.js', 'test.js'];
        setFiles(buildFileTree(filePaths));

        // Load initial file contents
        const contents: Record<string, string> = {};
        for (const path of filePaths) {
          contents[path] = await readFile(path);
        }
        setFileContents(contents);
        setContainerReady(true);

        // Set expiration if challenge has time limit
        if (currentChallenge.wallClockLimit) {
          const expiry = new Date();
          expiry.setSeconds(expiry.getSeconds() + currentChallenge.wallClockLimit);
          setExpiresAt(expiry);
        }
      } catch (err) {
        console.error('Failed to initialize container:', err);
        setError('Failed to initialize coding environment');
      }
    }

    initContainer();
  }, [challenge]);

  // Handle file selection
  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedFile(path);
    if (!fileContents[path]) {
      try {
        const content = await readFile(path);
        setFileContents((prev) => ({ ...prev, [path]: content }));
      } catch {
        // File might not exist yet
      }
    }
  }, [fileContents]);

  // Handle code changes
  const handleCodeChange = useCallback(async (content: string) => {
    if (!selectedFile) return;
    
    setFileContents((prev) => ({ ...prev, [selectedFile]: content }));
    
    // Debounced write to container
    try {
      await writeFile(selectedFile, content);
    } catch (err) {
      console.error('Failed to write file:', err);
    }
  }, [selectedFile]);

  // Handle AI message
  const handleSendMessage = useCallback(async (message: string, model: string) => {
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are a coding assistant helping solve a challenge. The challenge is: ${challenge?.description}\n\nProvide clear, concise code solutions.`,
            },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: message },
          ],
          attemptId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk') {
            fullContent += data.content;
            setStreamingContent(fullContent);
          } else if (data.type === 'done') {
            setTotalCost((prev) => prev + data.cost);
            setInputTokens((prev) => prev + data.inputTokens);
            setOutputTokens((prev) => prev + data.outputTokens);
            setCallCount((prev) => prev + 1);
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }]);
    } catch (err) {
      console.error('AI error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  }, [challenge, messages, attemptId]);

  // Handle running tests
  const handleRunTests = async () => {
    if (!selectedFile || !fileContents[selectedFile]) return;
    
    const terminalInstance = (terminalRef.current as HTMLDivElement & {
      terminalInstance?: { 
        write: (data: string) => void; 
        writeln: (data: string) => void;
        clear: () => void;
      };
    })?.terminalInstance;

    try {
      if (terminalInstance) {
        terminalInstance.clear();
        terminalInstance.writeln('Running tests...');
      }

      // Write current code
      await writeFile('index.js', fileContents['index.js']);
      
      // Write test code
      if (challenge?.testCode) {
        await writeFile('test.js', challenge.testCode);
      }

      // Execute tests
      const { exit, output } = await spawn('node', ['test.js']);

      // Stream output to terminal
      const reader = output.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        terminalInstance?.write(value || '');
      }

      const exitCode = await exit;
      if (exitCode === 0) {
        terminalInstance?.writeln('\nTests passed successfully! 🎉');
      } else {
        terminalInstance?.writeln('\nTests failed. Keep trying! 💪');
      }
    } catch (err) {
      console.error('Test execution failed:', err);
      terminalInstance?.writeln(`\nError: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSubmitSolution = async () => {
    // For now, just run tests and show success
    await handleRunTests();
    // TODO: Implement actual submission logic
  };

  // Handle terminal input
  const handleTerminalInput = useCallback(async (data: string) => {
    // Echo input and handle commands
    if (data === '\r') {
      // Enter pressed - execute command
      const terminalInstance = (terminalRef.current as HTMLDivElement & {
        terminalInstance?: { write: (data: string) => void; writeln: (data: string) => void };
      })?.terminalInstance;
      
      terminalInstance?.writeln('');
      terminalInstance?.write('$ ');
    }
  }, []);

  // Build constraints array for display
  const constraints = [];
  if (challenge?.maxTokens) {
    constraints.push({
      type: 'tokens' as const,
      current: inputTokens + outputTokens,
      max: challenge.maxTokens,
      label: 'Tokens',
    });
  }
  if (challenge?.maxCost) {
    constraints.push({
      type: 'cost' as const,
      current: totalCost,
      max: challenge.maxCost,
      label: 'Cost',
    });
  }
  if (challenge?.wallClockLimit && expiresAt) {
    constraints.push({
      type: 'time' as const,
      current: 0,
      max: challenge.wallClockLimit,
      label: 'Time',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Challenge not found'}</p>
          <Button onClick={() => router.push('/challenges')}>Back to Challenges</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/challenges')}>
            ← Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div>
            <h1 className="font-semibold">{challenge.title}</h1>
            <Badge variant="outline" className="text-xs">
              {challenge.difficulty}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRunTests}>
            Run Tests
          </Button>
          <Button size="sm" onClick={handleSubmitSolution}>Submit Solution</Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left sidebar - File tree & Chat */}
        <div className="w-80 border-r flex flex-col">
          <Tabs defaultValue="chat" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
              <TabsTrigger value="files" className="flex-1">Files</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
              <ChatPanel
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isStreaming}
                streamingContent={streamingContent}
              />
            </TabsContent>
            <TabsContent value="files" className="flex-1 m-0 overflow-hidden">
              <FileTree
                files={files}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Center - Code editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            {containerReady ? (
              <CodeEditor
                value={selectedFile ? fileContents[selectedFile] || '' : ''}
                onChange={handleCodeChange}
                language={selectedFile?.endsWith('.json') ? 'json' : 'javascript'}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Initializing environment...
              </div>
            )}
          </div>
          <div className="h-48 border-t">
            <div ref={terminalRef} className="h-full">
              <Terminal onInput={handleTerminalInput} />
            </div>
          </div>
        </div>

        {/* Right sidebar - Cost tracking & Constraints */}
        <div className="w-72 border-l p-4 space-y-4 overflow-y-auto">
          <CostTracker
            totalCost={totalCost}
            inputTokens={inputTokens}
            outputTokens={outputTokens}
            callCount={callCount}
            userCredits={userCredits}
          />
          {constraints.length > 0 && (
            <ConstraintDisplay constraints={constraints} expiresAt={expiresAt} />
          )}
          <Card className="p-4">
            <h3 className="font-medium mb-2">Challenge</h3>
            <p className="text-sm text-muted-foreground">{challenge.description}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
