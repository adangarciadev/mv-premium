/**
 * Mobile Lite Action Toast
 *
 * Single bottom toast for in-page Mobile Lite actions (swipe gestures, user
 * card buttons). Follows the DESIGN.md §6 toast recipe: success colors,
 * anchored above the safe area, auto-dismissed after 3.5s, role="status".
 */

const STYLE_ID = 'mvp-mobile-lite-action-toast-styles'
const TOAST_ID = 'mvp-mobile-lite-action-toast'
const TOAST_HIDE_CLASS = 'mvp-mobile-lite-action-toast-hide'

const TOAST_VISIBLE_MS = 3500
const TOAST_FADE_MS = 250

export interface MobileLiteToastAction {
	label: string
	onAction: () => void
}

let toastTimeout: ReturnType<typeof setTimeout> | null = null

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		#${TOAST_ID} {
			align-items: center;
			animation: mvpMobileLiteActionToastIn 200ms ease;
			background: #0e3320;
			border: 1px solid #2e8a52;
			border-radius: 999px;
			bottom: calc(18px + env(safe-area-inset-bottom, 0px));
			box-shadow: 0 4px 14px rgba(0,0,0,0.45);
			color: #d3f9e0;
			display: inline-flex;
			font-size: 13px;
			font-weight: 600;
			gap: 8px;
			left: 50%;
			max-width: calc(100vw - 32px);
			overflow: hidden;
			padding: 10px 16px;
			pointer-events: none;
			position: fixed;
			text-overflow: ellipsis;
			transform: translateX(-50%);
			transition: opacity ${TOAST_FADE_MS}ms ease, transform ${TOAST_FADE_MS}ms ease;
			white-space: nowrap;
			z-index: 2147483600;
		}
		#${TOAST_ID} i {
			color: #41d97e;
		}
		#${TOAST_ID} > span {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		#${TOAST_ID} .mvp-mobile-lite-action-toast-button {
			background: transparent;
			border: none;
			border-left: 1px solid rgba(65, 217, 126, 0.35);
			color: #41d97e;
			flex-shrink: 0;
			font-size: 12px;
			font-weight: 800;
			letter-spacing: 0.04em;
			/* Negative margins grow the tap target without growing the pill */
			margin: -10px -10px -10px 0;
			padding: 14px 12px 14px 10px;
			pointer-events: auto;
			text-transform: uppercase;
		}
		#${TOAST_ID} .mvp-mobile-lite-action-toast-button:active {
			color: #d3f9e0;
		}
		#${TOAST_ID}.${TOAST_HIDE_CLASS} {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		@keyframes mvpMobileLiteActionToastIn {
			from {
				opacity: 0;
				transform: translateX(-50%) translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateX(-50%) translateY(0);
			}
		}
	`
	document.head.appendChild(style)
}

export function showMobileLiteActionToast(message: string, iconClass = 'fa-check', action?: MobileLiteToastAction): void {
	if (!document.body) return

	ensureStyles()
	document.getElementById(TOAST_ID)?.remove()
	if (toastTimeout) {
		clearTimeout(toastTimeout)
		toastTimeout = null
	}

	const toast = document.createElement('div')
	toast.id = TOAST_ID
	toast.setAttribute('role', 'status')
	toast.innerHTML = `<i class="fa ${iconClass}" aria-hidden="true"></i><span></span>`
	// textContent so a hostile username can never inject markup
	const label = toast.querySelector('span')
	if (label) label.textContent = message

	if (action) {
		const actionButton = document.createElement('button')
		actionButton.type = 'button'
		actionButton.className = 'mvp-mobile-lite-action-toast-button'
		actionButton.textContent = action.label
		actionButton.addEventListener('click', () => {
			// Instant feedback: the action usually shows its own follow-up toast
			if (toastTimeout) {
				clearTimeout(toastTimeout)
				toastTimeout = null
			}
			toast.remove()
			action.onAction()
		})
		toast.appendChild(actionButton)
	}

	document.body.appendChild(toast)

	toastTimeout = setTimeout(() => {
		toastTimeout = null
		toast.classList.add(TOAST_HIDE_CLASS)
		setTimeout(() => toast.remove(), TOAST_FADE_MS)
	}, TOAST_VISIBLE_MS)
}

export function teardownMobileLiteActionToast(): void {
	if (toastTimeout) {
		clearTimeout(toastTimeout)
		toastTimeout = null
	}

	document.getElementById(TOAST_ID)?.remove()
	document.getElementById(STYLE_ID)?.remove()
}
