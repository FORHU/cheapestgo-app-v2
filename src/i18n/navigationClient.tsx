'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';
import { leavesPage, startNavigation } from './navigationProgress';

/**
 * next-intl's Link and useRouter, reporting each move to another page as it is asked for, so the
 * bar across the top shows from the tap rather than from whenever the next page arrives (see
 * ./navigationProgress). Everything else about them is next-intl's.
 *
 * A file of their own because they must run in the browser: Link takes over the click, and a
 * server component cannot hand a click handler down. Server components still render this Link —
 * as a client component, which is all next-intl's own Link is once it reaches the browser — and
 * ./navigation re-exports both, so no call site changes its import.
 */

const { Link: BaseLink, useRouter: useBaseRouter, getPathname } = createNavigation(routing);

type LinkProps = React.ComponentProps<typeof BaseLink>;

/** A click the browser would follow in this tab: the main button, no modifier, not a new tab or a download. */
function followedHere(event: React.MouseEvent<HTMLAnchorElement>): boolean {
    const anchor = event.currentTarget;
    return !event.defaultPrevented
        && event.button === 0
        && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        && (!anchor.target || anchor.target === '_self')
        && !anchor.hasAttribute('download');
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({ onClick, ...props }, ref) {
    return (
        <BaseLink
            ref={ref}
            {...props}
            onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
                onClick?.(event);
                // The anchor's href is the one the browser would go to, prefix and all.
                if (followedHere(event) && leavesPage(event.currentTarget.href)) startNavigation();
            }}
        />
    );
});

type Router = ReturnType<typeof useBaseRouter>;

export function useRouter(): Router {
    const router = useBaseRouter();
    const locale = useLocale();

    return React.useMemo(() => {
        const reporting = (go: Router['push']): Router['push'] => (href, options) => {
            // A language switch is a page of its own in the URL, and has its cross-fade instead.
            const sameLanguage = !options?.locale || options.locale === locale;
            if (sameLanguage && leavesPage(getPathname({ href, locale }))) startNavigation();
            go(href, options);
        };
        return { ...router, push: reporting(router.push), replace: reporting(router.replace) };
    }, [router, locale]);
}
