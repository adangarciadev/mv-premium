/**
 * useTextInsertion hook - Low-level utilities for manipulating textarea content.
 * Provides wrappers for common BBCode operations and smart text placement.
 */
import { logger } from '@/lib/logger'

export function useTextInsertion(textarea: HTMLTextAreaElement) {
	/**
	 * Injects raw text at the current cursor position, replacing any selection.
	 * @param content - String to insert
	 */
	const insertText = (content: string) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value

		textarea.value = text.substring(0, start) + content + text.substring(end)

		const newCursorPos = start + content.length
		textarea.selectionStart = newCursorPos
		textarea.selectionEnd = newCursorPos

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))
		textarea.focus()
	}

	/**
	 * Surrounds the current selection with opening and closing tags.
	 * If no selection exists, places the cursor between the tags.
	 * @param openTag - BBCode opening tag
	 * @param closeTag - BBCode closing tag
	 */
	const wrapSelection = (openTag: string, closeTag: string) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		const wrapped = `${openTag}${selectedText}${closeTag}`

		textarea.value = text.substring(0, start) + wrapped + text.substring(end)

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))

		if (start === end) {
			// No selection: place cursor between tags
			const newCursorPos = start + openTag.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			// Had selection: place cursor after
			const newCursorPos = start + wrapped.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}
		textarea.focus()
	}

	/**
	 * Insert bold tags around selected text
	 */
	const insertBold = () => wrapSelection('[b]', '[/b]')

	/**
	 * Insert italic tags around selected text
	 */
	const insertItalic = () => wrapSelection('[i]', '[/i]')

	/**
	 * Insert underline tags around selected text
	 */
	const insertUnderline = () => wrapSelection('[u]', '[/u]')

	/**
	 * Insert center tags around selected text
	 */
	const insertCenter = () => wrapSelection('[center]', '[/center]')

	/**
	 * Insert strikethrough tags around selected text
	 */
	const insertStrikethrough = () => wrapSelection('[s]', '[/s]')

	/**
	 * Insert NSFW spoiler tags around selected text
	 */
	const insertNsfw = () => wrapSelection('[spoiler=NSFW]', '[/spoiler]')

	/**
	 * Insert link tags around selected text
	 */
	const insertLink = () => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		// Check if selection looks like a URL
		const isUrl = /^https?:\/\//.test(selectedText)

		if (isUrl) {
			// If URL selected, wrap it
			const wrapped = `[url]${selectedText}[/url]`
			textarea.value = text.substring(0, start) + wrapped + text.substring(end)
			const newCursorPos = start + wrapped.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			// If text selected, prompt would be ideal, but for now just wrap
			const wrapped = `[url]${selectedText}[/url]`
			textarea.value = text.substring(0, start) + wrapped + text.substring(end)
			if (start === end) {
				// Place cursor inside for URL input
				const newCursorPos = start + 5 // After [url]
				textarea.selectionStart = newCursorPos
				textarea.selectionEnd = newCursorPos
			} else {
				const newCursorPos = start + wrapped.length
				textarea.selectionStart = newCursorPos
				textarea.selectionEnd = newCursorPos
			}
		}

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))
		textarea.focus()
	}

	/**
	 * Insert quote tags around selected text
	 */
	const insertQuote = () => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		const wrapped = `[quote]${selectedText}[/quote]`

		textarea.value = text.substring(0, start) + wrapped + text.substring(end)

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))

		if (start === end) {
			const newCursorPos = start + 7 // After [quote]
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		} else {
			const newCursorPos = start + wrapped.length
			textarea.selectionStart = newCursorPos
			textarea.selectionEnd = newCursorPos
		}
		textarea.focus()
	}

	/**
	 * Insert inline code (just the simple [code] tag without language)
	 */
	const insertInlineCode = () => wrapSelection('[code]', '[/code]')

	/**
	 * Insert code block with optional language
	 */
	const insertCode = (lang: string) => {
		const start = textarea.selectionStart
		const end = textarea.selectionEnd
		const text = textarea.value
		const selectedText = text.substring(start, end)

		const tag = lang ? `[code=${lang}]` : '[code]'
		const codeBlock = `${tag}\n${selectedText}\n[/code]`

		textarea.value = text.substring(0, start) + codeBlock + text.substring(end)

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))

		const newCursorPos = start + codeBlock.length
		textarea.selectionStart = newCursorPos
		textarea.selectionEnd = newCursorPos
		textarea.focus()
	}

	/**
	 * Insert image tag with a newline after
	 */
	const insertImageTag = (url: string) => {
		logger.debug(`insertImageTag called with URL: ${url.substring(0, 50)}...`)
		const start = textarea.selectionStart
		const text = textarea.value
		const imageTag = `[img]${url}[/img]\n`

		logger.debug(`Inserting at position ${start}, current text length: ${text.length}`)
		textarea.value = text.substring(0, start) + imageTag + text.substring(start)

		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		textarea.dispatchEvent(new Event('change', { bubbles: true }))

		const newCursorPos = start + imageTag.length
		textarea.selectionStart = newCursorPos
		textarea.selectionEnd = newCursorPos
		textarea.focus()
		logger.debug(`Image inserted, new cursor position: ${newCursorPos}`)
	}

	return {
		insertText,
		insertCode,
		insertBold,
		insertItalic,
		insertUnderline,
		insertStrikethrough,
		insertNsfw,
		insertCenter,
		insertLink,
		insertQuote,
		insertInlineCode,
		insertImageTag,
	}
}
