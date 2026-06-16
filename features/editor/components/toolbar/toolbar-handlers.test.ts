import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fillSuggestedThreadTitleIfEmpty } from './toolbar-handlers'

describe('fillSuggestedThreadTitleIfEmpty', () => {
	beforeEach(() => {
		document.body.innerHTML = ''
	})

	it('fills an empty new-thread title with the suggestion', () => {
		document.body.innerHTML = '<input id="cabecera" value="">'
		const titleInput = document.querySelector<HTMLInputElement>('#cabecera')
		const inputListener = vi.fn()
		const changeListener = vi.fn()
		titleInput?.addEventListener('input', inputListener)
		titleInput?.addEventListener('change', changeListener)

		expect(fillSuggestedThreadTitleIfEmpty('Frieren', true)).toBe(true)

		expect(titleInput?.value).toBe('Frieren')
		expect(inputListener).toHaveBeenCalledTimes(1)
		expect(changeListener).toHaveBeenCalledTimes(1)
	})

	it('does not overwrite an existing title', () => {
		document.body.innerHTML = '<input id="cabecera" value="Tema escrito">'

		expect(fillSuggestedThreadTitleIfEmpty('Frieren', true)).toBe(false)

		expect(document.querySelector<HTMLInputElement>('#cabecera')?.value).toBe('Tema escrito')
	})

	it('ignores suggestions outside new-thread pages', () => {
		document.body.innerHTML = '<input id="cabecera" value="">'

		expect(fillSuggestedThreadTitleIfEmpty('Frieren', false)).toBe(false)

		expect(document.querySelector<HTMLInputElement>('#cabecera')?.value).toBe('')
	})
})
