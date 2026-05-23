export const THREAD_CLIPPER_DRAFT_VERSION = 1

export type ThreadClipperTextFormat = 'quote' | 'plain'
export type ThreadClipperTemplate = 'news' | 'article' | 'video' | 'review' | 'deal' | 'rumor'
export type ThreadClipperPicker = 'media'

export interface ClipSourceMetadata {
	url: string
	canonicalUrl?: string
	domain: string
	siteName?: string
	title: string
	description?: string
	publishedAt?: string
}

export interface TextClipItem {
	type: 'text'
	value: string
	format?: ThreadClipperTextFormat
}

export interface MediaClipItem {
	type: 'media'
	value: string
	provider?: 'youtube' | 'twitter' | 'instagram' | 'unknown'
}

export interface LinkClipItem {
	type: 'link'
	value: string
	label: string
}

export type ThreadClipperBasketItem = TextClipItem | MediaClipItem | LinkClipItem

export interface ThreadClipperBasket {
	version: typeof THREAD_CLIPPER_DRAFT_VERSION
	sessionId: string
	tabId: number
	sourceUrl: string
	sourceTitle: string
	source?: ClipSourceMetadata
	title?: string
	subforum?: string
	contentMode?: 'article' | 'media-only'
	template?: ThreadClipperTemplate
	items: ThreadClipperBasketItem[]
	activePicker?: ThreadClipperPicker
	textFormat?: ThreadClipperTextFormat
	createdAt: number
	updatedAt: number
}

export interface ThreadClipperCreateSnapshot {
	title: string
	subforum?: string
	textFormat: ThreadClipperTextFormat
	items: ThreadClipperBasketItem[]
}

export interface ThreadClipperHistoryEntry {
	id: string
	title: string
	sourceUrl: string
	sourceTitle: string
	subforum: string
	template: ThreadClipperTemplate
	body: string
	createdAt: number
}

export interface CapturedPageClip {
	text: string
	mediaUrls: string[]
	source: ClipSourceMetadata
}
