const USER_PROFILE_ACTIVITY_PATH_PATTERN = /^\/id\/[^/]+\/(?:posts|me-gusta|marcadores|menciones)(?:\/\d+)?\/?$/

const PROFILE_ACTIVITY_THREAD_LINK_SELECTOR = '.post-meta h1 a[href*="/foro/"], .read-more a[href*="/foro/"]'

export function isUserProfileActivityPath(pathname: string): boolean {
	return USER_PROFILE_ACTIVITY_PATH_PATTERN.test(pathname)
}

export function getProfileActivityThreadLink(container: ParentNode): HTMLAnchorElement | null {
	return container.querySelector<HTMLAnchorElement>(PROFILE_ACTIVITY_THREAD_LINK_SELECTOR)
}
