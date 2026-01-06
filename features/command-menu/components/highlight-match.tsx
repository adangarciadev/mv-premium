/**
 * HighlightMatch Component
 * Highlights matching text in search results
 */

import { normalizeString } from '../utils'

interface HighlightMatchProps {
	text: string
	query: string
}

/**
 * Component to highlight matching text portions in search results
 */
export function HighlightMatch({ text, query }: HighlightMatchProps) {
	if (!query || !text) return <>{text}</>

	const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))

	return (
		<>
			{parts.map((part, i) =>
				normalizeString(part) === normalizeString(query) ? (
					<span key={i} className="text-primary font-bold">
						{part}
					</span>
				) : (
					<span key={i}>{part}</span>
				)
			)}
		</>
	)
}
