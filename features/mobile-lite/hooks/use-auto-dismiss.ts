import { useEffect } from 'react'

/**
 * Auto-dismisses a transient success message after `delay`ms. The countdown
 * re-arms whenever the message changes; errors are never passed here because
 * they persist until the next action. `setMessage` must be a stable setState
 * setter so the effect only re-runs when the message itself changes.
 */
export function useAutoDismiss(message: string | null, setMessage: (value: null) => void, delay = 3500) {
	useEffect(() => {
		if (!message) return

		const timeout = window.setTimeout(() => setMessage(null), delay)
		return () => window.clearTimeout(timeout)
	}, [message, setMessage, delay])
}
