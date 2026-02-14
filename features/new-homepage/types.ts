/** Common fields shared by all homepage items */
export interface HomepageItemBase {
	url: string
	forumSlug: string
	title: string
}

/** A thread from the spy or user-posts table */
export interface HomepageThread extends HomepageItemBase {
	hasLive?: boolean
	urlSinceLastVisit?: string | null
	responsesSinceLastVisit?: number
	lastActivityAt?: string
	/** Abbreviated string like "1.2k" or "350" */
	totalResponses?: string
}

/** A favorite thread */
export interface HomepageFavorite extends HomepageItemBase {
	urlSinceLastVisit?: string | null
	responsesSinceLastVisit?: number
}

/** A news card from the homepage */
export interface HomepageNewsItem extends HomepageItemBase {
	thumbnail?: string
	createdAt?: string
	/** Abbreviated string like "1.2k" or "350" */
	totalResponses?: string
	author?: string
}
