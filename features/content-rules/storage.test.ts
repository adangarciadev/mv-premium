import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageValues = vi.hoisted(() => new Map<string, unknown>())

vi.mock('#imports', () => ({
	storage: {
		defineItem: <T,>(key: string, options?: { defaultValue?: T }) => ({
			getValue: vi.fn(() => Promise.resolve((storageValues.get(key) ?? options?.defaultValue) as T)),
			setValue: vi.fn((value: T) => {
				storageValues.set(key, value)
				return Promise.resolve()
			}),
			removeValue: vi.fn(() => {
				storageValues.delete(key)
				return Promise.resolve()
			}),
			watch: vi.fn(() => vi.fn()),
		}),
	},
}))

import {
	clearContentRules,
	createContentRule,
	deleteContentRule,
	deleteContentRules,
	duplicateContentRule,
	getContentRules,
	updateContentRule,
} from './storage'

vi.mock('@/lib/id-generator', () => {
	let counter = 0
	return {
		generateId: () => `rule-${++counter}`,
	}
})

describe('content rules storage', () => {
	beforeEach(async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
		storageValues.clear()
		await clearContentRules()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('creates and lists rules sorted by updatedAt', async () => {
		await createContentRule({
			name: 'Primera',
			enabled: true,
			action: 'hide',
			matchTitle: 'spoiler',
			matchAuthor: '',
			subforumIds: [],
			highlightColor: undefined,
		})

		vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
		await createContentRule({
			name: 'Segunda',
			enabled: true,
			action: 'highlight',
			matchTitle: 'oferta',
			matchAuthor: '',
			subforumIds: ['/foro/juegos'],
			highlightColor: '#f7be58',
		})

		const rules = await getContentRules()
		expect(rules.map(rule => rule.name)).toEqual(['Segunda', 'Primera'])
	})

	it('updates, duplicates and deletes a rule', async () => {
		const created = await createContentRule({
			name: 'Original',
			enabled: true,
			action: 'hide',
			matchTitle: 'tema',
			matchAuthor: '',
			subforumIds: [],
			highlightColor: undefined,
		})

		const updated = await updateContentRule(created.id, { enabled: false, matchAuthor: 'Adan' })
		expect(updated?.enabled).toBe(false)
		expect(updated?.matchAuthor).toBe('Adan')

		const duplicated = await duplicateContentRule(created.id)
		expect(duplicated?.name).toBe('Original (copia)')

		await deleteContentRule(created.id)
		const rules = await getContentRules()
		expect(rules.map(rule => rule.id)).toEqual([duplicated?.id])
	})

	it('does not reorder rules when only toggling enabled', async () => {
		const first = await createContentRule({
			name: 'Primera',
			enabled: true,
			action: 'highlight',
			matchTitle: 'uno',
			matchAuthor: '',
			subforumIds: ['/foro/cine'],
			highlightColor: '#f7be58',
		})

		vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
		const second = await createContentRule({
			name: 'Segunda',
			enabled: true,
			action: 'hide',
			matchTitle: 'dos',
			matchAuthor: '',
			subforumIds: ['/foro/juegos'],
			highlightColor: undefined,
		})

		vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
		await updateContentRule(first.id, { enabled: false })

		const rules = await getContentRules()
		expect(rules.map(rule => rule.id)).toEqual([second.id, first.id])
		expect(rules.find(rule => rule.id === first.id)?.updatedAt).toBe(first.updatedAt)
	})

	it('deletes multiple rules by id in a single update', async () => {
		const first = await createContentRule({
			name: 'Primera',
			enabled: true,
			action: 'highlight',
			matchTitle: 'uno',
			matchAuthor: '',
			subforumIds: ['/foro/cine'],
			highlightColor: '#f7be58',
		})
		const second = await createContentRule({
			name: 'Segunda',
			enabled: false,
			action: 'hide',
			matchTitle: 'dos',
			matchAuthor: '',
			subforumIds: ['/foro/juegos'],
			highlightColor: undefined,
		})
		const third = await createContentRule({
			name: 'Tercera',
			enabled: true,
			action: 'hide',
			matchTitle: 'tres',
			matchAuthor: '',
			subforumIds: ['/foro/television'],
			highlightColor: undefined,
		})

		const deletedCount = await deleteContentRules([first.id, third.id, 'missing-rule'])

		expect(deletedCount).toBe(2)
		expect((await getContentRules()).map(rule => rule.id)).toEqual([second.id])
	})
})
