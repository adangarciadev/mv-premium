import { FeatureFlag, isFeatureEnabled } from '@/lib/feature-flags'
import { getPlatformKind } from '@/lib/platform'
import { initMobileLiteEditorEnhancements, teardownMobileLiteEditorEnhancements } from './editor-lite'
import { initMobileLiteHiddenThreads, teardownMobileLiteHiddenThreads } from './hidden-threads'
import { initMobileLiteIgnoredUsers, teardownMobileLiteIgnoredUsers } from './ignored-users'
import { hasIgnoredUsersImportParam, initMobileLiteIgnoredUsersImport, teardownMobileLiteIgnoredUsersImport } from './ignored-users-import'
import {
	initMobileLiteIgnoredUserThreads,
	isNormalMobileLiteSubforumPath,
	teardownMobileLiteIgnoredUserThreads,
} from './ignored-user-threads'
import { initMobileLitePanel, teardownMobileLitePanel } from './panel'

export interface MobileLiteContext {
	hasEditor: boolean
	hasPosts: boolean
	hasUserCard: boolean
	hasUserMenu: boolean
	hasIgnoredUsersImport: boolean
	isForumRelated: boolean
	isNormalSubforumThreadList: boolean
	pathname: string
}

interface MobileLiteModule {
	id: string
	init: () => void
	teardown: () => void
	shouldRun: (context: MobileLiteContext) => boolean
}

const POST_SELECTOR = '.post[data-num], .rep[data-num], div[id^="post-"]'
const EDITOR_SELECTOR = 'textarea#cuerpo, textarea[name="cuerpo"], .editor-body textarea'
const USER_CARD_SELECTOR = '#user-card, .f-card'
const USER_MENU_SELECTOR = '#usermenu'

const MOBILE_LITE_MODULES: MobileLiteModule[] = [
	{
		id: 'ignored-users-import',
		init: initMobileLiteIgnoredUsersImport,
		teardown: teardownMobileLiteIgnoredUsersImport,
		shouldRun: context => context.hasIgnoredUsersImport,
	},
	{
		id: 'ignored-users',
		init: initMobileLiteIgnoredUsers,
		teardown: teardownMobileLiteIgnoredUsers,
		shouldRun: context => context.hasPosts || context.hasUserCard,
	},
	{
		id: 'ignored-user-threads',
		init: initMobileLiteIgnoredUserThreads,
		teardown: teardownMobileLiteIgnoredUserThreads,
		shouldRun: context => context.isNormalSubforumThreadList,
	},
	{
		id: 'hidden-threads',
		init: initMobileLiteHiddenThreads,
		teardown: teardownMobileLiteHiddenThreads,
		shouldRun: context => context.isNormalSubforumThreadList,
	},
	{
		id: 'editor-lite',
		init: initMobileLiteEditorEnhancements,
		teardown: teardownMobileLiteEditorEnhancements,
		shouldRun: context => context.hasEditor || context.isForumRelated,
	},
	{
		id: 'panel',
		init: initMobileLitePanel,
		teardown: teardownMobileLitePanel,
		shouldRun: context => context.hasUserMenu || context.isForumRelated,
	},
]

export function isMobileLiteAllowed(): boolean {
	return getPlatformKind() === 'firefox-android' && isFeatureEnabled(FeatureFlag.MobileLite)
}

export function getMobileLiteContext(root: ParentNode = document): MobileLiteContext {
	const pathname = window.location.pathname

	return {
		hasEditor: Boolean(root.querySelector(EDITOR_SELECTOR)),
		hasPosts: Boolean(root.querySelector(POST_SELECTOR)),
		hasUserCard: Boolean(root.querySelector(USER_CARD_SELECTOR)),
		hasUserMenu: Boolean(root.querySelector(USER_MENU_SELECTOR)),
		hasIgnoredUsersImport: hasIgnoredUsersImportParam(window.location.search),
		isForumRelated: pathname === '/' || pathname.startsWith('/foro'),
		isNormalSubforumThreadList: isNormalMobileLiteSubforumPath(pathname),
		pathname,
	}
}

export function initMobileLite(context: MobileLiteContext = getMobileLiteContext()): void {
	if (!isMobileLiteAllowed()) return

	for (const module of MOBILE_LITE_MODULES) {
		if (module.shouldRun(context)) module.init()
	}
}

export function teardownMobileLite(): void {
	for (const module of MOBILE_LITE_MODULES) {
		module.teardown()
	}
}

export function getRunnableMobileLiteModuleIds(context: MobileLiteContext = getMobileLiteContext()): string[] {
	if (!isMobileLiteAllowed()) return []
	return MOBILE_LITE_MODULES.filter(module => module.shouldRun(context)).map(module => module.id)
}
