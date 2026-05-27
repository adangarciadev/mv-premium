import {
	ACTION_GROUP_CLASS,
	BODY_CLASS,
	BODY_CLAMPED_CLASS,
	BODY_TRUNCABLE_CLASS,
	BUTTON_CLASS,
	CONTENT_CLASS,
	EXPAND_CLASS,
	LIKE_SUMMARY_CLASS,
	LOADING_CLASS,
	MAX_PREVIEW_HEIGHT,
	ROW_CLASS,
	SHARE_CLASS,
	STYLE_ID,
} from './constants'

export function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		td.mvp-preview-btn-cell {
			position: relative;
			overflow: visible;
		}
		td.mvp-preview-btn-cell > .thread {
			margin-right: var(--mvp-thread-actions-padding, 0px);
		}
		.${ACTION_GROUP_CLASS} {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			white-space: nowrap;
			vertical-align: middle;
		}
		.${BUTTON_CLASS} {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			vertical-align: middle;
			width: 24px;
			height: 24px;
			border: 0;
			border-radius: 4px;
			background: transparent;
			color: #98a2ad;
			cursor: pointer;
			font-size: 14px;
			transition: background 0.15s ease, color 0.15s ease, opacity 0.15s ease;
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			padding: 0;
			margin: 0 0 0 16px;
			z-index: 5;
		}
		#temas tr:hover .${BUTTON_CLASS},
		td:hover .${BUTTON_CLASS},
		.${BUTTON_CLASS}:focus-visible {
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}
		.${BUTTON_CLASS}:hover,
		.${BUTTON_CLASS}:focus-visible {
			background: var(--mv-bg-hover, rgba(255, 255, 255, 0.08));
			color: #fff;
			outline: none;
		}
		.${BUTTON_CLASS}[aria-expanded="true"] {
			color: #fca22b;
			opacity: 1;
			visibility: visible;
			pointer-events: auto;
		}
		.${BUTTON_CLASS}[aria-expanded="true"] i {
			transform: rotate(180deg);
		}
		.${BUTTON_CLASS} i {
			transition: transform 0.15s ease;
		}
		.${ROW_CLASS} > td {
			padding: 0 !important;
			border-top: 1px solid rgba(255, 255, 255, 0.06);
			border-bottom: 1px solid rgba(0, 0, 0, 0.35);
			background: transparent;
		}
		.${CONTENT_CLASS} {
			position: relative;
			margin: 0;
			padding: 0;
		}
		.${BODY_CLASS} {
			position: relative;
			overflow: hidden;
			min-width: 0;
			display: block;
		}
		.${BODY_CLASS} [data-s9e-mediaembed="streamable"].embed {
			display: block;
			max-width: 100%;
		}
		.${BODY_CLASS} [data-s9e-mediaembed="streamable"] iframe {
			aspect-ratio: 16 / 9;
			height: auto !important;
			min-height: 0;
		}
		.${BODY_CLASS} .table-wrap table th,
		.${BODY_CLASS} .table-wrap table td {
			height: auto !important;
			min-height: 0 !important;
			padding: 10px 14px !important;
			line-height: 1.35 !important;
			vertical-align: middle !important;
		}
		.${BODY_CLASS} .table-wrap table th {
			color: #fff !important;
			font-weight: 700;
		}
		.${BODY_CLASS} .mvp-thread-preview-empty-embed {
			display: none !important;
			height: 0 !important;
			min-height: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			overflow: hidden !important;
		}
		.${BODY_CLASS} .mvp-thread-preview-controls {
			margin-top: 24px;
			display: flex;
		}
		.${BODY_CLASS} .${LIKE_SUMMARY_CLASS} {
			cursor: default;
			pointer-events: none;
			color: #8f989e;
		}
		.${BODY_CLASS} .mvp-thread-preview-synthetic-meta {
			min-height: 36px;
			margin-left: 42px;
		}
		.${BODY_CLASS} .mvp-thread-preview-synthetic-avatar span.letter {
			width: 32px;
			height: 32px;
			line-height: 32px;
			font-size: 15px;
		}
		.${BODY_CLASS} > .post,
		.${BODY_CLASS} > div[id^="post-"] {
			margin-bottom: 0 !important;
		}
		.${BODY_CLAMPED_CLASS} {
			max-height: ${MAX_PREVIEW_HEIGHT}px;
		}
		.${BODY_CLAMPED_CLASS}.${BODY_TRUNCABLE_CLASS}::after {
			content: "";
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			height: 140px;
			pointer-events: none;
			z-index: 1;
			background: linear-gradient(to bottom, rgba(52, 63, 73, 0) 0%, rgba(52, 63, 73, 0.8) 50%, #343f49 100%);
		}
		.${BODY_CLASS}:not(.${BODY_CLAMPED_CLASS}) {
			max-height: none;
		}
		.${EXPAND_CLASS} {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			position: relative;
			z-index: 2;
			float: none !important;
			clear: both;
			width: fit-content;
			min-width: 148px;
			margin: 14px auto 18px;
			min-height: 32px;
			border: 1px solid rgba(255, 255, 255, 0.06);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.03);
			color: #a0acb8;
			cursor: pointer;
			font-size: 13px;
			font-weight: 600;
			padding: 0 24px;
			transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
		}
		.${EXPAND_CLASS}[hidden] {
			display: none !important;
		}
		.${EXPAND_CLASS}:hover,
		.${BODY_CLASS}:not(.${BODY_CLAMPED_CLASS}) + .${EXPAND_CLASS}:hover {
			background: rgba(255, 255, 255, 0.06);
			border-color: rgba(255, 255, 255, 0.12);
			color: #fff;
		}
		.${BODY_CLASS}:not(.${BODY_CLAMPED_CLASS}) + .${EXPAND_CLASS} {
			margin-top: 24px;
		}
		.${EXPAND_CLASS} i {
			font-size: 12px;
		}
		.${LOADING_CLASS} {
			padding: 18px 30px;
			color: #98a2ad;
			font-size: 13px;
		}
		.${SHARE_CLASS} {
			position: absolute;
			right: 34px;
			top: 54px;
			z-index: 6;
			width: min(525px, calc(100% - 48px));
			padding: 14px 13px 12px;
			background: #15191e;
			border: 1px solid rgba(255, 255, 255, 0.08);
			box-shadow: 0 12px 32px rgba(0, 0, 0, 0.34);
			color: #fff;
			font-size: 14px;
		}
		.${SHARE_CLASS} strong {
			display: block;
			margin-bottom: 12px;
			font-size: 14px;
		}
		.${SHARE_CLASS} .mvp-thread-preview-share-url {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 10px;
		}
		.${SHARE_CLASS} .mvp-thread-preview-share-copy {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 30px;
			height: 30px;
			border: 1px solid rgba(255, 164, 0, 0.55);
			border-radius: 4px;
			background: rgba(255, 164, 0, 0.08);
			color: #ffa400;
			cursor: pointer;
			padding: 0;
		}
		.${SHARE_CLASS} input {
			flex: 1;
			min-width: 0;
			height: 32px;
			border: 1px solid rgba(255, 255, 255, 0.18);
			border-radius: 4px;
			background: #222933;
			color: #fff;
			font-size: 16px;
			padding: 0 8px;
		}
		.${SHARE_CLASS} .mvp-thread-preview-share-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		.${SHARE_CLASS} .mvp-thread-preview-share-actions a {
			display: inline-flex;
			align-items: center;
			gap: 6px;
			min-height: 34px;
			padding: 0 12px;
			border-radius: 4px;
			color: #fff !important;
			font-weight: 500;
			text-decoration: none;
		}
		.${SHARE_CLASS} .mvp-share-facebook { background: #4b4bb2; }
		.${SHARE_CLASS} .mvp-share-twitter { background: #6d96df; }
		.${SHARE_CLASS} .mvp-share-whatsapp { background: #42d733; }
		.${SHARE_CLASS} .mvp-share-email { background: #63666b; }
		@media (max-width: 700px) {
			.${SHARE_CLASS} {
				position: relative;
				right: auto;
				top: auto;
				width: auto;
				margin: 10px 12px;
			}
		}
	`
	document.head.appendChild(style)
}
