import { VALID_SUBFORUM_SLUGS } from '@/lib/subforums'

function toPathname(urlOrPath: string): string {
	try {
		return new URL(urlOrPath, window.location.origin).pathname
	} catch {
		return urlOrPath.split('?')[0]?.split('#')[0] || ''
	}
}

export function extractSubforumSlugFromUrl(urlOrPath: string): string | null {
	const pathname = toPathname(urlOrPath)
	const match = pathname.match(/^\/foro\/([^/?#]+)/i)
	if (!match) return null

	const slug = match[1]?.toLowerCase()
	return slug && VALID_SUBFORUM_SLUGS.has(slug) ? slug : null
}

export function isSubforumUrlHidden(urlOrPath: string, hiddenSlugs: ReadonlySet<string>): boolean {
	const slug = extractSubforumSlugFromUrl(urlOrPath)
	return slug ? hiddenSlugs.has(slug) : false
}

export interface HiddenSubforumMatch {
	slug: string
	pathname: string
	isSubforumRoot: boolean
}

export function getHiddenSubforumMatch(
	urlOrPath: string,
	hiddenSlugs: ReadonlySet<string>
): HiddenSubforumMatch | null {
	const pathname = toPathname(urlOrPath)
	const slug = extractSubforumSlugFromUrl(pathname)

	if (!slug || !hiddenSlugs.has(slug)) {
		return null
	}

	return {
		slug,
		pathname,
		isSubforumRoot: new RegExp(`^/foro/${slug}/?$`).test(pathname),
	}
}
