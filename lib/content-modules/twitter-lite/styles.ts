export const TWITTER_LITE_STYLE_ID = 'mvp-twitter-lite-styles'

export const TWITTER_LITE_CSS = `
.mvp-twitter-lite-card {
    display: block;
    width: min(100%, 550px);
    max-width: 550px;
    box-sizing: border-box;
    padding: 12px 16px;
    border-radius: 12px;
    border: 1px solid #38444d;
    background: #15202b;
    color: #e7e9ea;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    text-align: left;
    margin-top: 4px;
    position: relative;
    z-index: 1; /* Sufficient for overlay */
    cursor: pointer;
}

.mvp-twitter-lite-card:hover {
    background: #1a2d3d;
}

.mvp-twitter-lite-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
}

/* Header: Column Layout */
.mvp-twitter-lite-user-info-col {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    overflow: hidden;
    line-height: 1.3;
    /* Height roughly matches 40px avatar: 2 lines * ~18px + gaps */
    height: 40px; 
    justify-content: center; /* Vertically center nicely against avatar */
}

/* Row 1: Name + Verified + Date (if reply) */
.mvp-twitter-lite-user-top-row {
    display: flex;
    align-items: center;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Row 2: @handle */
.mvp-twitter-lite-user-bottom-row {
    display: flex;
    align-items: center;
    font-size: 14px;
    margin-top: 1px;
}

.mvp-twitter-lite-display-name {
    font-weight: 700;
    color: #e7e9ea;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mvp-twitter-lite-verified {
    color: var(--main-link, #1d9bf0);
    display: flex;
    align-items: center;
    margin-left: 2px;
}

/* Handle is on its own line now, remove left margin */
.mvp-twitter-lite-username {
    color: #8b98a5;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-left: 0; 
}

.mvp-twitter-lite-separator-dot {
    color: #8b98a5;
    font-size: 14px;
    margin: 0 4px;
}

.mvp-twitter-lite-date {
    color: #8b98a5;
    font-size: 15px;
    white-space: nowrap;
}

/* Logo styles handled by .mvp-twitter-lite-logo-overlay */


.mvp-twitter-lite-content a {
    color: var(--main-link, #1d9bf0);
    text-decoration: none;
}

.mvp-twitter-lite-content a:hover {
    text-decoration: underline;
}

.mvp-twitter-lite-media-preview {
    display: grid;
    gap: 2px;
    width: 100%;
    border-radius: 12px;
    border: 1px solid #38444d;
    margin-top: 10px;
    overflow: hidden;
    position: relative;
}

/* Grid Layouts based on item count */
.mvp-twitter-lite-media-preview[data-count="1"] {
    grid-template-columns: 1fr;
    height: auto;
    max-height: 500px;
}

/* Multi-image grids need fixed height to work well with object-fit match */
.mvp-twitter-lite-media-preview:not([data-count="1"]) {
    height: 250px;
}

.mvp-twitter-lite-media-preview[data-count="2"] {
    grid-template-columns: 1fr 1fr;
    /* height via generic rule above */
}

.mvp-twitter-lite-media-preview[data-count="3"] {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
}
.mvp-twitter-lite-media-preview[data-count="3"] .mvp-twitter-lite-media-item:first-child {
    grid-row: span 2;
}

.mvp-twitter-lite-media-preview[data-count="4"] {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
}

.mvp-twitter-lite-media-item {
    position: relative;
    width: 100%;
    overflow: hidden;
}

/* Default to auto height for single images so they show full */
.mvp-twitter-lite-media-preview[data-count="1"] .mvp-twitter-lite-media-item,
.mvp-twitter-lite-media-preview[data-count="1"] .mvp-twitter-lite-media-item img {
    height: auto;
}

/* For grid (2+), fill the cells */
.mvp-twitter-lite-media-preview:not([data-count="1"]) .mvp-twitter-lite-media-item,
.mvp-twitter-lite-media-preview:not([data-count="1"]) .mvp-twitter-lite-media-item img {
    height: 100%;
}

.mvp-twitter-lite-media-item img {
    display: block;
    width: 100%;
    object-fit: cover;
}

/* Single image: show fully, don't crop */
.mvp-twitter-lite-media-preview[data-count="1"] .mvp-twitter-lite-media-item img {
    object-fit: contain;
    background: #000;
}

/* Video thumbnail: play button overlay */
.mvp-twitter-lite-video-thumb {
    cursor: pointer;
}

.mvp-twitter-lite-play-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    pointer-events: none;
    transition: transform 0.15s ease;
}

.mvp-twitter-lite-video-thumb:hover .mvp-twitter-lite-play-overlay {
    transform: translate(-50%, -50%) scale(1.1);
}

.mvp-twitter-lite-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid #38444d;
}

.mvp-twitter-lite-actions {
    display: flex;
    gap: 16px;
}

.mvp-twitter-lite-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #8b98a5;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.2s;
    background: transparent;
    border: none;
    padding: 0;
}

.mvp-twitter-lite-copy-btn {
    opacity: 0.7;
    transition: opacity 0.2s, color 0.2s;
    cursor: pointer;
}

.mvp-twitter-lite-copy-btn:hover {
    opacity: 1;
    color: var(--main-link, #1d9bf0);
}

.mvp-twitter-lite-copy-btn.copied {
    color: #00ba7c; /* Twitter success green */
}

.mvp-twitter-lite-copy-btn svg {
    display: inline-block;
    vertical-align: text-bottom;
}

.mvp-twitter-lite-action-btn:hover {
    color: var(--main-link, #1d9bf0);
    text-decoration: underline;
}

/* Original compact button style */
.mvp-twitter-lite-show-original-btn {
    font-size: 12px;
    color: var(--main-link, #1d9bf0);
    background: transparent;
    border: 1px solid #38444d;
    padding: 5px 12px;
    border-radius: 999px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
}

.mvp-twitter-lite-show-original-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--main-link, #1d9bf0);
}

/* Global Logo Overlay */
.mvp-twitter-lite-logo-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    color: #e7e9ea;
    opacity: 0.35;
    transition: all 0.2s;
    pointer-events: none;
}

.mvp-twitter-lite-card:hover .mvp-twitter-lite-logo-overlay {
    color: var(--main-link, #1d9bf0);
    opacity: 1;
}

/* --- THREAD DESIGN V4 (Transparent / Connected) --- */
.mvp-twitter-lite-thread-container {
    padding-left: 0;
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
}

/* Items are now transparent blocks, ensuring the line connects seamlessly */
.mvp-twitter-lite-thread-item {
    position: relative;
    padding-left: 56px;
    padding-bottom: 16px; /* Space between tweets */
    background: transparent;
    border: none;
    border-radius: 0;
    margin-bottom: 0;
}

.mvp-twitter-lite-thread-item:last-child {
    padding-bottom: 0;
}

/* The connecting line - connects Avatar 1 to Avatar 2 */
.mvp-twitter-lite-thread-item::before {
    content: '';
    position: absolute;
    left: 23px; /* Center of 40px avatar */
    top: 44px;  /* Start just below top avatar */
    bottom: -4px; /* Extend into the next item's area exactly to its avatar top */
    width: 2px;
    background-color: #38444d;
    z-index: 1;
    display: none;
    pointer-events: none;
}

.mvp-twitter-lite-thread-item:not(:last-child)::before {
    display: block;
}

/* FIX: Absolutely NO line for single tweets (direct children of card) */
.mvp-twitter-lite-card > .mvp-twitter-lite-thread-item::before {
    display: none !important;
}

/* Ensure content sits below the 40px header/avatar block */
.mvp-twitter-lite-content {
    margin: 6px 0 10px;
    font-size: 15px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    color: #e7e9ea;
    display: block;
    clear: both;
}

/* Main tweet text: full width (escape avatar indentation) */
.mvp-twitter-lite-thread-item.current .mvp-twitter-lite-content {
    margin-left: -56px;
    padding-left: 0;
}

/* Date at bottom style — always left-aligned, below media */
.mvp-twitter-lite-bottom-date {
    font-size: 15px;
    color: #8b98a5;
    margin-top: 8px;
    margin-bottom: 2px;
}

/* Avatar representation (dot or image placeholder) */
.mvp-twitter-lite-thread-avatar-dot {
    position: absolute;
    left: 4px;
    top: 4px;
    width: 40px; /* Larger avatar as requested */
    height: 40px;
    border-radius: 50%;
    background-color: #8b98a5;
    border: 2px solid #15202b; /* Border to cut line if needed, mainly aesthetic */
    z-index: 2;
    background-size: cover;
    background-position: center;
}

/* Verified Badge Colors */
.mvp-twitter-lite-verified {
    color: var(--main-link, #1d9bf0);
    display: flex;
    align-items: center;
    margin-left: 2px;
}

.mvp-twitter-lite-verified.gold {
    color: #ffd400; /* Twitter Gold/Yellow */
}

.mvp-twitter-lite-verified.grey {
    color: #829aab; /* Twitter Grey (Government/Official) - optional support */
}

.mvp-twitter-lite-thread-item:not(.current) .mvp-twitter-lite-content {
    font-size: 14px;
    color: #8b98a5;
    margin-top: 2px;
    margin-bottom: 8px;
}

/* Main/Current tweet specific styles */
.mvp-twitter-lite-thread-item.current .mvp-twitter-lite-thread-avatar-dot {
    /* If image present, border color ensures separation from dark bg */
    border-color: #15202b;
    width: 40px;
    height: 40px;
    left: 4px;
}

/* Highlight current item avatar if no image? */
.mvp-twitter-lite-thread-item.current .mvp-twitter-lite-thread-avatar-dot:not([style*="background-image"]) {
    background-color: var(--main-link, #1d9bf0);
}

.mvp-twitter-lite-thread-item.current {
    padding-bottom: 0;
    /* Optional: Slight emphasis? No, keep it clean. */
}

.mvp-twitter-lite-thread-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
}

/* Reply Context Link */
.mvp-twitter-lite-reply-context {
    font-size: 13px;
    margin-top: 4px;
    color: #8b98a5;
}

.mvp-twitter-lite-reply-context a {
    color: var(--main-link, #1d9bf0);
    text-decoration: none;
}
.mvp-twitter-lite-reply-context a:hover { text-decoration: underline; }

/* --- QUOTED TWEET CARD --- */
.mvp-twitter-lite-quote-card {
    border: 1px solid #38444d;
    border-radius: 12px;
    padding: 10px 12px;
    margin-top: 10px;
    background: transparent;
    cursor: pointer;
    transition: background 0.15s ease;
}

.mvp-twitter-lite-quote-card:hover {
    background: rgba(255, 255, 255, 0.03);
}

.mvp-twitter-lite-quote-header {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    line-height: 1.3;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mvp-twitter-lite-quote-avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background-color: #8b98a5;
    background-size: cover;
    background-position: center;
    flex-shrink: 0;
}

.mvp-twitter-lite-quote-header .mvp-twitter-lite-display-name {
    font-size: 13px;
    font-weight: 700;
}

.mvp-twitter-lite-quote-header .mvp-twitter-lite-username {
    font-size: 13px;
}

.mvp-twitter-lite-quote-header .mvp-twitter-lite-verified svg {
    width: 14px;
    height: 14px;
}

.mvp-twitter-lite-quote-header .mvp-twitter-lite-date {
    font-size: 13px;
}

.mvp-twitter-lite-quote-text {
    font-size: 14px;
    line-height: 1.4;
    color: #e7e9ea;
    white-space: pre-wrap;
    word-break: break-word;
}

.mvp-twitter-lite-quote-text a {
    color: var(--main-link, #1d9bf0);
    text-decoration: none;
}
.mvp-twitter-lite-quote-text a:hover {
    text-decoration: underline;
}

.mvp-twitter-lite-quote-media {
    margin-top: 8px;
    border-radius: 12px;
    overflow: hidden;
}

.mvp-twitter-lite-quote-media img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: contain;
    background: #000;
}

/* Skeleton loader */
.mvp-twitter-lite-skeleton {
    animation: mvp-twitter-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    pointer-events: none;
}

@keyframes mvp-twitter-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.3; }
}

.mvp-twitter-lite-skeleton-line {
    height: 14px;
    background-color: #38444d;
    border-radius: 4px;
    margin-bottom: 8px;
}
`
