/**
 * Arena IDE: Monaco editor, xterm terminal, chat, cost, constraints.
 * Lazy-loaded; mounts DOM-dependent editor and terminal inside a div.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/theme';
import { spacing } from '@/theme/tokens';

function formatCost(cents: number): string {
  const d = cents / 10000;
  return d < 0.01 ? `$${d.toFixed(4)}` : `$${d.toFixed(2)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface ArenaChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  starterCode: string | null;
  testCases: string;
  maxTokens: number | null;
  maxCost: number | null;
  wallClockLimit: number | null;
  expiresAt?: string | null;
}

export interface ArenaAttempt {
  id: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  status: string;
  expiresAt: string | null;
}

interface ArenaIDEProps {
  challenge: ArenaChallenge;
  attempt: ArenaAttempt;
  userCredits: number;
  code: string;
  onCodeChange: (code: string) => void;
  language: string;
  onRunTests: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number; results?: unknown[] }>;
  onSubmit: (sourceCode: string, language: string) => Promise<{ passed: boolean; passedTests: number; totalTests: number }>;
  onAttemptUpdate?: (attempt: ArenaAttempt) => void;
  runResult?: { passed: boolean; passedTests: number; totalTests: number } | null;
}

export function ArenaIDE({
  challenge,
  attempt,
  userCredits,
  code,
  onCodeChange,
  language,
  onRunTests: _onRunTests,
  onSubmit: _onSubmit,
  onAttemptUpdate,
  runResult,
}: ArenaIDEProps) {
  void _onRunTests;
  void _onSubmit;
  const c = useColors();
  const [totalCost, setTotalCost] = useState(attempt.totalCost);
  const [inputTokens, setInputTokens] = useState(attempt.inputTokens);
  const [outputTokens, setOutputTokens] = useState(attempt.outputTokens);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [model] = useState('@cf/meta/llama-3.1-8b-instruct');
  const [editorReady, setEditorReady] = useState(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const editorRootRef = useRef<{ unmount: () => void } | null>(null);
  const terminalInstanceRef = useRef<{ dispose: () => void } | null>(null);

  const attemptId = attempt.id;
  const expiresAt = attempt.expiresAt ? new Date(attempt.expiresAt) : null;
  const [timeLeft, setTimeLeft] = useState<number | null>(expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isLoadingChat || !attemptId) return;
    setChatInput('');
    const userMsg = { role: 'user' as const, content: text };
    setMessages((m) => [...m, userMsg]);
    setIsLoadingChat(true);
    setStreamingContent('');

    const chatMessages = [...messages, userMsg].map((msg) => ({ role: msg.role, content: msg.content }));
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: chatMessages,
          attemptId,
          maxTokens: 2048,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages((m) => [...m, { role: 'assistant', content: `Error: ${err.error || res.statusText}` }]);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6)) as { type: string; content?: string; inputTokens?: number; outputTokens?: number; cost?: number; violation?: string; message?: string };
            if (data.type === 'chunk' && data.content) {
              assistantContent += data.content;
              setStreamingContent(assistantContent);
            } else if (data.type === 'done') {
              setTotalCost((prev) => prev + (data.cost ?? 0));
              setInputTokens((prev) => prev + (data.inputTokens ?? 0));
              setOutputTokens((prev) => prev + (data.outputTokens ?? 0));
              if (onAttemptUpdate) {
                onAttemptUpdate({
                  ...attempt,
                  totalCost: attempt.totalCost + (data.cost ?? 0),
                  inputTokens: attempt.inputTokens + (data.inputTokens ?? 0),
                  outputTokens: attempt.outputTokens + (data.outputTokens ?? 0),
                });
              }
            } else if (data.type === 'error') {
              assistantContent += `\n[Error: ${data.message}]`;
            } else if (data.type === 'constraint_warning') {
              assistantContent += `\n[Constraint: ${data.message}]`;
            }
          } catch (_) {}
        }
      }
      setMessages((m) => [...m, { role: 'assistant', content: assistantContent || '(no response)' }]);
      setStreamingContent('');
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Request failed: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setIsLoadingChat(false);
    }
  }, [chatInput, isLoadingChat, attemptId, model, messages, attempt, onAttemptUpdate]);

  useEffect(() => {
    const mountId = 'arena-monaco-mount';
    const el = document.getElementById(mountId);
    if (!el) return;
    let unmount: (() => void) | undefined;
    Promise.all([import('@monaco-editor/react'), import('react-dom/client')]).then(([{ default: Editor }, { createRoot }]) => {
      const root = document.createElement('div');
      root.style.height = '100%';
      root.style.minHeight = '300px';
      el.appendChild(root);
      const client = createRoot(root);
      client.render(
        React.createElement(Editor, {
          height: '100%',
          language,
          value: code,
          onChange: (v: string | undefined) => v != null && onCodeChange(v),
          theme: 'vs-dark',
          options: { minimap: { enabled: false }, fontSize: 14 },
        })
      );
      setEditorReady(true);
      editorRootRef.current = { unmount: () => { client.unmount(); root.remove(); } };
      unmount = () => { editorRootRef.current?.unmount(); };
    });
    return () => { unmount?.(); };
  }, []);

  useEffect(() => {
    const mountId = 'arena-terminal-mount';
    const el = document.getElementById(mountId);
    if (!el) return;
    let cleanup: (() => void) | undefined;
    Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]).then(([XTerm, AddonFit]) => {
      const Terminal = XTerm.Terminal;
      const FitAddonClass = (AddonFit as { FitAddon: new () => unknown }).FitAddon;
      const fitAddon = new FitAddonClass();
      const terminal = new Terminal({
        theme: { background: '#0a0a0a', foreground: '#fff' },
        fontFamily: 'Menlo, monospace',
        fontSize: 13,
      });
      terminal.loadAddon(fitAddon as never);
      terminal.open(el);
      (fitAddon as { fit: () => void }).fit();
      terminal.writeln('\x1b[1;32mRuwt Terminal\x1b[0m');
      terminal.write('$ ');
      setTerminalReady(true);
      terminalInstanceRef.current = terminal;
      const onResize = () => (fitAddon as { fit: () => void }).fit();
      window.addEventListener('resize', onResize);
      cleanup = () => {
        window.removeEventListener('resize', onResize);
        terminal.dispose();
        terminalInstanceRef.current = null;
      };
    });
    return () => { cleanup?.(); };
  }, []);

  const constraints = [];
  if (challenge.maxTokens != null) {
    constraints.push({
      type: 'tokens' as const,
      current: inputTokens + outputTokens,
      max: challenge.maxTokens,
      label: 'Tokens',
    });
  }
  if (challenge.maxCost != null) {
    constraints.push({
      type: 'cost' as const,
      current: totalCost,
      max: challenge.maxCost,
      label: 'Cost',
    });
  }
  if (challenge.wallClockLimit != null && timeLeft != null) {
    constraints.push({
      type: 'time' as const,
      current: challenge.wallClockLimit - timeLeft,
      max: challenge.wallClockLimit,
      label: 'Time',
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={[styles.main, { borderColor: c.border }]}>
        <View style={styles.editorRow}>
          <View style={styles.editorWrap}>
            <View nativeID="arena-monaco-mount" style={{ flex: 1, minHeight: 300 }} />
            {!editorReady && (
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: c.muted + '40' }]}>
                <Text style={{ color: c.textMuted }}>Loading editor...</Text>
              </View>
            )}
          </View>
          <View style={[styles.terminalWrap, { backgroundColor: '#0a0a0a', borderColor: c.border }]}>
            <View nativeID="arena-terminal-mount" style={{ flex: 1 }} />
            {!terminalReady && (
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={[styles.terminalPlaceholder, { color: c.textMuted }]}>Terminal</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.panel, { borderLeftColor: c.border, backgroundColor: c.bg }]}>
          <ScrollView style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
            <Text style={[styles.panelTitle, { color: c.text }]}>Chat</Text>
            {messages.map((msg, i) => (
              <View key={i} style={[styles.bubble, msg.role === 'user' ? { alignSelf: 'flex-end', backgroundColor: c.accent + '30' } : { alignSelf: 'flex-start', backgroundColor: c.muted + '40' }]}>
                <Text style={[styles.bubbleText, { color: c.text }]}>{msg.content}</Text>
              </View>
            ))}
            {streamingContent ? (
              <View style={[styles.bubble, { alignSelf: 'flex-start', backgroundColor: c.muted + '40' }]}>
                <Text style={[styles.bubbleText, { color: c.text }]}>{streamingContent}</Text>
              </View>
            ) : null}
            <View style={[styles.chatInputRow, { borderColor: c.border }]}>
              <TextInput
                style={[styles.chatInput, { color: c.text, borderColor: c.border }]}
                placeholder="Message AI..."
                placeholderTextColor={c.textMuted}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={sendMessage}
                editable={!isLoadingChat}
              />
              <Button size="sm" onPress={sendMessage} disabled={!chatInput.trim() || isLoadingChat}>
                Send
              </Button>
            </View>
          </ScrollView>
          <View style={[styles.costSection, { borderTopColor: c.border }]}>
            <Text style={[styles.panelTitle, { color: c.text }]}>Cost</Text>
            <Text style={[styles.costLine, { color: c.text }]}>{formatCost(totalCost)} session</Text>
            <Text style={[styles.costLine, { color: c.textMuted }]}>{inputTokens + outputTokens} tokens · {userCredits} credits left</Text>
          </View>
          {constraints.length > 0 && (
            <View style={[styles.constraintSection, { borderTopColor: c.border }]}>
              <Text style={[styles.panelTitle, { color: c.text }]}>Constraints</Text>
              {constraints.map((con, i) => (
                <View key={i} style={styles.constraintRow}>
                  <Text style={[styles.constraintLabel, { color: c.textMuted }]}>{con.label}</Text>
                  <Text style={[styles.constraintVal, { color: c.text }]}>
                    {con.type === 'cost' ? `${formatCost(con.current)} / ${formatCost(con.max)}` : con.type === 'time' ? `${formatTime(con.current)} / ${formatTime(con.max)}` : `${con.current} / ${con.max}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
      {runResult && (
        <View style={[styles.resultBar, runResult.passed ? { backgroundColor: c.success + '30' } : { backgroundColor: c.destructive + '30' }]}>
          <Text style={[styles.resultText, { color: c.text }]}>
            {runResult.passed ? 'All tests passed!' : 'Some tests failed.'} ({runResult.passedTests}/{runResult.totalTests})
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  main: { flex: 1, flexDirection: 'row', borderTopWidth: 1 },
  editorRow: { flex: 1, flexDirection: 'column', minWidth: 0 },
  editorWrap: { flex: 1, minHeight: 280 },
  editorPlaceholder: { position: 'absolute', top: spacing.md, left: spacing.md },
  terminalWrap: { height: 200, borderTopWidth: 1, padding: spacing.sm },
  terminalPlaceholder: { fontSize: 12 },
  panel: { width: 320, borderLeftWidth: 1 },
  chatScroll: { flex: 1 },
  chatContent: { padding: spacing.md, paddingBottom: spacing.xl },
  panelTitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing.sm },
  bubble: { padding: spacing.sm, borderRadius: 8, maxWidth: '90%', marginBottom: spacing.xs },
  bubbleText: { fontSize: 13 },
  chatInputRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderTopWidth: 1 },
  chatInput: { flex: 1, borderWidth: 1, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 14 },
  costSection: { padding: spacing.md, borderTopWidth: 1 },
  costLine: { fontSize: 12, marginBottom: 2 },
  constraintSection: { padding: spacing.md, borderTopWidth: 1 },
  constraintRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  constraintLabel: { fontSize: 12 },
  constraintVal: { fontSize: 12 },
  resultBar: { padding: spacing.sm, paddingHorizontal: spacing.md },
  resultText: { fontSize: 14, fontWeight: '600' },
});
