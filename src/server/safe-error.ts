export function safeError(err: unknown, logContext?: string): string {
    const full = err instanceof Error ? err.message : String(err);
    if (logContext) console.error(`[${logContext}]`, err);
    if (process.env.NODE_ENV === 'production') return 'An unexpected error occurred. Please try again.';
    return full;
}
