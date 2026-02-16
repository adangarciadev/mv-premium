import { useEffect, useState } from 'react'

/**
 * Formats an absolute timestamp into a short relative time string.
 * - < 5 seconds  → "Ahora"
 * - < 60 seconds → "Xs"
 * - < 60 minutes → "Xm"
 * - < 24 hours   → "Xh"
 * - >= 24 hours  → "Xd"
 */
export function formatRelativeTime(timestamp: number): string {
	const diff = Math.max(0, Date.now() - timestamp)
	const seconds = Math.floor(diff / 1000)

	if (seconds < 5) return 'Ahora'
	if (seconds < 60) return `${seconds}s`

	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h`

	const days = Math.floor(hours / 24)
	return `${days}d`
}

/**
 * Hook that forces a re-render at a fixed interval so that
 * components using `formatRelativeTime` stay up-to-date.
 *
 * Returns a tick counter (not used directly — the re-render is the point).
 */
export function useRelativeTimeTick(intervalMs = 5_000): number {
	const [tick, setTick] = useState(0)

	useEffect(() => {
		const id = window.setInterval(() => {
			setTick(t => t + 1)
		}, intervalMs)

		return () => window.clearInterval(id)
	}, [intervalMs])

	return tick
}
