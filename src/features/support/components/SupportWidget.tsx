'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { MessageCircle, X, Send, Loader2, Paperclip, FileText } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useSupportChat } from '@/features/support/lib/useSupportChat';
import { readerView } from '@/features/support/lib/translationView';
import { formatReopen } from '@/features/support/lib/reopenTime';
import type { SupportAttachmentView, SupportMessageView } from '@/features/support/types';
import { QUICK_QUESTIONS, ALWAYS_A_PERSON, type SuggestionId } from '@/features/support/lib/suggestions';
import { attachmentHref, reportSuggestion } from '@/features/support/api/support.api';

/**
 * The customer's Support Chat.
 *
 * Offered only to someone signed in — ADR-0032: a chat is answered inside the app, so one
 * started by a visitor with no account is one an Agent answers into a void. There is no
 * assistant here and no "talk to a human" button: ADR-0031 settled that support is answered
 * by people, so a new chat is already waiting for one.
 */
export function SupportWidget() {
    const t = useTranslations('support');
    const {
        available, conversation, messages, translating, unread, panelOpen,
        availability, sending, failed, open, close, send,
        staged, attaching, canAttach, attach, unstage,
    } = useSupportChat();

    if (!available) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
            {panelOpen && (
                <SupportPanel
                    reference={conversation?.reference ?? null}
                    messages={messages}
                    translating={translating}
                    availability={availability}
                    sending={sending}
                    failed={failed}
                    staged={staged}
                    attaching={attaching}
                    canAttach={canAttach}
                    onAttach={attach}
                    onUnstage={unstage}
                    onClose={close}
                    onSend={send}
                />
            )}

            <button
                type="button"
                onClick={panelOpen ? close : open}
                aria-label={panelOpen ? t('close') : t('open')}
                className="relative grid h-14 w-14 place-items-center rounded-full bg-slate-900 text-white
                           shadow-lg transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2
                           focus-visible:outline-offset-2 focus-visible:outline-slate-900
                           dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
                {panelOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
                {!panelOpen && unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full
                                     bg-rose-600 px-1 text-xs font-semibold text-white">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
        </div>
    );
}

function SupportPanel({
    reference, messages, translating, availability, sending, failed,
    staged, attaching, canAttach, onAttach, onUnstage, onClose, onSend,
}: {
    reference:    string | null;
    messages:     SupportMessageView[];
    translating:  boolean;
    availability: ReturnType<typeof useSupportChat>['availability'];
    sending:      boolean;
    failed:       boolean;
    staged:       SupportAttachmentView[];
    attaching:    boolean;
    canAttach:    boolean;
    onAttach:     (file: File) => void;
    onUnstage:    (id: string) => void;
    onClose:      () => void;
    onSend:       (body: string) => void;
}) {
    const t      = useTranslations('support');
    const locale = useLocale();
    const [draft, setDraft] = useState('');
    const [answer, setAnswer] = useState<SuggestionId | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    /**
     * A tapped question (ADR-0044).
     *
     * The answer is *shown*, never stored: a transcript is what the customer and the Agent said
     * to each other, and every row in it has to have an author. The inbox learns what was shown
     * from the suggestion events instead.
     *
     * The topics only a person handles — a double charge, fraud, a chargeback — are never
     * answered automatically. Those go straight to the queue.
     */
    const pick = (id: SuggestionId) => {
        if (ALWAYS_A_PERSON.includes(id)) {
            reportSuggestion(id, 'sent_anyway', locale);
            onSend(t(`quick.${id}`));
            return;
        }
        reportSuggestion(id, 'opened', locale);
        setAnswer(id);
    };

    // Ends it with no chat in the queue, which is the whole point of answering it here.
    const solved = () => {
        if (answer) reportSuggestion(answer, 'solved', locale);
        setAnswer(null);
    };

    // Sends the question as the customer's own words, starting an ordinary chat.
    const askAPerson = (id: SuggestionId) => {
        reportSuggestion(id, 'sent_anyway', locale);
        setAnswer(null);
        onSend(t(`quick.${id}`));
    };

    // Follow the conversation as it grows, including when a held reply finally appears.
    // `scrollIntoView?.` because it is absent outside a real browser, and a transcript that
    // cannot scroll itself is not a reason for the panel to fail to render.
    useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length, translating]);

    const reopen = availability && !availability.humanAvailable
        ? formatReopen(availability.nextOpening, locale)
        : null;

    return (
        <section
            aria-label={t('title')}
            className="flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl
                       border border-slate-200 bg-white shadow-2xl
                       dark:border-slate-700 dark:bg-slate-900"
        >
            <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3
                               dark:border-slate-700">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('title')}</h2>
                    {reference && (
                        // The Chat Reference: what a customer quotes when they write in about
                        // the chat itself, so it is on screen rather than only in an email.
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t('reference', { reference })}</p>
                    )}
                </div>
                <button type="button" onClick={onClose} aria-label={t('close')}
                    className="rounded p-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200">
                    <X className="h-4 w-4" />
                </button>
            </header>

            {reopen && (
                // Said before they write, not after: someone messaging at 2am should know when
                // an answer is coming rather than watching an empty chat.
                <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900
                              dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    {reopen.today ? t('reopensToday', { when: reopen.when }) : t('reopens', { when: reopen.when })}
                </p>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.length === 0 && !answer && (
                    <QuickQuestions onPick={pick} />
                )}
                {answer && <AutomatedAnswer id={answer} onSolved={solved} onPerson={() => askAPerson(answer)} />}
                {messages.map(message => <Bubble key={message.id} message={message} />)}
                {translating && (
                    <p className="text-center text-xs text-slate-400">{t('translating')}</p>
                )}
                <div ref={endRef} />
            </div>

            {failed && (
                <p role="alert" className="px-4 pb-1 text-xs text-rose-600 dark:text-rose-400">{t('sendFailed')}</p>
            )}

            {staged.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 px-3 pb-1">
                    {staged.map(file => (
                        <li key={file.id}
                            className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs
                                       text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            <FileText className="h-3 w-3 shrink-0" />
                            <span className="max-w-[10rem] truncate">{file.fileName}</span>
                            <button type="button" onClick={() => onUnstage(file.id)} aria-label={t('removeFile')}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                                <X className="h-3 w-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <form
                className="flex items-end gap-2 border-t border-slate-200 p-3 dark:border-slate-700"
                onSubmit={e => { e.preventDefault(); onSend(draft); setDraft(''); }}
            >
                <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        // Enter sends, Shift+Enter starts a line — a chat, not a form.
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            onSend(draft);
                            setDraft('');
                        }
                    }}
                    rows={1}
                    maxLength={4000}
                    placeholder={t('placeholder')}
                    aria-label={t('placeholder')}
                    className="max-h-24 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm
                               text-slate-900 outline-none focus:border-slate-400
                               dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {canAttach && (
                    <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg
                                      text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800">
                        {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                        <span className="sr-only">{t('attach')}</span>
                        <input
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf"
                            onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) onAttach(file);
                                // Cleared so the same file can be chosen twice running.
                                e.target.value = '';
                            }}
                        />
                    </label>
                )}
                <button
                    type="submit"
                    disabled={sending || draft.trim().length === 0}
                    aria-label={t('send')}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-white
                               transition hover:bg-slate-700 disabled:opacity-40
                               dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
            </form>
        </section>
    );
}

/**
 * One message.
 *
 * Which text to show is not this component's decision — `readerView` makes it for both the
 * widget and the Agent's inbox, so the two cannot drift apart. The author's own words stay one
 * click away on anything translated: a stored translation can be wrong, and ADR-0033 keeps the
 * original authoritative wherever they disagree.
 */
/**
 * The common questions, tappable, in the customer's language.
 *
 * Offered before anything is typed. A customer who wants one known answer should not have to
 * compose a question, wait in a queue, and out of hours wait until the morning for it.
 */
function QuickQuestions({ onPick }: { onPick: (id: SuggestionId) => void }) {
    const t = useTranslations('support');
    return (
        <div className="space-y-2 pt-4">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">{t('empty')}</p>
            <ul className="space-y-1.5">
                {QUICK_QUESTIONS.map(id => (
                    <li key={id}>
                        <button
                            type="button"
                            onClick={() => onPick(id)}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm
                                       text-slate-700 transition hover:border-slate-400 hover:bg-slate-50
                                       dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                            {t(`quick.${id}`)}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/**
 * A Help Centre answer, shown in the conversation area.
 *
 * Labelled automated and attributed to the Help Centre, never to an Agent: nothing here is
 * generated — the tap chose which stored paragraph a person had already written — but the
 * customer is still entitled to know they are not being answered by someone.
 */
function AutomatedAnswer({ id, onSolved, onPerson }: {
    id: SuggestionId; onSolved: () => void; onPerson: () => void;
}) {
    const t = useTranslations('support');
    const help = useTranslations('help.sections');

    return (
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{t('automated')}</p>
            <h3 className="mb-1 font-medium text-slate-900 dark:text-white">{help(`${id}.title`)}</h3>
            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{help(`${id}.body`)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={onSolved}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white dark:bg-white dark:text-slate-900">
                    {t('thatAnsweredIt')}
                </button>
                <button type="button" onClick={onPerson}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:text-slate-200">
                    {t('talkToAPerson')}
                </button>
            </div>
        </article>
    );
}

/**
 * One file on a message.
 *
 * A link to a route in the API, never to a bucket (ADR-0040). Following it re-checks that this
 * reader may have it and redirects to a URL that is worthless five minutes later, so there is
 * nothing here that keeps working after it should stop.
 */
function Attachment({ file }: { file: SupportAttachmentView }) {
    const t = useTranslations('support');

    if (file.bytesDeleted) {
        // The row stays so the transcript still says a file was sent; only the bytes are gone.
        return (
            <li className="flex items-center gap-1.5 text-xs opacity-70">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate line-through">{file.fileName}</span>
                <span>· {t('fileExpired')}</span>
            </li>
        );
    }

    return (
        <li>
            <a href={attachmentHref(file.id)} target="_blank" rel="noreferrer"
               className="flex items-center gap-1.5 text-xs underline underline-offset-2">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.fileName}</span>
            </a>
        </li>
    );
}

function Bubble({ message }: { message: SupportMessageView }) {
    const t = useTranslations('support');
    const [showOriginal, setShowOriginal] = useState(false);
    const view  = readerView(message, false);
    const mine  = message.senderType === 'guest';
    const notice = message.senderType === 'system';

    if (notice) {
        return (
            <p className="text-center text-xs italic text-slate-400">{view.primary}</p>
        );
    }

    return (
        <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
            <div className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words',
                mine
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
                message.pending && 'opacity-60',
            )}>
                {showOriginal && view.original ? view.original : view.primary}

                {(message.attachments ?? []).length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                        {message.attachments!.map(file => <Attachment key={file.id} file={file} />)}
                    </ul>
                )}

                {view.label && (
                    <span className={cn('mt-1 block text-[11px]', mine ? 'text-slate-300 dark:text-slate-500' : 'text-slate-500 dark:text-slate-400')}>
                        {view.label === 'translated' && view.original ? (
                            <button type="button" onClick={() => setShowOriginal(v => !v)} className="underline underline-offset-2">
                                {showOriginal ? t('showTranslation') : t('showOriginal')}
                            </button>
                        ) : (
                            t(view.label === 'pending' ? 'translating' : 'notTranslated')
                        )}
                    </span>
                )}
            </div>
        </div>
    );
}
