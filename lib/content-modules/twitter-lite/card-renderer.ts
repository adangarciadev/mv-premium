import type { TwitterLiteCardData } from './types'
import { TWITTER_LITE_CSS, TWITTER_LITE_STYLE_ID } from './styles'

const TWITTER_LITE_THEME_LIGHT_CLASS = 'mvp-twitter-lite-theme-light'
const TWITTER_LITE_THEME_DARK_CLASS = 'mvp-twitter-lite-theme-dark'
const THEME_CONTEXT_SELECTORS = '.post, .rep, .post-contents, .post-body, .cuerpo'
const TWITTER_LITE_MIN_ICON_CONTRAST = 2.4
const TWITTER_LITE_MIN_TEXT_CONTRAST = 4.5

// Icons (Lucide)
const X_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`

const VERIFIED_SVG = `<svg viewBox="0 0 24 24" aria-label="Verified account" fill="currentColor" width="16" height="16"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></g></svg>`

const LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

// Metric icons (Twitter-style)
const REPLY_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/></svg>`

const RETWEET_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>`

const HEART_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/></svg>`

const QUOTE_ICON_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M4 4l16 0c1.1 0 2 .9 2 2l0 10c0 1.1-.9 2-2 2l-2 0 0 3-4-3-10 0c-1.1 0-2-.9-2-2L2 6c0-1.1.9-2 2-2z"/></svg>`

function isSafeImageUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'https:' || parsed.protocol === 'http:'
	} catch {
		return false
	}
}

function formatMetricCount(value: number): string {
    return value.toLocaleString('es-ES');
}

export function injectTwitterLiteStyles(): void {
	let style = document.getElementById(TWITTER_LITE_STYLE_ID) as HTMLStyleElement;
	if (!style) {
		style = document.createElement('style');
		style.id = TWITTER_LITE_STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = TWITTER_LITE_CSS;
}

export function syncTwitterLiteCardTheme(card: HTMLElement): void {
	const theme = detectTwitterLiteTheme(card)
	card.classList.remove(TWITTER_LITE_THEME_LIGHT_CLASS, TWITTER_LITE_THEME_DARK_CLASS)
	if (theme === 'light') card.classList.add(TWITTER_LITE_THEME_LIGHT_CLASS)
	if (theme === 'dark') card.classList.add(TWITTER_LITE_THEME_DARK_CLASS)
	applyTwitterLiteContrastOverrides(card)
}

type RgbaColor = { r: number; g: number; b: number; a: number }

function detectTwitterLiteTheme(card: HTMLElement): 'light' | 'dark' | null {
	const context = card.closest<HTMLElement>(THEME_CONTEXT_SELECTORS) ?? card.parentElement
	const bg = findFirstOpaqueBackground(context)
	if (bg) return getPerceivedLuminance(bg) < 0.5 ? 'dark' : 'light'

	const color = findFirstTextColor(context)
	if (color) return getPerceivedLuminance(color) > 0.6 ? 'dark' : 'light'

	return null
}

function findFirstOpaqueBackground(start: HTMLElement | null): RgbaColor | null {
	let el: HTMLElement | null = start
	while (el) {
		const parsed = parseCssColor(getComputedStyle(el).backgroundColor)
		if (parsed && parsed.a > 0.01) return parsed
		el = el.parentElement
	}

	const bodyColor = parseCssColor(getComputedStyle(document.body).backgroundColor)
	if (bodyColor && bodyColor.a > 0.01) return bodyColor
	return null
}

function findFirstTextColor(start: HTMLElement | null): RgbaColor | null {
	let el: HTMLElement | null = start
	while (el) {
		const parsed = parseCssColor(getComputedStyle(el).color)
		if (parsed) return parsed
		el = el.parentElement
	}
	return parseCssColor(getComputedStyle(document.body).color)
}

function parseCssColor(value: string): RgbaColor | null {
	const match = value.match(/rgba?\(([^)]+)\)/i)
	if (!match) return null

	const parts = match[1].split(',').map(part => part.trim())
	if (parts.length < 3) return null

	const r = Number.parseFloat(parts[0])
	const g = Number.parseFloat(parts[1])
	const b = Number.parseFloat(parts[2])
	const a = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1

	if ([r, g, b, a].some(n => Number.isNaN(n))) return null
	return { r, g, b, a }
}

function getPerceivedLuminance({ r, g, b }: Pick<RgbaColor, 'r' | 'g' | 'b'>): number {
	// Standard sRGB relative luminance approximation (0..1)
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function applyTwitterLiteContrastOverrides(card: HTMLElement): void {
	const background = parseCssColor(getComputedStyle(card).backgroundColor)
	if (!background || background.a <= 0.01) return

	const darkPrimary = hexToColor('#0f1419')
	const darkSecondary = hexToColor('#536471')
	const lightPrimary = hexToColor('#e7e9ea')
	const lightSecondary = hexToColor('#8b98a5')

	const darkPrimaryContrast = getContrastRatio(background, darkPrimary)
	const lightPrimaryContrast = getContrastRatio(background, lightPrimary)

	const useLightText = lightPrimaryContrast > darkPrimaryContrast
	const primary = useLightText ? lightPrimary : darkPrimary
	const secondary = useLightText ? lightSecondary : darkSecondary

	const ensuredPrimary = ensureContrast(primary, background, TWITTER_LITE_MIN_TEXT_CONTRAST)
	const ensuredSecondary = ensureContrast(secondary, background, 3.2)

	card.style.setProperty('--twl-text', formatRgb(ensuredPrimary))
	card.style.setProperty('--twl-text-secondary', formatRgb(ensuredSecondary))
	card.style.setProperty('--twl-metric-value-color', formatRgb(ensuredPrimary))

	const brandColors = {
		'--twl-metric-like-icon': '#f91880',
		'--twl-metric-retweet-icon': '#00ba7c',
		'--twl-metric-reply-icon': '#1d9bf0',
		'--twl-metric-quote-icon': '#1d9bf0',
	} as const

	for (const [cssVar, hex] of Object.entries(brandColors)) {
		const base = hexToColor(hex)
		const adjusted = ensureContrast(base, background, TWITTER_LITE_MIN_ICON_CONTRAST, ensuredPrimary)
		card.style.setProperty(cssVar, formatRgb(adjusted))
	}
}

function ensureContrast(
	foreground: Pick<RgbaColor, 'r' | 'g' | 'b'>,
	background: Pick<RgbaColor, 'r' | 'g' | 'b'>,
	minRatio: number,
	fallbackTarget?: Pick<RgbaColor, 'r' | 'g' | 'b'>
): Pick<RgbaColor, 'r' | 'g' | 'b'> {
	if (getContrastRatio(background, foreground) >= minRatio) return foreground

	const target = fallbackTarget ?? (getPerceivedLuminance(background) < 0.5 ? hexToColor('#f8fafc') : hexToColor('#111827'))
	let best = foreground

	for (let i = 1; i <= 12; i++) {
		const t = i / 12
		const candidate = blendColors(foreground, target, t)
		best = candidate
		if (getContrastRatio(background, candidate) >= minRatio) {
			return candidate
		}
	}

	return best
}

function blendColors(
	a: Pick<RgbaColor, 'r' | 'g' | 'b'>,
	b: Pick<RgbaColor, 'r' | 'g' | 'b'>,
	t: number
): Pick<RgbaColor, 'r' | 'g' | 'b'> {
	return {
		r: Math.round(a.r + (b.r - a.r) * t),
		g: Math.round(a.g + (b.g - a.g) * t),
		b: Math.round(a.b + (b.b - a.b) * t),
	}
}

function hexToColor(hex: string): Pick<RgbaColor, 'r' | 'g' | 'b'> {
	const normalized = hex.replace('#', '')
	const value = normalized.length === 3
		? normalized.split('').map(ch => ch + ch).join('')
		: normalized

	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	}
}

function formatRgb({ r, g, b }: Pick<RgbaColor, 'r' | 'g' | 'b'>): string {
	return `rgb(${r}, ${g}, ${b})`
}

function getContrastRatio(
	background: Pick<RgbaColor, 'r' | 'g' | 'b'>,
	foreground: Pick<RgbaColor, 'r' | 'g' | 'b'>
): number {
	const l1 = getRelativeLuminance(background)
	const l2 = getRelativeLuminance(foreground)
	const lighter = Math.max(l1, l2)
	const darker = Math.min(l1, l2)
	return (lighter + 0.05) / (darker + 0.05)
}

function getRelativeLuminance({ r, g, b }: Pick<RgbaColor, 'r' | 'g' | 'b'>): number {
	const toLinear = (channel: number): number => {
		const c = channel / 255
		return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
	}

	const rl = toLinear(r)
	const gl = toLinear(g)
	const bl = toLinear(b)
	return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/**
 * Strips Twitter-internal URLs that are rendered as media/quote embeds, not as visible text.
 * - `pic.twitter.com/xxx` — always a media reference
 * - Trailing `https://t.co/xxx` — link to quoted tweet or media when those are present
 */
function cleanTweetDisplayText(text: string, hasMedia: boolean, hasQuote: boolean): string {
    // Always remove pic.twitter.com references (media placeholders)
    let cleaned = text.replace(/\s*pic\.twitter\.com\/[A-Za-z0-9]+/g, '')

    // Remove trailing t.co links when we know they point to media or a quoted tweet
    if (hasMedia || hasQuote) {
        cleaned = cleaned.replace(/\s*https?:\/\/t\.co\/[A-Za-z0-9]+\s*$/g, '')
    }

    return cleaned.trim()
}

// Simple text parser for links/hashtags (basic enhancement)
function parseTweetText(text: string): string {
    // Escape HTML first — including `"` and `'` to prevent attribute breakout in generated anchors
    const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    // Replace URLs (safe: quotes are already escaped above)
    const withUrls = escaped.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer nofollow" onclick="event.stopPropagation()">$1</a>'
    );

    // Replace @mentions (safe: only \w+ characters captured, no injection possible)
    const withMentions = withUrls.replace(
        /@(\w+)/g,
        '<a href="https://twitter.com/$1" target="_blank" rel="noopener noreferrer nofollow" onclick="event.stopPropagation()">@$1</a>'
    );

    return withMentions;
}

export function createTwitterLiteCard(data: TwitterLiteCardData, loading = false): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'mvp-twitter-lite-card';

    // Click anywhere to open tweet
    wrapper.addEventListener('click', (e) => {
        // Prevent default if clicking on a button or link
        if ((e.target as HTMLElement).closest('a, button')) return;
        window.open(data.url, '_blank', 'noopener,noreferrer');
    });

    if (loading) {
        wrapper.classList.add('mvp-twitter-lite-skeleton');
        
        const line1 = document.createElement('div');
        line1.className = 'mvp-twitter-lite-skeleton-line';
        line1.style.width = '40%';
        wrapper.appendChild(line1);

        const line2 = document.createElement('div');
        line2.className = 'mvp-twitter-lite-skeleton-line';
        line2.style.width = '90%';
        line2.style.marginTop = '12px';
        wrapper.appendChild(line2);

        const line3 = document.createElement('div');
        line3.className = 'mvp-twitter-lite-skeleton-line';
        line3.style.width = '60%';
        wrapper.appendChild(line3);

        return wrapper;
    }

    // --- Helper to render a single message block (used for reply items and main tweet) ---
    const createMessageBlock = (
        text: string, 
        meta: { displayName?: string; username?: string; isVerified?: boolean; verifiedType?: string; createdAt?: string; avatarUrl?: string }, 
        isMain: boolean
    ): HTMLElement => {
        const container = document.createElement('div');
        // If it's a thread view context, we wrap in thread item. If perfectly standalone single view, we might not.
        // But to keep styles consistent, we can use thread-item structure for everything or keep separate.
        // The V3 design relies on thread-item for padding/avatar logic.
        container.className = 'mvp-twitter-lite-thread-item';

        // Avatar handling
        const avatar = document.createElement('div');
        avatar.className = 'mvp-twitter-lite-thread-avatar-dot'; 
        
        if (meta.avatarUrl && isSafeImageUrl(meta.avatarUrl)) {
            avatar.style.backgroundImage = `url(${encodeURI(meta.avatarUrl)})`;
            avatar.style.backgroundColor = 'transparent'; // Image covers it
            avatar.style.border = 'none'; // Clean look
        }
        
        container.appendChild(avatar);

        // Meta Header (Now a column structure next to avatar)
        const metaRow = document.createElement('div');
        metaRow.className = isMain ? 'mvp-twitter-lite-header' : 'mvp-twitter-lite-thread-meta';
        
        // Wrapper for the two text rows
        const userInfo = document.createElement('div');
        userInfo.className = 'mvp-twitter-lite-user-info-col'; // New class for Column layout

        // ROW 1: Name + Verified + Date (if reply)
        const topRow = document.createElement('div');
        topRow.className = 'mvp-twitter-lite-user-top-row';

        if (meta.displayName) {
            const nameEl = document.createElement('span');
            nameEl.className = 'mvp-twitter-lite-display-name';
            nameEl.textContent = meta.displayName;
            topRow.appendChild(nameEl);
        }
        
        if (meta.isVerified) {
            const verifiedEl = document.createElement('span');
            verifiedEl.className = 'mvp-twitter-lite-verified';
            if (meta.verifiedType === 'Business') {
                verifiedEl.classList.add('gold');
            } else if (meta.verifiedType === 'Government') {
                verifiedEl.classList.add('grey');
            }
            verifiedEl.innerHTML = VERIFIED_SVG;
            topRow.appendChild(verifiedEl);
        }

        // Date in top row for replies
        if (meta.createdAt && !isMain) {
            const sep = document.createElement('span');
            sep.className = 'mvp-twitter-lite-separator-dot';
            sep.textContent = '·';
            topRow.appendChild(sep);

            const dateEl = document.createElement('span');
            dateEl.className = 'mvp-twitter-lite-date';
            dateEl.textContent = meta.createdAt;
            topRow.appendChild(dateEl);
        }

        userInfo.appendChild(topRow);

        // ROW 2: Username (Handle)
         if (meta.username) {
            const bottomRow = document.createElement('div');
            bottomRow.className = 'mvp-twitter-lite-user-bottom-row';
            
            const userEl = document.createElement('span');
            userEl.className = 'mvp-twitter-lite-username';
            userEl.textContent = `@${meta.username}`;
            bottomRow.appendChild(userEl);
            
            userInfo.appendChild(bottomRow);
        } else if (!meta.displayName) {
             // Fallback if absolutely no info
             const fallback = document.createElement('span');
             fallback.className = 'mvp-twitter-lite-display-name';
             fallback.textContent = 'Tweet';
             userInfo.appendChild(fallback);
        }

        metaRow.appendChild(userInfo);
        container.appendChild(metaRow);

        const body = document.createElement('div');
        body.className = 'mvp-twitter-lite-content';
        body.innerHTML = parseTweetText(text);
        container.appendChild(body);

        return container;
    };

    // Global Logo Overlay
    const logoOverlay = document.createElement('div');
    logoOverlay.className = 'mvp-twitter-lite-logo-overlay';
    logoOverlay.innerHTML = X_LOGO_SVG;
    wrapper.appendChild(logoOverlay);

    // === RENDER LOGIC ===
    const hasQuote = !!data.quotedTweet?.text;
    const mainDisplayText = cleanTweetDisplayText(data.text, data.hasMedia === true, hasQuote);

    // Check if this is a reply thread
    if (data.replyTo?.text) {
        const threadContainer = document.createElement('div');
        threadContainer.className = 'mvp-twitter-lite-thread-container';

        // Vertical Line is now handled via CSS pseudo-element on the first item

        // 1. Reply Item (Parent)
        const replyItem = createMessageBlock(
            data.replyTo.text,
            {
                displayName: data.replyTo.displayName,
                username: data.replyTo.username,
                isVerified: data.replyTo.isVerified,
                verifiedType: data.replyTo.verifiedType,
                createdAt: data.replyTo.createdAt,
                avatarUrl: data.replyTo.authorAvatarUrl
            },
            false
        );

        // "Ver tweet original en X" link REMOVED as requested

        threadContainer.appendChild(replyItem);

        // 2. Main Tweet Item
        const mainItem = createMessageBlock(
            mainDisplayText,
            {
                displayName: data.displayName,
                username: data.username,
                isVerified: data.isVerified,
                verifiedType: data.verifiedType,
                createdAt: data.createdAt,
                 avatarUrl: data.authorAvatarUrl
            },
            true
        );
        mainItem.classList.add('current');
        
        threadContainer.appendChild(mainItem);
        wrapper.appendChild(threadContainer);

    } else {
        // Standard Single Tweet View
        // We wrap it in a pseudo-thread item wrapper to reuse the avatar logic/layout
        // But we hide the "thread line" since it's single.
        const mainBlock = createMessageBlock(
            mainDisplayText,
            {
                displayName: data.displayName,
                username: data.username,
                isVerified: data.isVerified,
                verifiedType: data.verifiedType,
                createdAt: data.createdAt,
                avatarUrl: data.authorAvatarUrl
            },
            true
        );
        // Add current for styling (e.g. padding adjustments if any)
        mainBlock.classList.add('current');
        wrapper.appendChild(mainBlock);
    }

    // Media Preview: combine photos + video thumbnails into unified grid
    // Rendered BEFORE quoted tweet (matches real Twitter layout: text → media → quote)
    const photoUrls = data.mediaUrls && data.mediaUrls.length > 0 ? data.mediaUrls : [];
    const videoThumbs = data.videoThumbnailUrls && data.videoThumbnailUrls.length > 0 ? data.videoThumbnailUrls : [];
    
    // Fallback: if no photos/videos but we have a thumbnailUrl from oEmbed
    const fallbackUrls = photoUrls.length === 0 && videoThumbs.length === 0 && data.thumbnailUrl ? [data.thumbnailUrl] : [];
    
    // Unified list of media items: { url, isVideo }
    type MediaItem = { url: string; isVideo: boolean };
    const allMedia: MediaItem[] = [];
    for (const url of (photoUrls.length > 0 ? photoUrls : fallbackUrls)) {
        allMedia.push({ url, isVideo: false });
    }
    for (const url of videoThumbs) {
        allMedia.push({ url, isVideo: true });
    }
    
    // Show max 4 items
    const visibleMedia = allMedia.slice(0, 4);
    
    if (visibleMedia.length > 0) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'mvp-twitter-lite-media-preview';
        mediaContainer.dataset.count = visibleMedia.length.toString();

        for (const [index, item] of visibleMedia.entries()) {
            const itemWrapper = document.createElement('div');
            itemWrapper.className = item.isVideo
                ? 'mvp-twitter-lite-media-item mvp-twitter-lite-video-thumb'
                : 'mvp-twitter-lite-media-item';
            
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = item.isVideo ? `Video ${index + 1}` : `Foto ${index + 1}`;
            img.loading = 'lazy';
            itemWrapper.appendChild(img);

            // Play button overlay for videos
            if (item.isVideo) {
                const playOverlay = document.createElement('div');
                playOverlay.className = 'mvp-twitter-lite-play-overlay';
                playOverlay.innerHTML = '<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.6)"/><path d="M19 15l14 9-14 9V15z" fill="white"/></svg>';
                itemWrapper.appendChild(playOverlay);
            }

            mediaContainer.appendChild(itemWrapper);
        }

        wrapper.appendChild(mediaContainer);
    }

    // Quoted Tweet (rendered after media, matches real Twitter layout)
    if (data.quotedTweet?.text) {
        const qt = data.quotedTweet;
        const quoteCard = document.createElement('div');
        quoteCard.className = 'mvp-twitter-lite-quote-card';
        quoteCard.addEventListener('click', (e) => {
            e.stopPropagation();
            if ((e.target as HTMLElement).closest('a')) return;
            if (qt.url) window.open(qt.url, '_blank', 'noopener,noreferrer');
        });

        // Quote header: avatar + name + handle
        const quoteHeader = document.createElement('div');
        quoteHeader.className = 'mvp-twitter-lite-quote-header';

        const quoteAvatar = document.createElement('div');
        quoteAvatar.className = 'mvp-twitter-lite-quote-avatar';
        if (qt.authorAvatarUrl && isSafeImageUrl(qt.authorAvatarUrl)) {
            quoteAvatar.style.backgroundImage = `url(${encodeURI(qt.authorAvatarUrl)})`;
        }
        quoteHeader.appendChild(quoteAvatar);

        if (qt.displayName) {
            const nameEl = document.createElement('span');
            nameEl.className = 'mvp-twitter-lite-display-name';
            nameEl.textContent = qt.displayName;
            quoteHeader.appendChild(nameEl);
        }

        if (qt.isVerified) {
            const verifiedEl = document.createElement('span');
            verifiedEl.className = 'mvp-twitter-lite-verified';
            if (qt.verifiedType === 'Business') verifiedEl.classList.add('gold');
            else if (qt.verifiedType === 'Government') verifiedEl.classList.add('grey');
            verifiedEl.innerHTML = VERIFIED_SVG;
            quoteHeader.appendChild(verifiedEl);
        }

        if (qt.username) {
            const handleEl = document.createElement('span');
            handleEl.className = 'mvp-twitter-lite-username';
            handleEl.textContent = `@${qt.username}`;
            quoteHeader.appendChild(handleEl);
        }

        if (qt.createdAt) {
            const sep = document.createElement('span');
            sep.className = 'mvp-twitter-lite-separator-dot';
            sep.textContent = '·';
            quoteHeader.appendChild(sep);

            const dateEl = document.createElement('span');
            dateEl.className = 'mvp-twitter-lite-date';
            dateEl.textContent = qt.createdAt;
            quoteHeader.appendChild(dateEl);
        }

        quoteCard.appendChild(quoteHeader);

        // Quote text (clean internal URLs like pic.twitter.com)
        const quoteDisplayText = cleanTweetDisplayText(qt.text, qt.hasMedia === true, false);
        const quoteBody = document.createElement('div');
        quoteBody.className = 'mvp-twitter-lite-quote-text';
        quoteBody.innerHTML = parseTweetText(quoteDisplayText);
        quoteCard.appendChild(quoteBody);

        // Quote media (single thumbnail if available)
        const quoteMediaUrls = qt.mediaUrls && qt.mediaUrls.length > 0 ? qt.mediaUrls : [];
        if (quoteMediaUrls.length > 0) {
            const quoteMedia = document.createElement('div');
            quoteMedia.className = 'mvp-twitter-lite-quote-media';
            const img = document.createElement('img');
            img.src = quoteMediaUrls[0];
            img.alt = 'Media del tweet citado';
            img.loading = 'lazy';
            quoteMedia.appendChild(img);
            quoteCard.appendChild(quoteMedia);
        }

        wrapper.appendChild(quoteCard);
    }

    // Date + metrics row (date left, metrics right)
    const metrics: Array<{ label: string; value: number; icon: string; type: string }> = [];
    if (typeof data.replyCount === 'number') metrics.push({ label: 'Respuestas', value: data.replyCount, icon: REPLY_ICON_SVG, type: 'reply' });
    if (typeof data.retweetCount === 'number') metrics.push({ label: 'Retweets', value: data.retweetCount, icon: RETWEET_ICON_SVG, type: 'retweet' });
    if (typeof data.quoteCount === 'number') metrics.push({ label: 'Citas', value: data.quoteCount, icon: QUOTE_ICON_SVG, type: 'quote' });
    if (typeof data.likeCount === 'number') metrics.push({ label: 'Me gusta', value: data.likeCount, icon: HEART_ICON_SVG, type: 'like' });

    if (data.createdAt || metrics.length > 0) {
        const infoRow = document.createElement('div');
        infoRow.className = 'mvp-twitter-lite-info-row';

        if (data.createdAt) {
            const dateEl = document.createElement('span');
            dateEl.className = 'mvp-twitter-lite-bottom-date';
            dateEl.textContent = data.createdAt;
            infoRow.appendChild(dateEl);
        }

        if (metrics.length > 0) {
            const metricsGroup = document.createElement('span');
            metricsGroup.className = 'mvp-twitter-lite-metrics';

            for (const metric of metrics) {
                const metricItem = document.createElement('span');
                metricItem.className = `mvp-twitter-lite-metric mvp-twitter-lite-metric--${metric.type}`;
                metricItem.title = metric.label;

                const iconEl = document.createElement('span');
                iconEl.className = 'mvp-twitter-lite-metric-icon';
                iconEl.innerHTML = metric.icon;

                const metricValue = document.createElement('span');
                metricValue.className = 'mvp-twitter-lite-metric-value';
                metricValue.textContent = formatMetricCount(metric.value);

                metricItem.append(iconEl, metricValue);
                metricsGroup.appendChild(metricItem);
            }

            infoRow.appendChild(metricsGroup);
        }

        wrapper.appendChild(infoRow);
    }

    // Footer actions
    const footer = document.createElement('div');
    footer.className = 'mvp-twitter-lite-footer';

    const actions = document.createElement('div');
    actions.className = 'mvp-twitter-lite-actions';
    
    // Copy Link Button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'mvp-twitter-lite-action-btn mvp-twitter-lite-copy-btn';
    copyBtn.innerHTML = `${LINK_SVG} <span>Copiar enlace</span>`;
    copyBtn.title = 'Copiar enlace al portapapeles';
    
    copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            await navigator.clipboard.writeText(data.url);
            
            // Feedback
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = `${CHECK_SVG} <span>¡Copiado!</span>`;
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy', err);
        }
    });

    actions.appendChild(copyBtn);
    footer.appendChild(actions);

    // Show Original / Load Media button (Right side)
    if (data.canExpandTweet) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'mvp-twitter-lite-show-original-btn';
        expandBtn.innerHTML = '&#9654;&#xFE0E; Ver tweet';
        // The click handler for this will be handled by the parent logic
        expandBtn.classList.add('mvp-twitter-lite-media-btn');
        footer.appendChild(expandBtn);
    } else {
         const openLink = document.createElement('a');
         openLink.href = data.url;
         openLink.target = '_blank';
         openLink.rel = 'noopener noreferrer nofollow';
         openLink.className = 'mvp-twitter-lite-action-btn';
         openLink.textContent = 'Abrir en X';
         // Bubbling prevention
         openLink.addEventListener('click', e => e.stopPropagation());
         footer.appendChild(openLink);
    }

    wrapper.appendChild(footer);

    return wrapper;
}
