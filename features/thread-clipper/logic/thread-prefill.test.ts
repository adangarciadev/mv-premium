import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

const storageMap = new Map<string, unknown>()

vi.mock('#imports', () => ({
	storage: {
		getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
		setItem: vi.fn(async (key: string, value: unknown) => {
			storageMap.set(key, value)
		}),
		removeItem: vi.fn(async (key: string) => {
			storageMap.delete(key)
		}),
	},
}))

vi.mock('@/lib/logger', () => ({
	logger: {
		warn: vi.fn(),
	},
}))

vi.mock('@/lib/lazy-toast', () => ({
	toast: {
		success: vi.fn(),
	},
}))

import {
	applyClippedThreadPrefill,
	clearClippedThreadPrefill,
	saveClippedThreadPrefill,
} from './thread-prefill'

const STORAGE_KEY = `local:${STORAGE_KEYS.PENDING_CLIPPED_THREAD_PREFILL}`

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('clipped thread prefill', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		storageMap.clear()
		setPath('/foro/juegos/nuevo-hilo')
	})

	it('applies title and body on new thread pages', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Noticia test')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe(
			'[url=https://example.com]Noticia test[/url]'
		)
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('does not inject extra review controls on Mediavida', async () => {
		document.body.innerHTML = `
			<div id="post-editor">
				<input id="cabecera" />
				<textarea id="cuerpo" name="cuerpo"></textarea>
			</div>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body:
				'[url=https://example.com]Titular completo[/url]\n\n' +
				'[media]https://www.youtube.com/watch?v=abc123[/media]\n\n' +
				'[quote]\nTexto citado\n[/quote]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(true)

		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		expect(document.getElementById('mvp-thread-clipper-review')).toBeNull()
		expect(textarea.value).toContain('[url=https://example.com]Titular completo[/url]')
		expect(textarea.value).toContain('[media]https://www.youtube.com/watch?v=abc123[/media]')
		expect(textarea.value).toContain('Texto citado')
	})

	it('keeps pending data when the editor is not ready yet', async () => {
		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
	})

	it('keeps pending data on a different new-thread subforum', async () => {
		setPath('/foro/cine/nuevo-hilo')
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
	})

	it('does not overwrite existing user input', async () => {
		document.body.innerHTML = `
			<input id="cabecera" value="Mi titulo" />
			<textarea id="cuerpo" name="cuerpo">Mi texto</textarea>
		`

		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Mi titulo')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Mi texto')
	})

	it('ignores expired prefill data', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		storageMap.set(STORAGE_KEY, {
			subforum: 'juegos',
			title: 'Old',
			body: 'Old body',
			sourceUrl: 'https://example.com',
			createdAt: Date.now() - 20 * 60 * 1000,
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('clears invalid prefill data on new thread pages', async () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		storageMap.set(STORAGE_KEY, {
			subforum: 'nope',
			title: 'Invalid',
			body: 'Invalid body',
			sourceUrl: 'https://example.com',
			createdAt: Date.now(),
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(false)
	})

	it('keeps pending data outside new thread pages', async () => {
		setPath('/foro/juegos')
		await saveClippedThreadPrefill({
			subforum: 'juegos',
			title: 'Noticia test',
			body: '[url=https://example.com]Noticia test[/url]',
			sourceUrl: 'https://example.com',
		})

		expect(await applyClippedThreadPrefill()).toBe(false)
		expect(storageMap.has(STORAGE_KEY)).toBe(true)
		await clearClippedThreadPrefill()
	})
})
