/**
 * Mobile Lite Post Gestures
 *
 * Swipe a post horizontally to ignore its author without opening the user card:
 *   - swipe LEFT  → Ocultar (hide, destructive convention like mail apps)
 *   - swipe RIGHT → Silenciar (mute)
 *
 * The gesture engages only when the horizontal movement clearly dominates the
 * vertical one, never starts from the screen edges (Firefox Android uses them
 * for back/forward), and requires crossing a visible threshold before acting.
 *
 * The page itself must NEVER pan horizontally: posts get `touch-action: pan-y`
 * so the browser never starts a horizontal viewport pan from them, and the
 * document gets `overflow-x: clip` so the translated post cannot widen it.
 * Listeners on the document are passive; a non-passive touchmove is attached
 * only while a candidate gesture is in flight so scrolling performance on the
 * rest of the page is unaffected.
 */
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { logger } from '@/lib/logger'
import { getPlatformKind } from '@/lib/platform'
import { MOBILE_LITE_IGNORED_ATTR, getMobileLitePostAuthor, setMobileLiteUserIgnore } from './ignored-users'
import { getAvatarUrlFromImage } from './avatar-utils'
import type { MobileLiteIgnoreType } from './ignore-helpers'

const POST_SELECTOR = `${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_REPLY}, ${MV_SELECTORS.THREAD.POST_DIV}`

const STYLE_ID = 'mvp-mobile-lite-post-gestures-styles'
const HINT_ID = 'mvp-mobile-lite-post-gesture-hint'
const HINT_ACTIVE_CLASS = 'mvp-mobile-lite-post-gesture-hint-active'
const HINT_HIDE_CLASS = 'mvp-mobile-lite-post-gesture-hint-hide'

/** Touches starting this close to a screen edge belong to browser navigation */
const EDGE_GUARD_PX = 28
/** Movement below this is noise, not a gesture */
const SLOP_PX = 12
/** Horizontal distance must exceed vertical by this factor to engage */
const DOMINANCE_RATIO = 1.4
/** Commit threshold: fraction of post width, clamped to a sane px range */
const COMMIT_RATIO = 0.3
const MIN_COMMIT_PX = 70
const MAX_COMMIT_PX = 130
/** Drag resistance past the commit point */
const OVERSHOOT_RESISTANCE = 0.35
const SNAP_BACK_MS = 180
/** Slide-out animation before the post collapses */
const EXIT_MS = 180
const CLICK_SUPPRESS_MS = 400

interface GestureState {
	post: HTMLElement
	username: string
	avatarUrl?: string
	startX: number
	startY: number
	commitPx: number
	engaged: boolean
	crossedThreshold: boolean
	dx: number
}

let initialized = false
let gesture: GestureState | null = null
let suppressClicksUntil = 0
let commitTimeout: ReturnType<typeof setTimeout> | null = null
let pendingCommitPost: HTMLElement | null = null
let cachedOwnUsername: string | null | undefined

function isMobileLitePostGesturesAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		/* The viewport must never pan horizontally: posts opt out of native
		   horizontal panning, and the translated post cannot widen the page.
		   (clip does not create a new scroll container, unlike hidden.) */
		html, body {
			overflow-x: clip !important;
			overscroll-behavior-x: none !important;
		}
		${POST_SELECTOR} {
			touch-action: pan-y;
		}
		#${HINT_ID} {
			align-items: center;
			background: #242a36;
			border: 1px solid #2d3442;
			border-radius: 999px;
			box-shadow: 0 2px 6px rgba(0,0,0,0.35);
			color: #8b95a3;
			display: inline-flex;
			font-size: 12px;
			font-weight: 700;
			gap: 6px;
			padding: 8px 14px;
			pointer-events: none;
			position: fixed;
			transform: translateY(-50%);
			transition: opacity 120ms ease;
			white-space: nowrap;
			z-index: 2147483600;
		}
		#${HINT_ID}.${HINT_HIDE_CLASS} {
			opacity: 0;
		}
		#${HINT_ID}[data-action="mute"].${HINT_ACTIVE_CLASS} {
			background: linear-gradient(180deg, rgba(240,160,32,0.22) 0%, rgba(240,160,32,0.07) 100%);
			border-color: rgba(240,160,32,0.25);
			box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.35);
			color: #f0a020;
		}
		#${HINT_ID}[data-action="hide"].${HINT_ACTIVE_CLASS} {
			background: #3a2427;
			border-color: rgba(224,138,138,0.35);
			color: #e08a8a;
		}
	`
	document.head.appendChild(style)
}

function getHintElement(): HTMLElement {
	let hint = document.getElementById(HINT_ID)
	if (!hint) {
		hint = document.createElement('div')
		hint.id = HINT_ID
		hint.classList.add(HINT_HIDE_CLASS)
		hint.setAttribute('aria-hidden', 'true')
		document.body.appendChild(hint)
	}
	return hint
}

function hideHint(): void {
	document.getElementById(HINT_ID)?.classList.add(HINT_HIDE_CLASS)
}

function getActionForDx(dx: number): MobileLiteIgnoreType {
	return dx < 0 ? 'hide' : 'mute'
}

function updateHint(state: GestureState): void {
	const hint = getHintElement()
	const action = getActionForDx(state.dx)
	const rect = state.post.getBoundingClientRect()
	const isActive = Math.abs(state.dx) >= state.commitPx

	hint.dataset.action = action
	hint.textContent = action === 'mute' ? 'Silenciar' : 'Ocultar'
	hint.classList.toggle(HINT_ACTIVE_CLASS, isActive)
	hint.classList.remove(HINT_HIDE_CLASS)
	hint.style.top = `${Math.max(rect.top, 0) + Math.min(rect.height, window.innerHeight - Math.max(rect.top, 0)) / 2}px`

	// The revealed side is opposite to the drag direction
	if (state.dx > 0) {
		hint.style.left = '16px'
		hint.style.right = 'auto'
	} else {
		hint.style.left = 'auto'
		hint.style.right = '16px'
	}
}

function vibrate(pattern: number): void {
	if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
		navigator.vibrate(pattern)
	}
}

function getOwnUsername(): string | null {
	if (cachedOwnUsername !== undefined) return cachedOwnUsername

	const ownLink = document.querySelector<HTMLAnchorElement>('#usermenu a[href^="/id/"]')
	const match = ownLink?.getAttribute('href')?.match(/\/id\/([^/?#]+)/)
	cachedOwnUsername = match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : null
	return cachedOwnUsername
}

function getPostAvatarUrl(post: HTMLElement): string | undefined {
	return getAvatarUrlFromImage(post.querySelector<HTMLImageElement>('.post-avatar img'))
}

/** Elements whose own horizontal panning must win over the gesture */
function isHorizontallyScrollableTarget(target: Element, post: HTMLElement): boolean {
	let element: Element | null = target
	while (element && element !== post) {
		if (element.matches('pre, code, table')) return true
		element = element.parentElement
	}
	return false
}

function resetPostInlineStyles(post: HTMLElement): void {
	post.style.transition = ''
	post.style.transform = ''
	post.style.opacity = ''
	post.style.willChange = ''
}

function snapBackPost(post: HTMLElement): void {
	post.style.transition = `transform ${SNAP_BACK_MS}ms ease`
	post.style.transform = 'translateX(0)'
	setTimeout(() => {
		resetPostInlineStyles(post)
	}, SNAP_BACK_MS)
}

function detachGestureListeners(): void {
	document.removeEventListener('touchmove', handleTouchMove)
	document.removeEventListener('touchend', handleTouchEnd)
	document.removeEventListener('touchcancel', handleTouchCancel)
}

function cancelGesture(animated = false): void {
	if (!gesture) return

	if (gesture.engaged) {
		if (animated) {
			snapBackPost(gesture.post)
		} else {
			resetPostInlineStyles(gesture.post)
		}
		hideHint()
	}
	gesture = null
	detachGestureListeners()
}

function handleTouchStart(event: TouchEvent): void {
	if (!isMobileLitePostGesturesAllowed()) return
	if (gesture) cancelGesture()
	if (event.touches.length !== 1) return

	const touch = event.touches[0]
	if (touch.clientX < EDGE_GUARD_PX || touch.clientX > window.innerWidth - EDGE_GUARD_PX) return

	const target = event.target
	if (!(target instanceof Element)) return
	if (target.closest('textarea, input, select, [contenteditable="true"]')) return

	const post = target.closest<HTMLElement>(POST_SELECTOR)
	if (!post) return
	if (post.hasAttribute(MOBILE_LITE_IGNORED_ATTR)) return
	if (target.closest(`.${DOM_MARKERS.CLASSES.MUTE_PLACEHOLDER}`)) return
	if (isHorizontallyScrollableTarget(target, post)) return

	const username = getMobileLitePostAuthor(post)
	if (!username) return
	if (getOwnUsername() === username.toLowerCase()) return

	const width = post.getBoundingClientRect().width || window.innerWidth
	gesture = {
		post,
		username,
		avatarUrl: getPostAvatarUrl(post),
		startX: touch.clientX,
		startY: touch.clientY,
		commitPx: Math.min(MAX_COMMIT_PX, Math.max(MIN_COMMIT_PX, width * COMMIT_RATIO)),
		engaged: false,
		crossedThreshold: false,
		dx: 0,
	}

	// Non-passive only while this candidate gesture is alive
	document.addEventListener('touchmove', handleTouchMove, { passive: false })
	document.addEventListener('touchend', handleTouchEnd)
	document.addEventListener('touchcancel', handleTouchCancel)
}

function handleTouchMove(event: TouchEvent): void {
	if (!gesture) return
	if (event.touches.length !== 1) {
		cancelGesture()
		return
	}

	const touch = event.touches[0]
	const dx = touch.clientX - gesture.startX
	const dy = touch.clientY - gesture.startY

	if (!gesture.engaged) {
		// Vertical scroll wins as soon as it dominates
		if (Math.abs(dy) > SLOP_PX && Math.abs(dy) >= Math.abs(dx)) {
			cancelGesture()
			return
		}
		if (Math.abs(dx) <= SLOP_PX || Math.abs(dx) < Math.abs(dy) * DOMINANCE_RATIO) {
			return
		}

		gesture.engaged = true
		gesture.post.style.willChange = 'transform'
		gesture.post.style.transition = 'none'
	}

	if (event.cancelable) event.preventDefault()

	const absDx = Math.abs(dx)
	const overshoot = Math.max(0, absDx - gesture.commitPx)
	const visualDx = Math.sign(dx) * (Math.min(absDx, gesture.commitPx) + overshoot * OVERSHOOT_RESISTANCE)

	gesture.dx = dx
	gesture.post.style.transform = `translateX(${visualDx}px)`

	const crossed = absDx >= gesture.commitPx
	if (crossed && !gesture.crossedThreshold) {
		gesture.crossedThreshold = true
		vibrate(20)
	} else if (!crossed) {
		gesture.crossedThreshold = false
	}

	updateHint(gesture)
}

function commitGesture(state: GestureState): void {
	const action = getActionForDx(state.dx)

	hideHint()
	vibrate(30)

	// Slide the post out in the swipe direction, then collapse it via the
	// ignore sync once it is off-screen — no abrupt jump.
	const exitX = Math.sign(state.dx || -1) * Math.max(window.innerWidth, 320)
	state.post.style.transition = `transform ${EXIT_MS}ms ease-in, opacity ${EXIT_MS}ms ease-in`
	state.post.style.transform = `translateX(${exitX}px)`
	state.post.style.opacity = '0'

	pendingCommitPost = state.post
	commitTimeout = setTimeout(() => {
		commitTimeout = null
		pendingCommitPost = null
		resetPostInlineStyles(state.post)
		// setMobileLiteUserIgnore shows the shared confirmation toast
		void setMobileLiteUserIgnore(state.username, action, state.avatarUrl).catch(error => {
			logger.error('Error applying Mobile Lite swipe ignore:', error)
		})
	}, EXIT_MS)
}

function handleTouchEnd(): void {
	if (!gesture) return

	const state = gesture
	gesture = null
	detachGestureListeners()

	if (!state.engaged) return

	suppressClicksUntil = Date.now() + CLICK_SUPPRESS_MS

	if (Math.abs(state.dx) >= state.commitPx) {
		commitGesture(state)
		return
	}

	snapBackPost(state.post)
	hideHint()
}

function handleTouchCancel(): void {
	cancelGesture(true)
}

/** Swallow the synthetic click that follows a committed swipe */
function handleClickCapture(event: MouseEvent): void {
	if (Date.now() >= suppressClicksUntil) return

	suppressClicksUntil = 0
	event.preventDefault()
	event.stopPropagation()
}

export function initMobileLitePostGestures(): void {
	if (!isMobileLitePostGesturesAllowed()) return
	if (initialized) return
	if (!document.body) return

	initialized = true
	ensureStyles()
	document.addEventListener('touchstart', handleTouchStart, { passive: true })
	document.addEventListener('click', handleClickCapture, true)
}

export function teardownMobileLitePostGestures(): void {
	cancelGesture()

	if (commitTimeout) {
		clearTimeout(commitTimeout)
		commitTimeout = null
	}
	if (pendingCommitPost) {
		resetPostInlineStyles(pendingCommitPost)
		pendingCommitPost = null
	}

	document.removeEventListener('touchstart', handleTouchStart)
	document.removeEventListener('click', handleClickCapture, true)
	document.getElementById(HINT_ID)?.remove()
	document.getElementById(STYLE_ID)?.remove()

	suppressClicksUntil = 0
	cachedOwnUsername = undefined
	initialized = false
}
