/**
 * Offers to register review cards the user published before this feature existed.
 *
 * The control only appears on the user's own posts, and only on posts that actually contain
 * an unregistered card. A post with nothing to import gets no control at all, so the forum
 * gains no permanent furniture from a feature that is used once and then never again.
 */
import { DOM_MARKERS, FEATURE_IDS, MV_SELECTORS } from '@/constants'
import { getThreadInfo } from '@/lib/mv-api'
import { getCurrentUser } from '@/entrypoints/options/lib/current-user'
import { logger } from '@/lib/logger'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { MovieReviewImportDialog } from '../components/movie-review-import-dialog'
import { collectCandidatesInPost, filterByCardShape, type CandidateCard } from './movie-review-import'
import { getMovieReviews } from './movie-review-store'

const BUTTON_CLASS = 'mvp-import-review'
const IMPORT_FEATURE_ID = FEATURE_IDS.MOVIE_REVIEW_IMPORT
const IMPORT_MARKER = DOM_MARKERS.DATA_ATTRS.REVIEW_IMPORT_INJECTED

function closeDialog(): void {
	unmountFeature(IMPORT_FEATURE_ID)
	document.getElementById(IMPORT_FEATURE_ID)?.remove()
}

function openDialog(candidates: CandidateCard[]): void {
	closeDialog()

	const container = document.createElement('div')
	container.id = IMPORT_FEATURE_ID
	document.body.appendChild(container)

	mountFeatureWithBoundary(
		IMPORT_FEATURE_ID,
		container,
		<ShadowWrapper>
			<MovieReviewImportDialog
				isOpen
				onClose={closeDialog}
				candidates={candidates}
				onSaved={() => {
					// The controls are rebuilt from the store on the next injection pass, so the ones
					// whose cards just got registered disappear on their own.
					void injectMovieReviewImportButtons()
				}}
			/>
		</ShadowWrapper>,
		'MovieReviewImportDialog'
	)
}

function createButton(candidates: CandidateCard[]): HTMLLIElement {
	const item = document.createElement('li')
	const button = document.createElement('a')

	button.href = '#'
	button.className = `${MV_SELECTORS.THREAD.POST_BTN.replace('.', '')} ${BUTTON_CLASS}`
	button.title = `Guardar en mis críticas (${candidates.length})`
	button.innerHTML = '<i class="fa fa-star-o"></i>'

	button.addEventListener('click', event => {
		event.preventDefault()
		event.stopPropagation()
		openDialog(candidates)
	})

	item.appendChild(button)
	return item
}

/** Mirrors the summary button's placement so the controls row keeps a consistent order. */
function insertButton(controls: Element, item: HTMLLIElement): void {
	try {
		const pinItem = controls.querySelector('.pin-post')?.parentElement
		if (pinItem && pinItem.parentElement === controls) {
			controls.insertBefore(item, pinItem)
			return
		}

		const replyItem = controls.querySelector('.btn-reply')?.parentElement
		if (replyItem && replyItem.parentElement === controls) {
			controls.insertBefore(item, replyItem)
			return
		}

		controls.appendChild(item)
	} catch {
		// Mediavida rebuilds this row for moderators; losing the control is fine, throwing is not.
	}
}

export async function injectMovieReviewImportButtons(): Promise<void> {
	try {
		const user = await getCurrentUser()
		if (!user?.username) return

		const posts = Array.from(document.querySelectorAll<HTMLElement>(MV_SELECTORS.THREAD.POST)).filter(
			post => (post.dataset.autor || '').toLowerCase() === user.username.toLowerCase()
		)

		// Bail out before touching storage or loading a single image when there is nothing of
		// the user's on screen, which is the common case.
		if (posts.length === 0) return

		const registeredIds = new Set((await getMovieReviews()).map(record => record.imageId))
		const thread = getThreadInfo()
		const threadUrl = `${window.location.origin}${window.location.pathname}`

		for (const post of posts) {
			const controls = post.querySelector('.post-controls .buttons')
			if (!controls) continue

			// Check the DOM rather than only the marker: Mediavida rebuilds this row, which would
			// leave the marker claiming a control that is no longer there.
			const existing = controls.querySelector(`.${BUTTON_CLASS}`)

			const candidates = collectCandidatesInPost(post, user.username, registeredIds)
			if (candidates.length === 0) {
				existing?.parentElement?.remove()
				continue
			}

			if (existing) continue

			const cards = await filterByCardShape(candidates)
			if (cards.length === 0) continue

			post.setAttribute(IMPORT_MARKER, 'true')
			insertButton(controls, createButton(cards.map(card => ({ ...card, threadUrl, threadTitle: thread.title }))))
		}
	} catch (error) {
		logger.error('Fallo al ofrecer la importación de críticas', error)
	}
}
