export interface HomepageThread {
	url: string
	forumSlug: string
	title: string
	thumbnail?: string
	hasLive?: boolean
	urlSinceLastVisit?: string | null
	responsesSinceLastVisit?: number
	lastActivityAt?: string
	createdAt?: string
	totalResponses?: string
}
