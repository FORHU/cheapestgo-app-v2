/**
 * The app's page shell: one gutter, one cap, for every screen that lays content
 * out in a column.
 *
 * Split out of the search page when the property page needed the same measure.
 * Before that the search page owned them privately and the property page had a
 * column of its own — a hard 760px, then a percentage — so the two screens sat
 * their content on different lines and a hotel moved sideways on the way from
 * the results to its own page.
 *
 * Applied outer-then-inner, in that order, so the cap lands *inside* the
 * padding rather than around it:
 *
 *     <div className={SHELL_GUTTER}>
 *         <div className={SHELL_CAP}> … </div>
 *     </div>
 *
 * Wrapped the other way the gutter is counted outside the cap, and past 1400px
 * the two boxes part company — which is exactly how the search page's toolbar
 * and its results grid once came to disagree.
 *
 * The gutter steps 20 → 32 → 48. The cap only binds past ~1500px, so between a
 * phone and a large laptop the gutter *is* the margin, and at the 16/24 it used
 * to be the content ran almost to the window edge on exactly the widths most
 * people are on.
 */
export const SHELL_GUTTER = 'px-5 sm:px-8 lg:px-12';
export const SHELL_CAP    = 'max-w-350 mx-auto';

/**
 * A page section's title — `AVAILABLE ROOMS`, `NEARBY PLACES`.
 *
 * Set large, heavy and upper-case, which is what makes the sections read as the
 * page's own structure rather than as labels on the cards beneath them. Held
 * here because it is shared across a page and the components it composes, and
 * two copies of a type scale are two copies that drift.
 *
 * The casing is a `text-transform`, not the copy: the words are written
 * normally in the markup so a screen reader says "Available Rooms" rather than
 * spelling out initials.
 */
export const SECTION_HEADING =
    'text-[24px] font-bold tracking-[-0.01em] capitalize sm:text-[29px]';
