import { describe, expect, it } from 'vitest'
import { useTextInsertion } from './use-text-insertion'

describe('useTextInsertion insertCode', () => {
	it('wraps selection with [c][/c] for inline-c language option', () => {
		const textarea = document.createElement('textarea')
		textarea.value = 'partydeck'
		document.body.appendChild(textarea)
		textarea.selectionStart = 0
		textarea.selectionEnd = textarea.value.length

		const { insertCode } = useTextInsertion(textarea)
		insertCode('inline-c')

		expect(textarea.value).toBe('[c]partydeck[/c]')
	})

	it('inserts empty inline [c][/c] and places cursor inside when no selection', () => {
		const textarea = document.createElement('textarea')
		document.body.appendChild(textarea)
		textarea.selectionStart = 0
		textarea.selectionEnd = 0

		const { insertCode } = useTextInsertion(textarea)
		insertCode('inline-c')

		expect(textarea.value).toBe('[c][/c]')
		expect(textarea.selectionStart).toBe(3)
		expect(textarea.selectionEnd).toBe(3)
	})
})
