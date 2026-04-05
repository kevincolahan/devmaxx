'use client';

import { useState, useRef, useEffect } from 'react';

interface CommandConsoleProps {
  creatorId: string;
  gameId?: string;
}

interface CommandMessage {
  role: 'user' | 'system' | 'confirmation' | 'result';
  content: string;
  parsed?: {
    action: string;
    parameters: Record<string, unknown>;
    confirmation: string;
    requiresConfirmation: boolean;
    estimatedImpact: string;
  };
  result?: {
    success: boolean;
    message: string;
  };
}

const SUGGESTED_COMMANDS = [
  'Run a weekend sale',
  'Raise my best-selling item price by 20%',
  'Why did DAU drop this week?',
  'Create a new game pass',
  'What should I focus on?',
  'Schedule a holiday event',
];

export function CommandConsole({ creatorId, gameId }: CommandConsoleProps) {
  const [messages, setMessages] = useState<CommandMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingParsed, setPendingParsed] = useState<CommandMessage['parsed'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(command?: string) {
    const cmd = command || input.trim();
    if (!cmd || isProcessing) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: cmd }]);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'parse', creatorId, gameId, command: cmd }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'system', content: data.error || 'Failed to parse command.' }]);
        setIsProcessing(false);
        return;
      }

      const parsed = data.parsed;

      // Analysis queries — just show the answer
      if (parsed.action === 'analysis') {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: parsed.confirmation || 'Analyzing your data...' },
          { role: 'system', content: parsed.estimatedImpact || 'Check the Ask Devmaxx tab for detailed analysis.' },
        ]);
        setIsProcessing(false);
        return;
      }

      // Unknown commands
      if (parsed.action === 'unknown') {
        const suggestions = (parsed.parameters.suggestions as string[]) || [];
        setMessages((prev) => [
          ...prev,
          {
            role: 'system',
            content: `${parsed.confirmation}${suggestions.length > 0 ? `\n\nTry:\n${suggestions.map((s) => `- ${s}`).join('\n')}` : ''}`,
          },
        ]);
        setIsProcessing(false);
        return;
      }

      // Actionable command — show confirmation
      if (parsed.requiresConfirmation) {
        setMessages((prev) => [
          ...prev,
          { role: 'confirmation', content: parsed.confirmation, parsed },
        ]);
        setPendingParsed(parsed);
      } else {
        // Auto-execute without confirmation
        await executeConfirmed(parsed);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${String(err)}` }]);
    } finally {
      setIsProcessing(false);
    }
  }

  async function executeConfirmed(parsed: CommandMessage['parsed']) {
    if (!parsed) return;
    setIsProcessing(true);
    setPendingParsed(null);

    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'execute', creatorId, gameId, parsed }),
      });

      const result = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'result',
          content: result.message,
          result: { success: result.success, message: result.message },
        },
      ]);

      if (result.details?.routeTo === 'insights') {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: 'Switch to the "Ask Devmaxx" tab for detailed analysis.' },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'system', content: `Execution failed: ${String(err)}` }]);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleCancel() {
    setPendingParsed(null);
    setMessages((prev) => [...prev, { role: 'system', content: 'Command cancelled.' }]);
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <h3 className="font-semibold text-white">Game Commands</h3>
        <p className="mt-1 text-xs text-gray-500">Tell Devmaxx what to do in plain English.</p>
      </div>

      {/* Messages */}
      <div className="h-[400px] overflow-y-auto px-6 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="mb-4 text-sm text-gray-500">Try a command:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => handleSubmit(cmd)}
                  className="rounded-full border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
            {msg.role === 'user' && (
              <div className="inline-block rounded-lg bg-brand-600/20 px-4 py-2 text-sm text-brand-300">
                {msg.content}
              </div>
            )}

            {msg.role === 'system' && (
              <div className="rounded-lg bg-gray-800/50 px-4 py-2 text-sm text-gray-300 whitespace-pre-wrap">
                {msg.content}
              </div>
            )}

            {msg.role === 'confirmation' && msg.parsed && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-sm text-gray-300">{msg.parsed.confirmation}</p>
                {msg.parsed.estimatedImpact && (
                  <p className="mt-2 text-xs text-gray-500">{msg.parsed.estimatedImpact}</p>
                )}
                {pendingParsed && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => executeConfirmed(msg.parsed)}
                      disabled={isProcessing}
                      className="rounded-md bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                    >
                      {isProcessing ? 'Executing...' : 'Confirm'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isProcessing}
                      className="rounded-md border border-gray-600 px-4 py-1.5 text-xs text-gray-400 hover:border-gray-500 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            {msg.role === 'result' && msg.result && (
              <div className={`rounded-lg px-4 py-2 text-sm ${msg.result.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {msg.result.message}
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-6 py-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Tell Devmaxx what to do..."
            disabled={isProcessing}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={isProcessing || !input.trim()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
