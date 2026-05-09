import { DOM_MARKERS, FEATURE_IDS } from '@/constants'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { logger } from '@/lib/logger'
import { mountFeatureWithBoundary, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import { getSubforumName } from '@/lib/subforums'
import { toast } from '@/lib/lazy-toast'
import { HiddenSubforumBlocker } from '../components/hidden-subforum-blocker'
import { removeEarlyHiddenSubforumBlocker } from './early-guard'
import {
	FORUM_SELECT_LEFT_CLASS,
	FORUM_SELECT_RIGHT_CLASS,
	syncForumSelectColumnClasses,
} from './forum-select-layout'
import { getProfileActivityThreadLink, isUserProfileActivityPath } from './profile-utils'
import { getHiddenSubforumMatch, isSubforumUrlHidden } from './url-utils'
import { getHiddenSubforums, unhideSubforum, watchHiddenSubforums } from './storage'

const HIDDEN_SUBFORUM_CLASS = DOM_MARKERS.CLASSES.HIDDEN_SUBFORUM
const HIDDEN_SUBFORUM_STYLE_ID = DOM_MARKERS.IDS.HIDDEN_SUBFORUM_STYLES
const HIDDEN_SUBFORUM_BLOCKER_ID = DOM_MARKERS.IDS.HIDDEN_SUBFORUM_BLOCKER
const THREAD_ROWS_SELECTOR = 'tbody#temas tr, table#temas tbody tr'
const PROFILE_POST_ROWS_SELECTOR = '.c-eq table#temas.posts tbody tr, .c-eq table.mv.posts tbody tr'
const PROFILE_ACTIVITY_POSTS_SELECTOR = '.c-main > .wpx > .block.cf.post, .c-main > .wpx > .post[id^="post-"]'

let hiddenSubforumIds = new Set<string>()
let initialized = false
let initializationPromise: Promise<void> | null = null
let clickGuardInitialized = false
let unwatchHiddenSubforums: (() => void) | null = null

function isSpyPage(): boolean {
	return window.location.pathname.startsWith('/foro/spy')
}

function ensureHiddenSubforumStyles(): void {
	if (document.getElementById(HIDDEN_SUBFORUM_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = HIDDEN_SUBFORUM_STYLE_ID
	style.textContent = `
		.${HIDDEN_SUBFORUM_CLASS} {
			display: none !important;
		}
		#forum-select > li.${FORUM_SELECT_LEFT_CLASS} > a {
			padding-left: 20px;
			padding-right: 10px;
		}
		#forum-select > li.${FORUM_SELECT_RIGHT_CLASS} > a {
			padding-left: 10px;
			padding-right: 20px;
		}
	`

	document.head.appendChild(style)
}

function applyForumIndexFilter(): void {
	document.querySelectorAll<HTMLAnchorElement>('ul.forums > li > a.forum[href*="/foro/"]').forEach(link => {
		const item = link.closest('li')
		if (!item) return

		item.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(link.href, hiddenSubforumIds))
	})
}

function applyThreadRowFilter(): void {
	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadLink = row.querySelector<HTMLAnchorElement>('a[href*="/foro/"]')
		if (!threadLink) return

		row.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(threadLink.href, hiddenSubforumIds))
	})
}

function applyProfilePostsFilter(): void {
	document.querySelectorAll<HTMLTableRowElement>(PROFILE_POST_ROWS_SELECTOR).forEach(row => {
		const forumLink = row.querySelector<HTMLAnchorElement>('td.autor-avatar a[href*="/foro/"]')
		const threadLink = row.querySelector<HTMLAnchorElement>('td.col-th .thread a[href*="/foro/"]')
		const link = forumLink || threadLink
		if (!link) return

		row.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(link.href, hiddenSubforumIds))
	})
}

function applyProfileActivityPostFilter(): void {
	if (!isUserProfileActivityPath(window.location.pathname)) return

	document.querySelectorAll<HTMLElement>(PROFILE_ACTIVITY_POSTS_SELECTOR).forEach(card => {
		const threadLink = getProfileActivityThreadLink(card)
		if (!threadLink) return

		card.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(threadLink.href, hiddenSubforumIds))
	})
}

function applySidebarLinkFilter(): void {
	document.querySelectorAll<HTMLLIElement>('li.event-entry, li.featured-entry').forEach(item => {
		const link = item.querySelector<HTMLAnchorElement>('a[href*="/foro/"]')
		if (!link) return

		item.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(link.href, hiddenSubforumIds))
	})
}

function applyForumSelectDropdownFilter(): void {
	const menu = document.getElementById('forum-select')
	if (!menu) return

	menu.querySelectorAll<HTMLLIElement>('li').forEach(item => {
		const link = item.querySelector<HTMLAnchorElement>('a[href*="/foro/"]')
		if (!link) return

		item.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(link.href, hiddenSubforumIds))
	})

	syncForumSelectColumnClasses(menu, HIDDEN_SUBFORUM_CLASS)
}

function findHideContainerForLink(link: HTMLAnchorElement): Element | null {
	if (link.closest('.post, .wrap, .pm-content, blockquote, .quote')) {
		return null
	}

	const selectors = [
		'ul.forums > li',
		'.news-item',
		'li.featured-entry',
		'li.event-entry',
		'tbody#temas tr',
		'table#temas tbody tr',
		'li.thread',
		'article.thread',
		'li',
	] as const

	for (const selector of selectors) {
		const container = link.closest(selector)
		if (container) {
			return container
		}
	}

	return null
}

function applyGenericHiddenLinkFilter(): void {
	document.querySelectorAll<HTMLAnchorElement>('a[href*="/foro/"]').forEach(link => {
		const container = findHideContainerForLink(link)
		if (!container) return

		container.classList.toggle(HIDDEN_SUBFORUM_CLASS, isSubforumUrlHidden(link.href, hiddenSubforumIds))
	})
}

function applyHiddenSubforumsFilter(): void {
	if (isSpyPage()) {
		document.querySelectorAll(`.${HIDDEN_SUBFORUM_CLASS}`).forEach(element => {
			element.classList.remove(HIDDEN_SUBFORUM_CLASS)
		})
		return
	}

	ensureHiddenSubforumStyles()
	document.querySelectorAll(`.${HIDDEN_SUBFORUM_CLASS}`).forEach(element => {
		element.classList.remove(HIDDEN_SUBFORUM_CLASS)
	})
	applyForumIndexFilter()
	applyThreadRowFilter()
	applyProfilePostsFilter()
	applyProfileActivityPostFilter()
	applySidebarLinkFilter()
	applyGenericHiddenLinkFilter()
	applyForumSelectDropdownFilter()
}

function getOrCreateBlockerContainer(): HTMLElement {
	const existing = document.getElementById(HIDDEN_SUBFORUM_BLOCKER_ID)
	if (existing) return existing

	const container = document.createElement('div')
	container.id = HIDDEN_SUBFORUM_BLOCKER_ID
	document.body.appendChild(container)
	return container
}

function removeBlocker(): void {
	removeEarlyHiddenSubforumBlocker()
	unmountFeature(FEATURE_IDS.HIDDEN_SUBFORUM_BLOCKER)
	document.getElementById(HIDDEN_SUBFORUM_BLOCKER_ID)?.remove()
}

function syncBlockedPage(): boolean {
	const match = getHiddenSubforumMatch(window.location.pathname, hiddenSubforumIds)

	if (!match) {
		removeBlocker()
		return false
	}

	const subforumName = getSubforumName(match.slug)
	const container = getOrCreateBlockerContainer()
	removeEarlyHiddenSubforumBlocker()

	mountFeatureWithBoundary(
		FEATURE_IDS.HIDDEN_SUBFORUM_BLOCKER,
		container,
		<ShadowWrapper className="fixed inset-0" errorVariant="minimal">
			<HiddenSubforumBlocker
				subforumName={subforumName}
				isThreadAccess={!match.isSubforumRoot}
				onUnhide={async () => {
					await unhideSubforum(match.slug)
					window.location.reload()
				}}
				onBackToForums={() => {
					window.location.href = '/foro'
				}}
			/>
		</ShadowWrapper>,
		'Bloqueo de Subforo Oculto'
	)

	return true
}

function setupClickGuard(): void {
	if (clickGuardInitialized) return
	clickGuardInitialized = true

	document.addEventListener(
		'click',
		event => {
			if (isSpyPage()) return

			const target = event.target as Element | null
			const link = target?.closest<HTMLAnchorElement>('a[href]')
			if (!link) return

			const match = getHiddenSubforumMatch(link.getAttribute('href') || link.href, hiddenSubforumIds)
			if (!match) return

			event.preventDefault()
			event.stopPropagation()

			toast.info(`${getSubforumName(match.slug)} está oculto. Desocúltalo para entrar.`)
		},
		true
	)
}

function updateHiddenSubforumIds(subforums: Awaited<ReturnType<typeof getHiddenSubforums>>): void {
	hiddenSubforumIds = new Set(subforums.map(subforum => subforum.id))
}

export async function initHiddenSubforums(): Promise<{ isPageBlocked: boolean }> {
	if (initialized) {
		applyHiddenSubforumsFilter()
		return { isPageBlocked: isSpyPage() ? false : syncBlockedPage() }
	}

	if (!initializationPromise) {
		initializationPromise = (async () => {
			try {
				updateHiddenSubforumIds(await getHiddenSubforums())
				setupClickGuard()

				if (!unwatchHiddenSubforums) {
					unwatchHiddenSubforums = watchHiddenSubforums(nextSubforums => {
						updateHiddenSubforumIds(nextSubforums)
						applyHiddenSubforumsFilter()
						syncBlockedPage()
					})
				}

				initialized = true
			} catch (error) {
				logger.error('Failed to initialize hidden subforums:', error)
				removeEarlyHiddenSubforumBlocker()
			}
		})()
	}

	try {
		await initializationPromise
	} finally {
		initializationPromise = null
	}

	applyHiddenSubforumsFilter()
	return { isPageBlocked: isSpyPage() ? false : syncBlockedPage() }
}
