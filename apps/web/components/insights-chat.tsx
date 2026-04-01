'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  followUps?: string[];
}

interface InsightsChatProps {
  hasGames: boolean;
  gameId?: string;
}

const SUGGESTED_QUESTIONS = [
  'Why did my DAU drop last week?',
  'Which of my items should I reprice?',
  'How does my retention compare to last month?',
  'What should I focus on this week?',
  "Why aren't players buying my game passes?",
];

export function InsightsChat({ hasGames, gameId }: InsightsChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  function stripFollowUps(text: string): string {
    return text.replace(/\n*---\n*follow_up:\s*\[[^\]]*\]/, '').trim();
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: 'user', content: text.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch('/api/insights/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          gameId,
          history: updatedMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err.error || 'Something went wrong'}` },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let followUps: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr) as {
              type: string;
              text?: string;
              followUps?: string[];
              error?: string;
            };

            if (data.type === 'text' && data.text) {
              fullText += data.text;
              setStreamingText(fullText);
            } else if (data.type === 'done') {
              followUps = data.followUps ?? [];
            } else if (data.type === 'error') {
              fullText += `\n\nError: ${data.error}`;
              setStreamingText(fullText);
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: stripFollowUps(fullText),
          followUps: followUps.length > 0 ? followUps : undefined,
        },
      ]);
      setStreamingText('');
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Connection error: ${String(err)}` },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleClear() {
    setMessages([]);
    setStreamingText('');
    inputRef.current?.focus();
  }

  // ─── Empty state: no games connected ───────────────────────

  if (!hasGames) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
            <svg className="h-8 w-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white">Connect your Roblox game to start asking questions about your business</h3>
          <p className="mb-6 max-w-md text-sm text-gray-400">
            Once connected, you can ask Devmaxx AI anything about your game's performance, revenue, players, and strategy.
          </p>
          <a
            href="/dashboard"
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition"
          >
            Connect Roblox
          </a>
        </div>
      </div>
    );
  }

  // ─── Chat interface ────────────────────────────────────────

  const showSuggestions = messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col rounded-xl border border-gray-800 bg-gray-900" style={{ height: 'calc(100vh - 320px)', minHeight: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20">
            <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-white">Ask Devmaxx</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-md px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {showSuggestions && (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="mb-6 text-center">
              <h3 className="text-lg font-semibold text-white">Ask anything about your game</h3>
              <p className="mt-1 text-sm text-gray-400">Get data-backed answers powered by your real metrics</p>
            </div>
            <div className="flex w-full max-w-lg flex-col gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-left text-sm text-gray-300 transition hover:border-gray-600 hover:bg-gray-800 hover:text-white"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
            {msg.role === 'user' ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-500 px-4 py-2.5 text-sm text-white sm:max-w-[70%]">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[85%] sm:max-w-[85%]">
                <div className="rounded-2xl rounded-bl-md bg-gray-800 px-4 py-3 text-sm text-gray-200">
                  <div
                    className="prose prose-sm prose-invert max-w-none [&>ul]:mt-2 [&>ul]:space-y-1 [&>ol]:mt-2 [&>ol]:space-y-1 [&>p]:mb-2 [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                  />
                </div>
                {msg.followUps && msg.followUps.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.followUps.map((fq, j) => (
                      <button
                        key={j}
                        onClick={() => sendMessage(fq)}
                        disabled={isStreaming}
                        className="rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-400 transition hover:border-brand-500/50 hover:text-brand-400 disabled:opacity-50"
                      >
                        {fq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming response */}
        {isStreaming && (
          <div className="mb-4 max-w-[85%] sm:max-w-[85%]">
            <div className="rounded-2xl rounded-bl-md bg-gray-800 px-4 py-3 text-sm text-gray-200">
              {streamingText ? (
                <div
                  className="prose prose-sm prose-invert max-w-none [&>ul]:mt-2 [&>ul]:space-y-1 [&>ol]:mt-2 [&>ol]:space-y-1 [&>p]:mb-2 [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingText) }}
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: '0ms' }} />
                  <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: '200ms' }} />
                  <div className="h-2 w-2 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: '400ms' }} />
                </div>
              )}
              {streamingText && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-brand-400 align-text-bottom" />
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-4 py-3 sm:px-6">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your game..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 transition focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-30 disabled:hover:bg-brand-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Markdown formatter ──────────────────────────────────────

function formatMarkdown(text: string): string {
  let html = text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Bullet lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Paragraphs — split by double newline
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('<ul>') || block.startsWith('<ol>')) return block;
      if (block.startsWith('<li>')) return `<ul>${block}</ul>`;
      return `<p>${block}</p>`;
    })
    .join('');

  // Single newlines within paragraphs become <br>
  html = html.replace(/(?<!<\/li>)\n(?!<)/g, '<br>');

  return html;
}
