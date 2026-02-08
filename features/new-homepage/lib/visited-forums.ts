const STORAGE_KEY = 'mvp-latest-visited-forums'

export function getLatestVisitedForums(): string[] {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
	} catch {
		return []
	}
}

export function setLatestVisitedForum(forum: string): void {
	const existing = getLatestVisitedForums()
	const updated = [forum, ...existing.filter(f => f !== forum)]
	localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 20)))
}
