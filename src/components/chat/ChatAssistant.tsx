'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatAssistantProps {
  availableMonths: string[]; // e.g., ["2025-11", "2025-10"]
  defaultScope?: 'month' | 'year' | 'all-time';
  defaultScopeValue?: string;
}

export default function ChatAssistant({
  availableMonths,
  defaultScope = 'all-time',
  defaultScopeValue,
}: ChatAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [scope, setScope] = useState<'month' | 'year' | 'all-time'>(defaultScope);
  const [scopeValue, setScopeValue] = useState<string>(defaultScopeValue || '');
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract years from available months
  const availableYears = Array.from(
    new Set(availableMonths.map((m) => m.split('-')[0]))
  ).sort().reverse();

  // Auto-set scope value based on scope type
  useEffect(() => {
    if (scope === 'month' && availableMonths.length > 0 && !scopeValue) {
      setScopeValue(availableMonths[0]); // Most recent month
    } else if (scope === 'year' && availableYears.length > 0 && !scopeValue) {
      setScopeValue(availableYears[0]); // Most recent year
    } else if (scope === 'all-time') {
      setScopeValue('');
    }
  }, [scope, availableMonths, availableYears, scopeValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Determine period string for API
      let period: string | undefined;
      if (scope === 'month') {
        period = scopeValue; // "2025-10"
      } else if (scope === 'year') {
        period = scopeValue; // "2025"
      } else {
        period = undefined; // all-time
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, period }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Chat request failed');
      }

      // Stream the response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          assistantMessage += chunk;

          // Update the last message (assistant's response)
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              role: 'assistant',
              content: assistantMessage,
            };
            return newMessages;
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getScopeLabel = () => {
    if (scope === 'all-time') return 'All Time';
    if (scope === 'month') return formatMonth(scopeValue);
    if (scope === 'year') return scopeValue;
    return '';
  };

  const formatMonth = (monthKey: string) => {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header with expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900">Ask About Your Commissions</h3>
            <p className="text-sm text-gray-500">
              Scope: <span className="font-medium text-gray-700">{getScopeLabel()}</span>
            </p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chat Interface */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Scope Selector */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex flex-wrap gap-3 items-center">
              <label className="text-sm font-medium text-gray-700">Scope:</label>

              {/* Scope Type Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setScope('month')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scope === 'month'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setScope('year')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scope === 'year'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Year
                </button>
                <button
                  onClick={() => setScope('all-time')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    scope === 'all-time'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Time
                </button>
              </div>

              {/* Month/Year Selector */}
              {scope === 'month' && (
                <select
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month)}
                    </option>
                  ))}
                </select>
              )}

              {scope === 'year' && (
                <select
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="h-96 overflow-y-auto px-6 py-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">👋 Hi Betsy!</p>
                <p className="text-sm">Ask me anything about your commission data.</p>
                <p className="text-xs mt-3 text-gray-400">
                  Examples: "How much did I sell to XYZ company?" • "What's my best factory this month?" • "Show me October's top customers"
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-gray-200 px-6 py-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
