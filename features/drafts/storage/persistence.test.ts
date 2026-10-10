import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storage } from '#imports'
import { STORAGE_KEYS } from '@/constants/storage-keys'
import { setCompressed } from '@/lib/storage/compressed-storage'
import { mockBrowser } from '../../../tests/setup'
import { createDraft, getDrafts, createFolder, updateDraft, deleteDraft, duplicateDraft, convertDraftType, moveDraftToFolder, moveDraftsToFolder, deleteFolder, getFolders, deleteDrafts, updateFolder, onDraftsChanged, type DraftsData } from './index'
import { setupStorageHandlers } from '@/entrypoints/background/storage-handlers'

const handlers = vi.hoisted(() => new Map<string, (message: { data: any }) => Promise<unknown>>())
vi.mock('@/lib/messaging', () => ({
	onMessage: vi.fn((name: string, handler: (message: { data: any }) => Promise<unknown>) => handlers.set(name, handler)),
	sendMessage: vi.fn(async (name: string, data: unknown) => {
		const handler = handlers.get(name)
		if (!handler) throw new Error(`Missing handler: ${name}`)
		return handler({ data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)) })
	}),
}))

vi.mock('@wxt-dev/storage', async () => ({ storage: (await import('#imports')).storage }))

describe('draft persistence', () => {
	beforeEach(() => {
		mockBrowser.storage.local._setStore({})
		handlers.clear()
		setupStorageHandlers()
	})

	it('keeps both drafts when independent callers save concurrently', async () => {
		await setCompressed(`local:${STORAGE_KEYS.DRAFTS}`, { drafts: [], folders: [] })
		await Promise.all([
			createDraft({ title: 'First', content: 'First text', type: 'draft' }),
			createDraft({ title: 'Second', content: 'Second text', type: 'draft' }),
		])
		expect((await getDrafts()).map(draft => draft.title).sort()).toEqual(['First', 'Second'])
	})

	it('does not reuse a mutable empty default after storage is cleared', async () => {
		await createDraft({ title: 'Old', content: 'Text', type: 'draft' })
		mockBrowser.storage.local._setStore({})
		await createDraft({ title: 'New', content: 'Text', type: 'draft' })
		expect((await getDrafts()).map(draft => draft.title)).toEqual(['New'])
	})

	it('serializes folder creation with draft edits and handles all mutation operations', async () => {
		const draft = await createDraft({ title: 'Original', content: 'Text', type: 'draft' })
		const [folder] = await Promise.all([
			createFolder({ name: 'Folder', icon: 'F' }),
			updateDraft(draft.id, { content: 'Edited' }),
		])
		await updateFolder(folder.id, { name: 'Renamed' })
		expect((await getFolders())[0].name).toBe('Renamed')
		await moveDraftToFolder(draft.id, folder.id)
		const copy = await duplicateDraft(draft.id)
		expect(copy?.title).toBe('Original (copia)')
		expect(copy?.content).toBe('Edited')
		await convertDraftType(draft.id)
		expect((await getDrafts()).find(item => item.id === draft.id)?.type).toBe('template')
		expect(await moveDraftsToFolder([draft.id, copy!.id], undefined)).toBe(2)
		expect((await getDrafts()).every(item => item.folderId === undefined)).toBe(true)
		await moveDraftToFolder(draft.id, folder.id)
		await deleteFolder(folder.id)
		expect((await getDrafts()).find(item => item.id === draft.id)?.folderId).toBeUndefined()
		expect(await deleteDraft(copy!.id)).toBe(true)
		expect(await deleteDrafts([draft.id])).toBe(1)
		expect(await getDrafts()).toEqual([])
	})

	it('allows later writes after one caller fails to save', async () => {
		vi.mocked(storage.setItem).mockRejectedValueOnce(new Error('quota'))
		const results = await Promise.allSettled([
			createDraft({ title: 'Failed', content: 'Text', type: 'draft' }),
			createDraft({ title: 'Saved', content: 'Text', type: 'draft' }),
		])
		expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
		expect((await getDrafts()).map(draft => draft.title)).toEqual(['Saved'])
	})

	it('preserves explicit optional-field clears across Chrome JSON messaging', async () => {
		const draft = await createDraft({ title: 'Template', content: 'Text', type: 'template', trigger: 'hello', subforum: 'cine', category: '1' })
		await updateDraft(draft.id, { trigger: undefined, subforum: undefined, category: undefined })
		const saved = (await getDrafts())[0]
		expect(saved.trigger).toBeUndefined()
		expect(saved.subforum).toBeUndefined()
		expect(saved.category).toBeUndefined()
		const folder = await createFolder({ name: 'Folder', icon: 'F', color: '#123456' })
		await updateFolder(folder.id, { color: undefined })
		expect((await getFolders())[0].color).toBeUndefined()
	})

	it.each(['broken', { drafts: [null], folders: [] }, '__LZB64__invalid'])(
		'refuses to overwrite damaged stored drafts: %j', async value => {
			await storage.setItem(`local:${STORAGE_KEYS.DRAFTS}`, value)
			await expect(createDraft({ title: 'New', content: 'Text', type: 'draft' })).rejects.toThrow()
			expect(await storage.getItem(`local:${STORAGE_KEYS.DRAFTS}`)).toEqual(value)
		},
	)

	it('normalizes legacy missing content, type and timestamps when reading', async () => {
		await setCompressed(`local:${STORAGE_KEYS.DRAFTS}`, { drafts: [{ id: 'legacy', title: 'Legacy' }], folders: [] })
		expect(await getDrafts()).toEqual([{ id: 'legacy', title: 'Legacy', content: '', type: 'draft', createdAt: 0, updatedAt: 0 }])
	})

	it('notifies watchers with validated draft data after a compressed write', async () => {
		let stopWatching = () => {}
		const changed = new Promise<DraftsData>(resolve => { stopWatching = onDraftsChanged(resolve) })
		await createDraft({ title: 'Watched', content: 'Text', type: 'draft' })
		const data = await changed
		stopWatching()
		expect(data.drafts[0].title).toBe('Watched')
		expect(data.folders).toEqual([])
	})
})
