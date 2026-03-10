'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type ScopeType = 'all-time' | 'month' | 'year' | 'custom';

const EXAMPLE_QUESTIONS = [
  'What are my total commissions this month?',
  'Which factory had the highest sales?',
  'Who are my top 5 customers?',
  'Compare my factories by commission',
];

function buildPeriod(scope: ScopeType, monthVal: string, yearVal: string, start: string, end: string) {
  if (scope === 'month') return monthVal || undefined;
  if (scope === 'year') return yearVal || undefined;
  if (scope === 'custom' && start && end) return `${start}|${end}`;
  return undefined;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [tone, setTone] = useState<'casual' | 'professional'>('professional');
  const [scope, setScope] = useState<ScopeType>('all-time');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthValue, setMonthValue] = useState('');
  const [yearValue, setYearValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dashboard/monthly').then(r => r.json()).then(data => {
      const months: string[] = data.available_months || [];
      setAvailableMonths(months);
      if (months.length > 0) setMonthValue(months[0]);
    }).catch(() => {});
  }, []);

  const availableYears = Array.from(new Set(availableMonths.map(m => m.split('-')[0]))).sort().reverse();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function formatMonthOption(key: string) {
    const [year, month] = key.split('-');
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[parseInt(month) - 1]} ${year}`;
  }

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || streaming) return;
    setInput('');

    const period = buildPeriod(scope, monthValue, yearValue, startDate, endDate);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, period, tone }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => { const u = [...prev]; u[u.length-1] = {...u[u.length-1], content: `Error: ${err.error}`}; return u; });
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let acc = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages(prev => { const u = [...prev]; u[u.length-1] = {...u[u.length-1], content: acc}; return u; });
        }
      }
    } catch (err) {
      setMessages(prev => { const u = [...prev]; u[u.length-1] = {...u[u.length-1], content: `Error: ${err instanceof Error ? err.message : 'Connection failed'}`}; return u; });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 pb-12">

      {/* Header */}
      <div className="text-center pt-4">
        <h1 className="text-2xl font-semibold text-gray-900">Ask About Your Commissions</h1>
      </div>

      {/* Scope + Tone Panel */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <p className="text-center text-sm text-gray-400">
          Use this date filter to get answers about more specific data
        </p>

        {/* Tone selector */}
        <div className="flex justify-center gap-2">
          {(['casual', 'professional'] as const).map((t) => (
            <button key={t} onClick={() => setTone(t)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                tone === t ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t === 'casual' ? 'Casual' : 'Professional'}
            </button>
          ))}
        </div>

        {/* Scope buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          {(['all-time', 'month', 'year', 'custom'] as ScopeType[]).map((s) => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                scope === s ? 'bg-gray-900 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {s === 'all-time' ? 'All Time' : s === 'custom' ? 'Custom Range' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Month selector */}
        {scope === 'month' && availableMonths.length > 0 && (
          <div className="flex justify-center">
            <select value={monthValue} onChange={e => setMonthValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {availableMonths.map(m => <option key={m} value={m}>{formatMonthOption(m)}</option>)}
            </select>
          </div>
        )}

        {/* Year selector */}
        {scope === 'year' && availableYears.length > 0 && (
          <div className="flex justify-center">
            <select value={yearValue || availableYears[0]} onChange={e => setYearValue(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* Custom date range */}
        {scope === 'custom' && (
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
        )}

      </div>

      {/* Messages */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '420px' }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-5">Try asking something:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-gray-50 border border-gray-200 text-gray-800'
              }`}>
                {msg.content || (
                  <span className="flex gap-1">
                    {[0,150,300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${d}ms`}} />)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 p-4">
          <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)}
              placeholder="Ask about your commissions…" disabled={streaming}
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-50" />
            <button type="submit" disabled={streaming || !input.trim()}
              className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {streaming ? 'Thinking…' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
