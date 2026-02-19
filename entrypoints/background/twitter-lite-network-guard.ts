import { storage } from '#imports'
import { browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants'
import { logger } from '@/lib/logger'
import { TWITTER_LITE_ALLOW_PARAM, TWITTER_LITE_ALLOW_VALUE } from '@/lib/content-modules/twitter-lite/utils'

const settingsStorageItem = storage.defineItem<string | null>(`local:${STORAGE_KEYS.SETTINGS}`, {
	defaultValue: null,
})

const RULE_ID_ALLOW_EMBED_FRAME = 61001
const RULE_ID_ALLOW_EMBED_RESOURCES = 61002
const RULE_ID_BLOCK_TWITTER_EMBEDS = 61003

type DnrRuleActionType = 'allow' | 'block'
type DnrResourceType =
	| 'sub_frame'
	| 'script'
	| 'stylesheet'
	| 'image'
	| 'font'
	| 'xmlhttprequest'
	| 'media'
	| 'object'
	| 'ping'
	| 'other'

interface DnrRuleCondition {
	urlFilter: string
	resourceTypes: DnrResourceType[]
	initiatorDomains?: string[]
}

interface DnrRule {
	id: number
	priority: number
	action: {
		type: DnrRuleActionType
	}
	condition: DnrRuleCondition
}

interface DeclarativeNetRequestApi {
	updateDynamicRules: (options: { removeRuleIds: number[]; addRules?: DnrRule[] }) => Promise<void>
}

interface PersistedSettingsState {
	state?: {
		twitterLiteEmbedsEnabled?: boolean
	}
}

const COMMON_TWITTER_RESOURCE_TYPES: DnrResourceType[] = [
	'sub_frame',
	'script',
	'stylesheet',
	'image',
	'font',
	'xmlhttprequest',
	'media',
	'object',
	'ping',
	'other',
]

function parseTwitterLiteEnabled(rawSettings: string | null): boolean {
	if (!rawSettings) return false

	try {
		const parsed = JSON.parse(rawSettings) as PersistedSettingsState
		return parsed.state?.twitterLiteEmbedsEnabled === true
	} catch (error) {
		logger.warn('Failed to parse settings for twitter lite network guard', error)
		return false
	}
}

function buildStrictTwitterLiteRules(): DnrRule[] {
	return [
		{
			id: RULE_ID_ALLOW_EMBED_FRAME,
			priority: 3,
			action: { type: 'allow' },
			condition: {
				urlFilter: `||platform.twitter.com/embed/*${TWITTER_LITE_ALLOW_PARAM}=${TWITTER_LITE_ALLOW_VALUE}*`,
				resourceTypes: ['sub_frame'],
			},
		},
		{
			id: RULE_ID_ALLOW_EMBED_RESOURCES,
			priority: 2,
			action: { type: 'allow' },
			condition: {
				urlFilter: '||platform.twitter.com/*',
				initiatorDomains: ['platform.twitter.com'],
				resourceTypes: COMMON_TWITTER_RESOURCE_TYPES,
			},
		},
		{
			id: RULE_ID_BLOCK_TWITTER_EMBEDS,
			priority: 1,
			action: { type: 'block' },
			condition: {
				urlFilter: '||platform.twitter.com/*',
				initiatorDomains: ['www.mediavida.com', 'platform.twitter.com'],
				resourceTypes: COMMON_TWITTER_RESOURCE_TYPES,
			},
		},
	]
}

async function syncTwitterLiteNetworkGuard(rawSettings: string | null): Promise<void> {
	try {
		const dnr = (browser as unknown as { declarativeNetRequest?: DeclarativeNetRequestApi }).declarativeNetRequest
		if (!dnr) {
			logger.debug('DeclarativeNetRequest API unavailable; skipping twitter lite strict network guard')
			return
		}

		const removeRuleIds = [RULE_ID_ALLOW_EMBED_FRAME, RULE_ID_ALLOW_EMBED_RESOURCES, RULE_ID_BLOCK_TWITTER_EMBEDS]
		const strictEnabled = parseTwitterLiteEnabled(rawSettings)

		if (!strictEnabled) {
			await dnr.updateDynamicRules({ removeRuleIds })
			return
		}

		await dnr.updateDynamicRules({
			removeRuleIds,
			addRules: buildStrictTwitterLiteRules(),
		})
	} catch (error) {
		logger.warn('Failed to sync twitter lite strict network guard rules', error)
	}
}

/**
 * Keeps strict Twitter Lite network rules in sync with user settings.
 * When enabled, platform.twitter.com is blocked by default and only
 * explicitly allowed embed iframes can load (`mvp_allow=1`).
 */
export function setupTwitterLiteNetworkGuard(): void {
	void settingsStorageItem.getValue().then(rawSettings => syncTwitterLiteNetworkGuard(rawSettings))

	settingsStorageItem.watch(newValue => {
		void syncTwitterLiteNetworkGuard(newValue)
	})
}
