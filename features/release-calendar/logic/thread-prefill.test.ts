import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'
import {
	applyReleaseThreadPrefill,
	clearReleaseThreadPrefill,
	saveReleaseThreadPrefill,
} from './thread-prefill'

vi.mock('@/lib/logger', () => ({
	logger: {
		warn: vi.fn(),
	},
}))

function setPath(pathname: string) {
	window.history.replaceState({}, '', pathname)
}

describe('release thread prefill', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
		sessionStorage.clear()
		setPath('/foro/juegos/nuevo-hilo')
	})

	it('saves and applies title/body on new thread pages', () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		const titleInput = document.querySelector<HTMLInputElement>('#cabecera')!
		const textarea = document.querySelector<HTMLTextAreaElement>('#cuerpo')!
		const titleInputHandler = vi.fn()
		const textareaInputHandler = vi.fn()
		const textareaChangeHandler = vi.fn()
		titleInput.addEventListener('input', titleInputHandler)
		textarea.addEventListener('input', textareaInputHandler)
		textarea.addEventListener('change', textareaChangeHandler)

		saveReleaseThreadPrefill({
			subforum: 'juegos',
			title: '[Hilo Oficial] Test Game',
			body: '[b]Test Game[/b]',
		})

		expect(applyReleaseThreadPrefill()).toBe(true)
		expect(titleInput.value).toBe('[Hilo Oficial] Test Game')
		expect(textarea.value).toBe('[b]Test Game[/b]')
		expect(titleInputHandler).toHaveBeenCalledTimes(1)
		expect(textareaInputHandler).toHaveBeenCalledTimes(1)
		expect(textareaChangeHandler).toHaveBeenCalledTimes(1)
		expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL)).toBeNull()
	})

	it('supports Cine thread prefills', () => {
		setPath('/foro/cine/nuevo-hilo')
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`

		saveReleaseThreadPrefill({
			subforum: 'cine',
			title: "'La Odisea', de Christopher Nolan (2026)",
			body: '[b]La Odisea[/b]',
		})

		expect(applyReleaseThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe(
			"'La Odisea', de Christopher Nolan (2026)"
		)
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('[b]La Odisea[/b]')
	})

	it('does not overwrite existing user input', () => {
		document.body.innerHTML = `
			<input id="cabecera" value="Mi titulo" />
			<textarea id="cuerpo" name="cuerpo">Mi texto</textarea>
		`

		saveReleaseThreadPrefill({
			subforum: 'juegos',
			title: '[Hilo Oficial] Test Game',
			body: '[b]Test Game[/b]',
		})

		expect(applyReleaseThreadPrefill()).toBe(true)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('Mi titulo')
		expect(document.querySelector<HTMLTextAreaElement>('#cuerpo')!.value).toBe('Mi texto')
	})

	it('ignores expired prefill data', () => {
		document.body.innerHTML = `
			<input id="cabecera" />
			<textarea id="cuerpo" name="cuerpo"></textarea>
		`
		sessionStorage.setItem(
			STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL,
			JSON.stringify({
				subforum: 'juegos',
				title: 'Old',
				body: 'Old body',
				createdAt: Date.now() - 10 * 60 * 1000,
			})
		)

		expect(applyReleaseThreadPrefill()).toBe(false)
		expect(document.querySelector<HTMLInputElement>('#cabecera')!.value).toBe('')
		expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL)).toBeNull()
	})

	it('does nothing outside new thread pages', () => {
		setPath('/foro/juegos')
		saveReleaseThreadPrefill({
			subforum: 'juegos',
			title: '[Hilo Oficial] Test Game',
			body: '[b]Test Game[/b]',
		})

		expect(applyReleaseThreadPrefill()).toBe(false)
		expect(sessionStorage.getItem(STORAGE_KEYS.PENDING_RELEASE_THREAD_PREFILL)).not.toBeNull()
		clearReleaseThreadPrefill()
	})
})
