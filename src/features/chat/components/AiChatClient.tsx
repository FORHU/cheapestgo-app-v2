'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Send, Sparkles, Loader2, Plus, Globe, PanelLeftClose, PanelLeft, Home, MessageSquare } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { http } from '@/shared/lib/http';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: number;
}

const STORAGE_KEY = 'cheap_conversations';
const MAX_STORED = 50;

const LANGUAGES = [
    { code: 'en',  label: 'English' },
    { code: 'tl',  label: 'Tagalog' },
    { code: 'ceb', label: 'Cebuano' },
    { code: 'ilo', label: 'Ilocano' },
    { code: 'es',  label: 'Spanish' },
    { code: 'ja',  label: 'Japanese' },
    { code: 'ko',  label: 'Korean' },
    { code: 'zh',  label: 'Chinese' },
] as const;

const SUGGESTIONS = [
    'Find me cheap flights to Tokyo next month',
    'What hotels are available in Bali for 2 adults?',
    'Plan a 5-day trip to Paris on a budget',
    "What's the cheapest day to fly to NYC?",
];

function newConversationId() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadConversations(): Conversation[] {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
        return [];
    }
}

function saveConversations(convos: Conversation[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_STORED)));
    } catch {}
}

function groupByDate(convos: Conversation[]) {
    const now = Date.now();
    const day = 86400000;
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const older: Conversation[] = [];

    for (const c of convos) {
        const diff = now - c.createdAt;
        if (diff < day) today.push(c);
        else if (diff < 2 * day) yesterday.push(c);
        else older.push(c);
    }
    return { today, yesterday, older };
}

export function AiChatClient() {
    const searchParams = useSearchParams();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [lang, setLang] = useState('en');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [langOpen, setLangOpen] = useState(false);
    const [conversationId, setConversationId] = useState(newConversationId);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const autoSentRef = useRef(false);

    // Load conversations from localStorage on mount
    useEffect(() => {
        setConversations(loadConversations());
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Persist current conversation whenever messages change
    useEffect(() => {
        if (messages.length === 0) return;
        const title = messages.find(m => m.role === 'user')?.content.slice(0, 60) ?? 'New chat';
        setConversations(prev => {
            const existing = prev.findIndex(c => c.id === conversationId);
            const updated: Conversation = { id: conversationId, title, messages, createdAt: existing >= 0 ? prev[existing].createdAt : Date.now() };
            const next = existing >= 0
                ? prev.map(c => c.id === conversationId ? updated : c)
                : [updated, ...prev];
            saveConversations(next);
            return next;
        });
    }, [messages, conversationId]);

    useEffect(() => {
        if (autoSentRef.current) return;
        const q = searchParams.get('q');
        if (q) {
            autoSentRef.current = true;
            send(q);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const send = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
        setInput('');
        setLoading(true);

        try {
            const data = await http.post<{ response: string }>('/chat', {
                message: trimmed,
                conversationId,
                lang,
            });
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: "Sorry, I couldn't reach the AI service. Please try again." },
            ]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [loading, conversationId, lang]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(input);
        }
    };

    const newChat = () => {
        setMessages([]);
        setInput('');
        setConversationId(newConversationId());
        inputRef.current?.focus();
    };

    const loadConversation = (convo: Conversation) => {
        setMessages(convo.messages);
        setConversationId(convo.id);
        setInput('');
    };

    const empty = messages.length === 0;
    const currentLang = LANGUAGES.find(l => l.code === lang)!;
    const { today, yesterday, older } = groupByDate(conversations);

    const ConvoGroup = ({ label, items }: { label: string; items: Conversation[] }) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-3">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
                {items.map(c => (
                    <button
                        key={c.id}
                        onClick={() => loadConversation(c)}
                        className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs text-left transition-colors truncate',
                            c.id === conversationId
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                    >
                        <MessageSquare size={12} className="shrink-0 opacity-50" />
                        <span className="truncate">{c.title}</span>
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-dvh overflow-hidden">
            {/* Sidebar */}
            <aside
                className={cn(
                    'flex flex-col shrink-0 border-r border-slate-200 dark:border-white/5 bg-white/70 dark:bg-black/40 backdrop-blur-md transition-all duration-300 overflow-hidden',
                    sidebarOpen ? 'w-60' : 'w-0'
                )}
            >
                <div className="flex flex-col h-full p-3 min-w-60">
                    {/* Brand */}
                    <div className="flex items-center gap-2 px-2 py-3 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30">
                            <Sparkles size={13} className="text-white" />
                        </div>
                        <span className="font-bold text-sm text-slate-900 dark:text-white">CheapestGo AI</span>
                    </div>

                    {/* New chat */}
                    <button
                        onClick={newChat}
                        className="flex items-center gap-2 w-full px-3 h-9 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors mb-3"
                    >
                        <Plus size={15} />
                        New chat
                    </button>

                    {/* Conversation history */}
                    <div className="flex-1 overflow-y-auto">
                        <ConvoGroup label="Today" items={today} />
                        <ConvoGroup label="Yesterday" items={yesterday} />
                        <ConvoGroup label="Older" items={older} />
                    </div>

                    {/* Language */}
                    <div className="relative pt-2 border-t border-slate-100 dark:border-white/5">
                        <button
                            onClick={() => setLangOpen(v => !v)}
                            className="flex items-center gap-2 w-full px-3 h-9 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        >
                            <Globe size={14} className="shrink-0" />
                            {currentLang.label}
                        </button>

                        {langOpen && (
                            <div className="absolute bottom-10 left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-lg overflow-hidden z-20">
                                {LANGUAGES.map(l => (
                                    <button
                                        key={l.code}
                                        onClick={() => { setLang(l.code); setLangOpen(false); }}
                                        className={cn(
                                            'w-full text-left px-4 py-2 text-sm transition-colors',
                                            l.code === lang
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                        )}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <div className="flex items-center gap-3 px-4 h-12 shrink-0">
                    <button
                        onClick={() => setSidebarOpen(v => !v)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                    >
                        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                    </button>
                    {!sidebarOpen && (
                        <button
                            onClick={newChat}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-sm"
                        >
                            <Plus size={15} />
                            New chat
                        </button>
                    )}
                    <div className="flex-1" />
                    <Link
                        href="/"
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                        title="Go to home"
                    >
                        <Home size={18} />
                    </Link>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto">
                    {empty ? (
                        <div className="flex flex-col items-center justify-center h-full gap-8 px-4 text-center">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                                What's on the agenda today?
                            </h1>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
                                {SUGGESTIONS.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => send(s)}
                                        className="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm text-sm text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-all"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
                            {messages.map((msg, i) => (
                                <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-blue-600/20">
                                            <Sparkles size={12} className="text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={cn(
                                            'max-w-[82%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                                            msg.role === 'user'
                                                ? 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/15'
                                                : 'bg-white/70 dark:bg-white/5 backdrop-blur-sm text-slate-800 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-white/10'
                                        )}
                                    >
                                        {msg.content}
                                    </div>
                                </div>
                            ))}

                            {loading && (
                                <div className="flex gap-3 justify-start">
                                    <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-blue-600/20">
                                        <Sparkles size={12} className="text-white" />
                                    </div>
                                    <div className="bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm">
                                        <Loader2 size={15} className="text-slate-400 animate-spin" />
                                    </div>
                                </div>
                            )}

                            <div ref={bottomRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="px-4 pb-6 pt-2 max-w-2xl mx-auto w-full">
                    <div className="flex items-end gap-2 bg-white/70 dark:bg-white/5 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 shadow-sm focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything..."
                            rows={1}
                            className="flex-1 resize-none bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none max-h-40"
                            onInput={e => {
                                const t = e.currentTarget;
                                t.style.height = 'auto';
                                t.style.height = `${t.scrollHeight}px`;
                            }}
                        />
                        <button
                            onClick={() => send(input)}
                            disabled={!input.trim() || loading}
                            className="shrink-0 w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm shadow-blue-600/20"
                        >
                            <Send size={14} className="text-white" />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-slate-400 mt-2">Enter to send · Shift+Enter for new line</p>
                </div>
            </div>
        </div>
    );
}
