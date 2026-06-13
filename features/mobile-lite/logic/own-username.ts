/**
 * Resolves the logged-in user's username from the Mediavida mobile DOM
 * (`#usermenu`). Shared by the post gestures and the panel so both block
 * self-ignoring with the same detection.
 */

let cachedOwnUsername: string | undefined

/** Lowercased own username, or null when logged out / not detectable. */
export function getOwnUsername(): string | null {
	if (cachedOwnUsername !== undefined) return cachedOwnUsername

	const ownLink = document.querySelector<HTMLAnchorElement>('#usermenu a[href^="/id/"]')
	const match = ownLink?.getAttribute('href')?.match(/\/id\/([^/?#]+)/)
	if (!match?.[1]) return null

	cachedOwnUsername = safeDecodeUsername(match[1]).toLowerCase()
	return cachedOwnUsername
}

export function resetOwnUsernameCache(): void {
	cachedOwnUsername = undefined
}

function safeDecodeUsername(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}
