import { EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { getSubforumName } from '@/lib/subforums'
import { getHiddenSubforumMatch } from './url-utils'

const EARLY_BLOCKER_ID = 'mvp-hidden-subforum-early-blocker'

function getCachedHiddenSubforums(): Set<string> {
	try {
		const raw = localStorage.getItem(RUNTIME_CACHE_KEYS.HIDDEN_SUBFORUMS)
		if (!raw) return new Set()

		const parsed = JSON.parse(raw)
		if (!Array.isArray(parsed)) return new Set()

		return new Set(parsed.filter((item): item is string => typeof item === 'string'))
	} catch {
		return new Set()
	}
}

function ensureEarlyStyles(): void {
	if (document.getElementById(EARLY_STYLE_IDS.HIDDEN_SUBFORUM)) return

	const style = document.createElement('style')
	style.id = EARLY_STYLE_IDS.HIDDEN_SUBFORUM
	style.textContent = `
		#${EARLY_BLOCKER_ID} {
			position: fixed;
			inset: 0;
			z-index: 2147483646;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 16px;
			background: rgba(0, 0, 0, 0.78);
			backdrop-filter: blur(6px);
			color: #f5f7fa;
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		}
		#${EARLY_BLOCKER_ID} .mvp-hidden-subforum-card {
			width: min(560px, 100%);
			border-radius: 16px;
			border: 1px solid rgba(255, 255, 255, 0.12);
			background: rgba(20, 22, 28, 0.96);
			padding: 24px;
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
		}
		#${EARLY_BLOCKER_ID} h2 {
			margin: 0 0 10px;
			font-size: 24px;
			line-height: 1.2;
		}
		#${EARLY_BLOCKER_ID} p {
			margin: 0;
			font-size: 14px;
			line-height: 1.65;
			color: rgba(245, 247, 250, 0.78);
		}
	`

	document.head.appendChild(style)
}

export function showEarlyHiddenSubforumBlocker(pathname = window.location.pathname): boolean {
	const hiddenSubforums = getCachedHiddenSubforums()
	const match = getHiddenSubforumMatch(pathname, hiddenSubforums)
	if (!match) return false

	ensureEarlyStyles()

	if (!document.getElementById(EARLY_BLOCKER_ID)) {
		const blocker = document.createElement('div')
		blocker.id = EARLY_BLOCKER_ID
		blocker.innerHTML = `
			<div class="mvp-hidden-subforum-card">
				<h2>Subforo oculto</h2>
				<p>${getSubforumName(match.slug)} está oculto. Cargando el bloqueo para evitar que entres por impulso...</p>
			</div>
		`
		document.documentElement.appendChild(blocker)
	}

	return true
}

export function removeEarlyHiddenSubforumBlocker(): void {
	document.getElementById(EARLY_BLOCKER_ID)?.remove()
	document.getElementById(EARLY_STYLE_IDS.HIDDEN_SUBFORUM)?.remove()
}
