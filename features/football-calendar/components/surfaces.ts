/**
 * Surface classes for the football calendar.
 *
 * Tailwind opacity modifiers (`bg-primary/10`, `border-border/50`) generate no
 * CSS in this project: `tailwind.config.js` maps colours to a bare
 * `var(--token)` with no `<alpha-value>` placeholder, so the utility is dropped
 * silently and the element renders with no background at all. Every tint here
 * is mixed explicitly instead, and the `color:` hint is what makes Tailwind
 * emit the arbitrary value.
 */
export const SURFACE = {
	/** One fixture, lifted off the card so the match reads as a single unit. */
	fixture:
		'bg-[color:color-mix(in_srgb,var(--foreground)7%,var(--card))] hover:bg-[color:color-mix(in_srgb,var(--foreground)12%,var(--card))]',
	/** A fixture involving a favourite team. */
	favorite:
		'bg-[color:color-mix(in_srgb,var(--primary)16%,var(--card))] hover:bg-[color:color-mix(in_srgb,var(--primary)22%,var(--card))]',
	/** Inset panel for the empty, error, and setup states. */
	panel: 'bg-[color:color-mix(in_srgb,var(--foreground)6%,var(--card))]',
	/** Inset panel carrying a failure. */
	panelDanger: 'bg-[color:color-mix(in_srgb,var(--destructive)14%,var(--card))]',
	/**
	 * The chip of a played match. Solid and inverted, the same device the live
	 * chip uses: a filled chip means something happened, a hollow one is still
	 * waiting. A subtle tint did not read as "this is over".
	 */
	result: 'bg-foreground',
	/** An active toggle in the header. */
	toggleOn: 'bg-[color:color-mix(in_srgb,var(--primary)18%,var(--card))]',
} as const
