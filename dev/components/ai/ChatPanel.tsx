'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ModelSelector } from './ModelSelector';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string, model: string) => void;
  isLoading: boolean;
  streamingContent?: string;
  defaultModel?: string;
}

export function ChatPanel({
  messages,
  onSendMessage,
  isLoading,
  streamingContent,
  defaultModel = 'gpt-4o-mini',
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [model, setModel] = useState(defaultModel);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onSendMessage(input.trim(), model);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
          <div className="w-48">
            <ModelSelector value={model} onChange={setModel} disabled={isLoading} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Start a conversation with the AI assistant.</p>
              <p className="text-sm mt-1">
                Describe what you want to build and the AI will help you code it.
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'assistant' ? '' : 'flex-row-reverse'}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback>
                    {message.role === 'assistant' ? 'AI' : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                    message.role === 'assistant'
                      ? 'bg-muted'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {message.content}
                  </pre>
                </div>
              </div>
            ))
          )}

          {/* Streaming response */}
          {streamingContent && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-3 py-2 max-w-[80%] bg-muted">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {streamingContent}
                  <span className="animate-pulse">▊</span>
                </pre>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex-shrink-0">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build..."
              className="min-h-[80px] resize-none"
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? 'Generating...' : 'Send'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
