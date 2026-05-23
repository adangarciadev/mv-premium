const STYLE_ID = 'mvp-command-search-results-styles'
const DARK_PAGE_CLASS = 'mvp-search-results-dark'
const SEARCH_ICON_HITBOX_CLASS = 'mvp-gsc-search-icon-hitbox'
const SEARCH_ICON_DEADZONE_CLASS = 'mvp-gsc-search-icon-deadzone'
const SEARCH_ICON_CLICK_WIDTH = 48
const SEARCH_ICON_DEADZONE_WIDTH = 8

const searchResultsCss = `
html.${DARK_PAGE_CLASS} body:has(.gsc-control-cse),
html.${DARK_PAGE_CLASS} #main:has(.gsc-control-cse) {
	color: var(--foreground, #e7e9ea) !important;
}

html.${DARK_PAGE_CLASS} .gsc-control-cse,
html.${DARK_PAGE_CLASS} .gsc-control-cse .gsc-table-result,
html.${DARK_PAGE_CLASS} .gsc-above-wrapper-area,
html.${DARK_PAGE_CLASS} .gsc-resultsbox-visible {
	background: var(--card, #20262b) !important;
	border-color: var(--border, #30353a) !important;
	color: var(--foreground, #e7e9ea) !important;
}

html.${DARK_PAGE_CLASS} .gsc-control-cse {
	max-width: 1040px !important;
	margin: 18px auto 32px !important;
	padding: 28px !important;
	border: 1px solid var(--border, #30353a) !important;
	border-radius: 10px !important;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28) !important;
}

html.${DARK_PAGE_CLASS} form.gsc-search-box,
html.${DARK_PAGE_CLASS} table.gsc-search-box {
	margin: 0 0 18px !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box {
	position: relative !important;
	background: var(--input, #252c31) !important;
	border-color: var(--border, #30353a) !important;
	border-radius: 7px !important;
	box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--foreground, #e7e9ea) 5%, transparent) !important;
	color: var(--foreground, #e7e9ea) !important;
	min-height: 50px !important;
	padding: 0 14px !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box::before {
	content: '' !important;
	position: absolute !important;
	left: 17px !important;
	top: 50% !important;
	width: 14px !important;
	height: 14px !important;
	border: 2px solid var(--muted-foreground, #9aa6ad) !important;
	border-radius: 50% !important;
	transform: translateY(-58%) !important;
	pointer-events: none !important;
	z-index: 2 !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box::after {
	content: '' !important;
	position: absolute !important;
	left: 30px !important;
	top: 50% !important;
	width: 8px !important;
	height: 2px !important;
	border-radius: 999px !important;
	background: var(--muted-foreground, #9aa6ad) !important;
	transform: translateY(5px) rotate(45deg) !important;
	transform-origin: left center !important;
	pointer-events: none !important;
	z-index: 2 !important;
}

html.${DARK_PAGE_CLASS} .${SEARCH_ICON_HITBOX_CLASS} {
	position: absolute !important;
	left: 6px !important;
	top: 50% !important;
	z-index: 3 !important;
	width: 42px !important;
	height: 42px !important;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
	cursor: pointer !important;
	transform: translateY(-50%) !important;
}

html.${DARK_PAGE_CLASS} .${SEARCH_ICON_DEADZONE_CLASS} {
	position: absolute !important;
	left: ${SEARCH_ICON_CLICK_WIDTH}px !important;
	top: 0 !important;
	z-index: 3 !important;
	width: ${SEARCH_ICON_DEADZONE_WIDTH}px !important;
	height: 100% !important;
	padding: 0 !important;
	border: 0 !important;
	background: transparent !important;
	cursor: text !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box:hover::before,
html.${DARK_PAGE_CLASS} .gsc-input-box:focus-within::before {
	border-color: var(--primary, #fc8f22) !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box:hover::after,
html.${DARK_PAGE_CLASS} .gsc-input-box:focus-within::after {
	background: var(--primary, #fc8f22) !important;
}

html.${DARK_PAGE_CLASS} .gsc-input-box:hover,
html.${DARK_PAGE_CLASS} .gsc-input-box:focus-within {
	border-color: color-mix(in srgb, var(--primary, #fc8f22) 55%, var(--border, #30353a)) !important;
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary, #fc8f22) 16%, transparent) !important;
}

html.${DARK_PAGE_CLASS} input.gsc-input,
html.${DARK_PAGE_CLASS} .gsc-input input {
	background-color: transparent !important;
	color: var(--foreground, #e7e9ea) !important;
	-webkit-text-fill-color: var(--foreground, #e7e9ea) !important;
	caret-color: var(--primary, #fc8f22) !important;
	font-size: 17px !important;
	font-weight: 500 !important;
	height: 48px !important;
	padding-left: 58px !important;
}

html.${DARK_PAGE_CLASS} input.gsc-input::placeholder,
html.${DARK_PAGE_CLASS} .gsc-input input::placeholder {
	color: var(--muted-foreground, #9aa6ad) !important;
}

html.${DARK_PAGE_CLASS} td.gsib_a {
	background: transparent !important;
	padding: 0 !important;
}

html.${DARK_PAGE_CLASS} td.gsib_a input.gsc-input {
	background-position: 12px center !important;
	background-repeat: no-repeat !important;
}

html.${DARK_PAGE_CLASS} td.gsib_b {
	background: transparent !important;
	padding: 0 2px 0 10px !important;
}

html.${DARK_PAGE_CLASS} .gsst_a,
html.${DARK_PAGE_CLASS} .gscb_a {
	color: var(--muted-foreground, #9aa6ad) !important;
	opacity: 1 !important;
	text-decoration: none !important;
}

html.${DARK_PAGE_CLASS} .gsst_a:hover,
html.${DARK_PAGE_CLASS} .gsst_a:hover .gscb_a {
	color: var(--primary, #fc8f22) !important;
}

html.${DARK_PAGE_CLASS} .gsc-result,
html.${DARK_PAGE_CLASS} .gsc-webResult.gsc-result {
	margin: 0 0 10px !important;
	padding: 18px 20px !important;
	background: color-mix(in srgb, var(--card, #20262b) 88%, var(--background, #17191c)) !important;
	border: 1px solid color-mix(in srgb, var(--border, #30353a) 82%, transparent) !important;
	border-radius: 8px !important;
	box-shadow: 0 1px 0 rgba(255, 255, 255, 0.025) inset !important;
}

html.${DARK_PAGE_CLASS} .gsc-webResult.gsc-result:hover {
	background: color-mix(in srgb, var(--accent, #2f383e) 45%, transparent) !important;
	border-color: color-mix(in srgb, var(--primary, #fc8f22) 45%, var(--border, #30353a)) !important;
	transition: background-color 120ms ease, border-color 120ms ease !important;
}

html.${DARK_PAGE_CLASS} .gsc-webResult-divider {
	display: none !important;
}

html.${DARK_PAGE_CLASS} .gs-title,
html.${DARK_PAGE_CLASS} .gs-title *,
html.${DARK_PAGE_CLASS} .gsc-result .gs-title,
html.${DARK_PAGE_CLASS} .gsc-result .gs-title * {
	color: var(--primary, #fc8f22) !important;
	font-size: 21px !important;
	font-weight: 650 !important;
	line-height: 1.25 !important;
	text-decoration: none !important;
}

html.${DARK_PAGE_CLASS} .gs-title:hover,
html.${DARK_PAGE_CLASS} .gs-title:hover * {
	color: color-mix(in srgb, var(--primary, #fc8f22) 82%, var(--foreground, #e7e9ea)) !important;
}

html.${DARK_PAGE_CLASS} .gs-visibleUrl,
html.${DARK_PAGE_CLASS} .gs-visibleUrl-long,
html.${DARK_PAGE_CLASS} .gsc-url-top,
html.${DARK_PAGE_CLASS} .gsc-url-bottom {
	color: var(--muted-foreground, #9aa6ad) !important;
	font-size: 13px !important;
	line-height: 1.4 !important;
	margin-top: 4px !important;
}

html.${DARK_PAGE_CLASS} .gsc-url-top {
	margin-bottom: 8px !important;
}

html.${DARK_PAGE_CLASS} .gs-snippet,
html.${DARK_PAGE_CLASS} .gs-bidi-start-align,
html.${DARK_PAGE_CLASS} .gsc-result-info,
html.${DARK_PAGE_CLASS} .gsc-orderby-label {
	color: var(--foreground, #d7dde1) !important;
}

html.${DARK_PAGE_CLASS} .gs-snippet {
	font-size: 15px !important;
	line-height: 1.55 !important;
}

html.${DARK_PAGE_CLASS} .gs-snippet b,
html.${DARK_PAGE_CLASS} .gs-title b {
	color: color-mix(in srgb, var(--primary, #fc8f22) 70%, var(--foreground, #e7e9ea)) !important;
	font-weight: 750 !important;
}

html.${DARK_PAGE_CLASS} .gsc-result-info {
	margin: 14px 0 12px !important;
	padding: 0 !important;
	font-size: 14px !important;
	font-weight: 600 !important;
	color: var(--muted-foreground, #9aa6ad) !important;
}

html.${DARK_PAGE_CLASS} .gsc-above-wrapper-area {
	margin: 0 !important;
	padding: 0 !important;
	border: 0 !important;
}

html.${DARK_PAGE_CLASS} .gsc-table-result,
html.${DARK_PAGE_CLASS} .gsc-thumbnail-inside,
html.${DARK_PAGE_CLASS} .gsc-url-top,
html.${DARK_PAGE_CLASS} .gsc-table-cell-snippet-close {
	padding-left: 0 !important;
	padding-right: 0 !important;
}

html.${DARK_PAGE_CLASS} .gsc-cursor-box {
	display: flex !important;
	justify-content: center !important;
	gap: 6px !important;
	margin-top: 22px !important;
	padding-top: 8px !important;
}

html.${DARK_PAGE_CLASS} .gsc-cursor-page {
	display: inline-flex !important;
	align-items: center !important;
	justify-content: center !important;
	min-width: 24px !important;
	height: 24px !important;
	border: 1px solid var(--border, #30353a) !important;
	border-radius: 6px !important;
	background: var(--secondary, #252c31) !important;
	color: var(--foreground, #e7e9ea) !important;
	font-weight: 600 !important;
	text-decoration: none !important;
	opacity: 1 !important;
}

html.${DARK_PAGE_CLASS} .gsc-cursor-page:hover {
	border-color: var(--primary, #fc8f22) !important;
	color: var(--primary, #fc8f22) !important;
}

html.${DARK_PAGE_CLASS} .gsc-cursor-current-page {
	background: var(--primary, #fc8f22) !important;
	border-color: var(--primary, #fc8f22) !important;
	color: var(--primary-foreground, #101213) !important;
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary, #fc8f22) 28%, transparent) !important;
}

html.${DARK_PAGE_CLASS} .gcsc-more-maybe-branding-root {
	margin-top: 18px !important;
	text-align: center !important;
}

html.${DARK_PAGE_CLASS} .gcsc-find-more-on-google {
	display: inline-flex !important;
	align-items: center !important;
	gap: 4px !important;
	padding: 7px 10px !important;
	border: 1px solid var(--border, #30353a) !important;
	border-radius: 999px !important;
	background: var(--secondary, #252c31) !important;
	color: var(--muted-foreground, #9aa6ad) !important;
}

@media (max-width: 720px) {
	html.${DARK_PAGE_CLASS} .gsc-control-cse {
		margin: 12px 8px 24px !important;
		padding: 16px !important;
	}

	html.${DARK_PAGE_CLASS} .gsc-result,
	html.${DARK_PAGE_CLASS} .gsc-webResult.gsc-result {
		padding: 15px !important;
	}

	html.${DARK_PAGE_CLASS} .gs-title,
	html.${DARK_PAGE_CLASS} .gs-title *,
	html.${DARK_PAGE_CLASS} .gsc-result .gs-title,
	html.${DARK_PAGE_CLASS} .gsc-result .gs-title * {
		font-size: 18px !important;
	}
}
`

export function enhanceSearchResultsPage(): void {
	if (window.location.pathname !== '/buscar') return

	syncDarkPageClass()
	injectSearchResultsStyles()
	enhanceSearchIconClickArea()

	const observer = new MutationObserver(() => enhanceSearchIconClickArea())
	observer.observe(document.body, { childList: true, subtree: true })

	window.setTimeout(syncDarkPageClass, 250)
	window.setTimeout(syncDarkPageClass, 1000)
	window.setTimeout(() => observer.disconnect(), 15000)
}

function injectSearchResultsStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = searchResultsCss
	document.head.appendChild(style)
}

function enhanceSearchIconClickArea(): void {
	const inputBox = document.querySelector<HTMLElement>('.gsc-input-box')
	const input = inputBox?.querySelector<HTMLInputElement>('input.gsc-input, input')
	if (!inputBox || !input || inputBox.dataset.mvpIconHitbox === 'true') return

	inputBox.dataset.mvpIconHitbox = 'true'

	const button = document.createElement('button')
	button.type = 'button'
	button.className = SEARCH_ICON_HITBOX_CLASS
	button.title = 'Buscar'
	button.setAttribute('aria-label', 'Buscar')
	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		submitNativeSearch(input)
	})
	inputBox.appendChild(button)

	const deadzone = document.createElement('button')
	deadzone.type = 'button'
	deadzone.className = SEARCH_ICON_DEADZONE_CLASS
	deadzone.tabIndex = -1
	deadzone.setAttribute('aria-hidden', 'true')
	const focusInput = (event: MouseEvent | PointerEvent) => {
		event.preventDefault()
		event.stopPropagation()
		input.focus()
		const position = input.value.length
		input.setSelectionRange(position, position)
	}
	for (const eventName of ['pointerdown', 'mousedown', 'mouseup', 'click'] as const) {
		deadzone.addEventListener(eventName, focusInput)
	}
	inputBox.appendChild(deadzone)

	const stopNativeSearchOutsideIcon = (event: MouseEvent | PointerEvent) => {
		const boxRect = inputBox.getBoundingClientRect()
		const localX = event.clientX - boxRect.left
		if (localX > SEARCH_ICON_CLICK_WIDTH) {
			event.stopImmediatePropagation()
		}
	}

	for (const eventName of ['pointerdown', 'mousedown', 'mouseup', 'click'] as const) {
		input.addEventListener(eventName, stopNativeSearchOutsideIcon, true)
	}
}

function submitNativeSearch(input: HTMLInputElement): void {
	const button = document.querySelector<HTMLButtonElement>('button.gsc-search-button-v2')
	if (button) {
		button.click()
		return
	}

	const form = input.closest('form')
	if (form) {
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		return
	}

	if (input.value.trim()) {
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
	}
}

function syncDarkPageClass(): void {
	document.documentElement.classList.toggle(DARK_PAGE_CLASS, isDarkSearchPage())
}

function isDarkSearchPage(): boolean {
	if (document.documentElement.classList.contains('dark')) return true

	const bg = getComputedStyle(document.body).backgroundColor
	const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
	if (!match) return false

	const r = Number(match[1])
	const g = Number(match[2])
	const b = Number(match[3])
	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
	return luminance < 90
}
