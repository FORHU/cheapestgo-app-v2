/**
 * The CheapestGo wordmark, drawn as live text rather than a static asset.
 *
 * Inline SVG (not `<img src>`) on purpose: the glyphs are `<text>`, so they only
 * resolve against Open Sans while they live in the document's font scope. An
 * external SVG renders in an isolated context and would fall back to the
 * system sans.
 */
export function LogoWordmark({ height = 24, className }: { height?: number; className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 131 44"
            width={(height * 131) / 44}
            height={height}
            fill="none"
            role="img"
            aria-label="CheapestGo"
            className={className}
        >
            <text x="0" y="30" fontFamily="var(--font-open-sans), 'Open Sans', sans-serif" fontSize="22">
                <tspan fontWeight="400" fill="#f1f5f9" letterSpacing="-0.3">cheapest</tspan>
                <tspan fontWeight="700" fill="#ffffff" letterSpacing="-0.5">Go</tspan>
            </text>
        </svg>
    );
}
