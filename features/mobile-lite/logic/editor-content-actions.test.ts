import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMobileLiteEditorContentActions } from './editor-content-actions'

const writeText = vi.fn().mockResolvedValue(undefined)
const originalConfirm = window.confirm

function setup(initialValue = '') {
	const textarea = document.createElement('textarea')
	textarea.value = initialValue
	document.body.appendChild(textarea)
	const [copyButton, clearButton] = createMobileLiteEditorContentActions(textarea)
	document.body.append(copyButton, clearButton)
	return { textarea, copyButton, clearButton }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createMobileLiteEditorContentActions', () => {
	beforeEach(() => {
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
		writeText.mockClear()
		document.body.innerHTML = ''
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('disables both actions when empty and enables them with content', () => {
		const { textarea, copyButton, clearButton } = setup('')
		expect(copyButton.disabled).toBe(true)
		expect(clearButton.disabled).toBe(true)

		textarea.value = 'hola'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))

		expect(copyButton.disabled).toBe(false)
		expect(clearButton.disabled).toBe(false)
	})

	it('copies the editor content to the clipboard, flashes a check and shows a toast', async () => {
		const { copyButton } = setup('contenido del post')

		copyButton.click()
		await flush()

		expect(writeText).toHaveBeenCalledWith('contenido del post')
		expect(copyButton.innerHTML).toContain('fa-check')
		const toast = document.getElementById('mvp-mobile-lite-action-toast')
		expect(toast?.textContent).toContain('Copiado al portapapeles')
	})

	it('does not copy when the editor is empty', async () => {
		const { copyButton } = setup('')
		copyButton.click()
		await flush()
		expect(writeText).not.toHaveBeenCalled()
	})

	it('clears the editor after confirming in the custom dialog', async () => {
		const { textarea, clearButton } = setup('algo escrito')
		const inputSpy = vi.fn()
		textarea.addEventListener('input', inputSpy)

		clearButton.click()

		const dialog = document.querySelector('[data-mvp-mobile-lite-clear-dialog]')
		expect(dialog).toBeTruthy()
		expect(window.confirm).toBe(originalConfirm) // never uses the native prompt

		dialog!.querySelector<HTMLButtonElement>('.mvp-ml-clear-accept')!.click()
		await flush()

		expect(textarea.value).toBe('')
		expect(inputSpy).toHaveBeenCalled()
		expect(document.querySelector('[data-mvp-mobile-lite-clear-dialog]')).toBeNull()
	})

	it('keeps the content when the clear dialog is cancelled', async () => {
		const { textarea, clearButton } = setup('no me borres')

		clearButton.click()
		const dialog = document.querySelector('[data-mvp-mobile-lite-clear-dialog]')
		dialog!.querySelector<HTMLButtonElement>('.mvp-ml-clear-cancel')!.click()
		await flush()

		expect(textarea.value).toBe('no me borres')
		expect(document.querySelector('[data-mvp-mobile-lite-clear-dialog]')).toBeNull()
	})
})
