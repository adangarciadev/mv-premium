export const STYLE_ID = 'mvp-thread-preview-styles'
export const BUTTON_ATTR = 'data-mvp-thread-preview'
export const BUTTON_CLASS = 'mvp-thread-preview-btn'
export const ACTION_GROUP_CLASS = 'mvp-thread-preview-action-group'
export const ROW_ATTR = 'data-mvp-thread-preview-row'
export const ROW_CLASS = 'mvp-thread-preview-row'
export const CONTENT_CLASS = 'mvp-thread-preview-content'
export const BODY_CLASS = 'mvp-thread-preview-body'
export const BODY_CLAMPED_CLASS = 'mvp-thread-preview-body-clamped'
export const BODY_TRUNCABLE_CLASS = 'mvp-thread-preview-body-truncable'
export const EXPAND_CLASS = 'mvp-thread-preview-expand'
export const LOADING_CLASS = 'mvp-thread-preview-loading'
export const SHARE_CLASS = 'mvp-thread-preview-share'
export const SHARE_OPEN_ATTR = 'data-mvp-thread-preview-share-open'
export const LIKE_SUMMARY_CLASS = 'mvp-thread-preview-like-summary'
export const YOUTUBE_WIRED_ATTR = 'data-mvp-thread-preview-youtube-wired'
export const MAX_PREVIEW_HEIGHT = 760
export const MAX_MEDIA_AWARE_PREVIEW_HEIGHT = 1120
export const MEDIA_CLAMP_PADDING = 32
export const TWITTER_PREVIEW_PROVISIONAL_HEIGHT = 640
export const STREAMABLE_PREVIEW_HEIGHT = 460
export const TRUNCATION_TOLERANCE = 28
export const MIN_EXPANDABLE_OVERFLOW = 140
export const STREAMABLE_CONTAINER_SELECTOR = '[data-s9e-mediaembed="streamable"], .embed.streamable'
export const REINITIALIZABLE_EMBED_SELECTOR = [
	'[data-s9e-mediaembed="twitter"]',
	'[data-s9e-mediaembed="reddit"]',
	'[data-s9e-mediaembed="instagram"]',
	'[data-s9e-mediaembed="tiktok"]',
	'[data-s9e-mediaembed="facebook"]',
	'[data-s9e-mediaembed="bluesky"]',
].join(',')
export const MEDIA_CLAMP_SELECTOR = [
	'[data-s9e-mediaembed]',
	'[data-s9e-mediaembed="streamable"]',
	'iframe',
	'blockquote.twitter-tweet',
	'.twitter-tweet',
	'.embed',
	'img',
	'video',
	'table',
].join(',')
export const THREAD_ROWS_SELECTOR = 'tbody#temas tr'
export const THREAD_TITLE_SELECTOR = '.thread a.h[href*="/foro/"], .thread a.hb[href*="/foro/"]'
