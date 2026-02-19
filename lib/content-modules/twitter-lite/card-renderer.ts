import type { TwitterLiteCardData } from './types'
import { TWITTER_LITE_CSS, TWITTER_LITE_STYLE_ID } from './styles'

// Icons (Lucide)
const X_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`

const VERIFIED_SVG = `<svg viewBox="0 0 24 24" aria-label="Verified account" fill="currentColor" width="16" height="16"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></g></svg>`

const LINK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`

function isSafeImageUrl(url: string): boolean {
	try {
		const parsed = new URL(url)
		return parsed.protocol === 'https:' || parsed.protocol === 'http:'
	} catch {
		return false
	}
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

    // Date at bottom — always below media, left-aligned
    if (data.createdAt) {
        const dateContainer = document.createElement('div');
        dateContainer.className = 'mvp-twitter-lite-bottom-date';
        dateContainer.textContent = data.createdAt;
        wrapper.appendChild(dateContainer);
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
