import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants'
import { generateId } from '@/lib/id-generator'
import { browser } from 'wxt/browser'
import type { ContentRule, ContentRuleCreateInput, ContentRuleUpdateInput } from './types'

const MATCH_TITLE_MAX_LENGTH = 100
const MATCH_AUTHOR_MAX_LENGTH = 12

const CONTENT_RULES_KEY = `local:${STORAGE_KEYS.CONTENT_RULES}` as const
const CONTENT_RULES_STORAGE_KEY = STORAGE_KEYS.CONTENT_RULES

export const contentRulesStorage = storage.defineItem<ContentRule[]>(CONTENT_RULES_KEY, {
	defaultValue: [],
})

function sortRules(rules: ContentRule[]): ContentRule[] {
	return [...rules].sort((a, b) => b.updatedAt - a.updatedAt)
}

function normalizeRuleInput(input: ContentRuleCreateInput): ContentRuleCreateInput {
	return {
		...input,
		name: input.name.trim(),
		matchTitle: input.matchTitle.trim().slice(0, MATCH_TITLE_MAX_LENGTH),
		matchAuthor: input.matchAuthor.trim().slice(0, MATCH_AUTHOR_MAX_LENGTH),
		subforumIds: Array.from(new Set(input.subforumIds.map(id => id.trim()).filter(Boolean))),
		highlightColor: input.highlightColor?.trim() || undefined,
	}
}

export async function getContentRules(): Promise<ContentRule[]> {
	return sortRules(await contentRulesStorage.getValue())
}

export async function saveContentRules(rules: ContentRule[]): Promise<void> {
	await contentRulesStorage.setValue(sortRules(rules))
}

export async function createContentRule(input: ContentRuleCreateInput): Promise<ContentRule> {
	const rules = await getContentRules()
	const now = Date.now()
	const normalized = normalizeRuleInput(input)
	const rule: ContentRule = {
		...normalized,
		id: generateId(),
		createdAt: now,
		updatedAt: now,
	}

	await saveContentRules([rule, ...rules])
	return rule
}

export async function updateContentRule(id: string, updates: ContentRuleUpdateInput): Promise<ContentRule | null> {
	const rules = await getContentRules()
	const index = rules.findIndex(rule => rule.id === id)
	if (index === -1) return null
	const updateKeys = Object.keys(updates)
	const onlyEnabledChanged = updateKeys.length === 1 && updateKeys[0] === 'enabled'

	const nextRule: ContentRule = {
		...rules[index],
		...updates,
		updatedAt: onlyEnabledChanged ? rules[index].updatedAt : Date.now(),
	}

	const normalized = normalizeRuleInput(nextRule)
	rules[index] = { ...nextRule, ...normalized }
	await saveContentRules(rules)
	return rules[index]
}

export async function deleteContentRule(id: string): Promise<boolean> {
	const rules = await getContentRules()
	const nextRules = rules.filter(rule => rule.id !== id)
	if (nextRules.length === rules.length) return false
	await saveContentRules(nextRules)
	return true
}

export async function deleteContentRules(ids: string[]): Promise<number> {
	const idsToDelete = new Set(ids)
	if (idsToDelete.size === 0) return 0

	const rules = await getContentRules()
	const nextRules = rules.filter(rule => !idsToDelete.has(rule.id))
	const deletedCount = rules.length - nextRules.length
	if (deletedCount === 0) return 0

	await saveContentRules(nextRules)
	return deletedCount
}

export async function duplicateContentRule(id: string): Promise<ContentRule | null> {
	const rules = await getContentRules()
	const original = rules.find(rule => rule.id === id)
	if (!original) return null

	return createContentRule({
		name: `${original.name} (copia)`,
		enabled: original.enabled,
		action: original.action,
		matchTitle: original.matchTitle,
		matchAuthor: original.matchAuthor,
		subforumIds: original.subforumIds,
		highlightColor: original.highlightColor,
	})
}

export async function clearContentRules(): Promise<void> {
	await contentRulesStorage.setValue([])
}

export function watchContentRules(callback: (rules: ContentRule[]) => void): () => void {
	const unwatchItem = contentRulesStorage.watch(newValue => {
		callback(sortRules(newValue || []))
	})

	const handleBrowserStorageChange = (
		changes: Record<string, { newValue?: unknown }>,
		areaName: string
	) => {
		if (areaName !== 'local' || !(CONTENT_RULES_STORAGE_KEY in changes)) return
		const newValue = changes[CONTENT_RULES_STORAGE_KEY]?.newValue
		callback(sortRules(Array.isArray(newValue) ? (newValue as ContentRule[]) : []))
	}

	browser.storage?.onChanged?.addListener?.(handleBrowserStorageChange)

	return () => {
		unwatchItem()
		browser.storage?.onChanged?.removeListener?.(handleBrowserStorageChange)
	}
}
