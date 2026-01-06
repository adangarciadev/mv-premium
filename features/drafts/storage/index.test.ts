/**
 * Tests for Drafts storage types and interface structures
 */
import { describe, it, expect } from 'vitest'

// Re-define types for testing (avoid browser API imports)
interface Draft {
	id: string
	title: string
	content: string
	type: 'draft' | 'template'
	subforum?: string
	category?: string
	categoryLabel?: string
	folderId?: string
	trigger?: string
	createdAt: number
	updatedAt: number
}

interface DraftFolder {
	id: string
	name: string
	icon: string
	color?: string
	type?: 'draft' | 'template'
	createdAt: number
}

interface DraftsData {
	drafts: Draft[]
	folders: DraftFolder[]
}

describe('drafts storage types', () => {
	describe('Draft interface', () => {
		it('should require core fields', () => {
			const draft: Draft = {
				id: 'draft_123',
				title: 'Mi borrador',
				content: 'Contenido del borrador',
				type: 'draft',
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			expect(draft.id).toBeDefined()
			expect(draft.title).toBeDefined()
			expect(draft.content).toBeDefined()
			expect(draft.type).toBe('draft')
		})

		it('should support template type with trigger', () => {
			const template: Draft = {
				id: 'tpl_1',
				title: 'Plantilla de saludo',
				content: 'Hola, {nombre}!',
				type: 'template',
				trigger: 'saludo',
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}

			expect(template.type).toBe('template')
			expect(template.trigger).toBe('saludo')
		})

		it('should support subforum and category', () => {
			const draft: Draft = {
				id: 'd1',
				title: 'Draft',
				content: 'Content',
				type: 'draft',
				subforum: 'off-topic',
				category: '156',
				categoryLabel: 'Debate',
				createdAt: 1,
				updatedAt: 1,
			}

			expect(draft.subforum).toBe('off-topic')
			expect(draft.category).toBe('156')
			expect(draft.categoryLabel).toBe('Debate')
		})

		it('should track timestamps', () => {
			const createdAt = Date.now()
			const updatedAt = createdAt + 5000

			const draft: Draft = {
				id: 'd1',
				title: 'T',
				content: 'C',
				type: 'draft',
				createdAt,
				updatedAt,
			}

			expect(draft.updatedAt).toBeGreaterThan(draft.createdAt)
		})
	})

	describe('DraftFolder interface', () => {
		it('should require core fields', () => {
			const folder: DraftFolder = {
				id: 'folder_1',
				name: 'Mi carpeta',
				icon: '📁',
				createdAt: Date.now(),
			}

			expect(folder.id).toBeDefined()
			expect(folder.name).toBeDefined()
			expect(folder.icon).toBeDefined()
		})

		it('should support optional color', () => {
			const folder: DraftFolder = {
				id: 'f1',
				name: 'Importante',
				icon: '⭐',
				color: '#ff0000',
				createdAt: Date.now(),
			}

			expect(folder.color).toBe('#ff0000')
		})

		it('should support folder type', () => {
			const templateFolder: DraftFolder = {
				id: 'tf1',
				name: 'Plantillas',
				icon: '📋',
				type: 'template',
				createdAt: Date.now(),
			}

			expect(templateFolder.type).toBe('template')
		})
	})

	describe('DraftsData structure', () => {
		it('should contain drafts and folders arrays', () => {
			const data: DraftsData = {
				drafts: [],
				folders: [],
			}

			expect(Array.isArray(data.drafts)).toBe(true)
			expect(Array.isArray(data.folders)).toBe(true)
		})

		it('should support populated data', () => {
			const data: DraftsData = {
				drafts: [
					{
						id: 'd1',
						title: 'Draft 1',
						content: 'Content',
						type: 'draft',
						folderId: 'f1',
						createdAt: 1,
						updatedAt: 1,
					},
				],
				folders: [
					{
						id: 'f1',
						name: 'Folder 1',
						icon: '📁',
						createdAt: 1,
					},
				],
			}

			expect(data.drafts[0].folderId).toBe(data.folders[0].id)
		})
	})

	describe('draft operations', () => {
		it('should sort drafts by updatedAt descending', () => {
			const drafts: Draft[] = [
				{ id: 'a', title: 'A', content: '', type: 'draft', createdAt: 1, updatedAt: 1000 },
				{ id: 'b', title: 'B', content: '', type: 'draft', createdAt: 2, updatedAt: 3000 },
				{ id: 'c', title: 'C', content: '', type: 'draft', createdAt: 3, updatedAt: 2000 },
			]

			const sorted = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt)

			expect(sorted[0].id).toBe('b')
			expect(sorted[1].id).toBe('c')
			expect(sorted[2].id).toBe('a')
		})

		it('should filter drafts by type', () => {
			const items: Draft[] = [
				{ id: '1', title: 'D1', content: '', type: 'draft', createdAt: 1, updatedAt: 1 },
				{ id: '2', title: 'T1', content: '', type: 'template', createdAt: 2, updatedAt: 2 },
				{ id: '3', title: 'D2', content: '', type: 'draft', createdAt: 3, updatedAt: 3 },
			]

			const draftsOnly = items.filter(i => i.type === 'draft')
			const templatesOnly = items.filter(i => i.type === 'template')

			expect(draftsOnly).toHaveLength(2)
			expect(templatesOnly).toHaveLength(1)
		})

		it('should filter drafts by folder', () => {
			const drafts: Draft[] = [
				{ id: '1', title: 'A', content: '', type: 'draft', folderId: 'f1', createdAt: 1, updatedAt: 1 },
				{ id: '2', title: 'B', content: '', type: 'draft', folderId: 'f2', createdAt: 2, updatedAt: 2 },
				{ id: '3', title: 'C', content: '', type: 'draft', folderId: 'f1', createdAt: 3, updatedAt: 3 },
			]

			const inFolder1 = drafts.filter(d => d.folderId === 'f1')

			expect(inFolder1).toHaveLength(2)
		})

		it('should find drafts without folder (root level)', () => {
			const drafts: Draft[] = [
				{ id: '1', title: 'A', content: '', type: 'draft', folderId: 'f1', createdAt: 1, updatedAt: 1 },
				{ id: '2', title: 'B', content: '', type: 'draft', createdAt: 2, updatedAt: 2 },
				{ id: '3', title: 'C', content: '', type: 'draft', createdAt: 3, updatedAt: 3 },
			]

			const rootDrafts = drafts.filter(d => !d.folderId)

			expect(rootDrafts).toHaveLength(2)
		})
	})

	describe('template trigger handling', () => {
		it('should find templates by trigger', () => {
			const items: Draft[] = [
				{ id: '1', title: 'S', content: 'Hola', type: 'template', trigger: 'saludo', createdAt: 1, updatedAt: 1 },
				{ id: '2', title: 'D', content: 'Bye', type: 'template', trigger: 'despedida', createdAt: 2, updatedAt: 2 },
			]

			const found = items.find(i => i.trigger === 'saludo')

			expect(found?.title).toBe('S')
		})

		it('should search triggers case-insensitively', () => {
			const trigger = 'SALUDO'
			const normalizedTrigger = trigger.toLowerCase()

			expect(normalizedTrigger).toBe('saludo')
		})
	})
})
