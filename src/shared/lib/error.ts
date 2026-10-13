/**
 * Narrowing for values caught by `catch`.
 *
 * Under `strict`, `catch` binds `unknown` — which is correct, because what gets
 * thrown is not always an `Error`: a library can throw a string, an aborted
 * fetch raises a DOMException, and a rejected promise carries whatever it was
 * rejected with. Annotating the binding `any` to get at `.message` gives that
 * up at every call site; these do the narrowing once instead.
 */

/** The message off a caught value, or `fallback` when it carries none. */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
    if (e instanceof Error && e.message) return e.message;
    if (typeof e === 'string' && e) return e;
    return fallback;
}

/**
 * True for what an `AbortController` raises.
 *
 * Callers skip these rather than report them: an aborted request is the caller
 * changing its mind — a new search, an unmounted component — not a failure the
 * user needs to hear about.
 */
export function isAbortError(e: unknown): boolean {
    return e instanceof Error && e.name === 'AbortError';
}
