import { loadEmojis } from '@/constants/mv-emojis'
import { sendMessage } from '@/lib/messaging'

// Lazy-loaded emoji map (only loaded when emojis are parsed)
let emojiMapCache: Record<string, { url: string; className: string }> | null = null

async function getEmojiMap(): Promise<Record<string, { url: string; className: string }>> {
	if (emojiMapCache) return emojiMapCache

	const emojis = await loadEmojis()
	emojiMapCache = {}

	emojis.forEach((cat, index) => {
		const className = index === 0 ? 'smiley' : 'emoji' // First category is 'Mediavida'
		cat.items.forEach(emoji => {
			emojiMapCache![emoji.code] = { url: emoji.url, className }
		})
	})

	return emojiMapCache
}

// Create regex for all emoji codes
// For 1500+ emojis, a long regex might be slow but it's the standard way
// Alternatively, we can use a more generic regex like :[\w+-]+: and check against the map
const EMOJI_REGEX = /:([\w\+\-]+):/g

const LANG_DISPLAY_MAP: Record<string, string> = {
	// Classic Languages
	cs: 'C#',
	csharp: 'C#',
	cpp: 'C++',
	c: 'C',
	js: 'JavaScript',
	javascript: 'JavaScript',
	ts: 'TypeScript',
	typescript: 'TypeScript',
	py: 'Python',
	python: 'Python',
	rs: 'Rust',
	rust: 'Rust',
	go: 'Go',
	java: 'Java',
	php: 'PHP',

	// Web
	html: 'HTML',
	xml: 'XML',
	css: 'CSS',
	json: 'JSON',
	sql: 'SQL',

	// React (New)
	tsx: 'React (TSX)',
	jsx: 'React (JSX)',

	// Scripts & Configs (New)
	sh: 'Bash',
	bash: 'Bash',
	zsh: 'Bash',
	shell: 'Shell',
	yml: 'YAML',
	yaml: 'YAML',
	md: 'Markdown',
	markdown: 'Markdown',

	// Others (New)
	rb: 'Ruby',
	ruby: 'Ruby',
	kt: 'Kotlin',
	kotlin: 'Kotlin',
	swift: 'Swift',

	plaintext: 'Texto / Estructura',
	text: 'Texto Plano',
	txt: 'Texto Plano',
	plain: 'Texto Plano',
}

async function highlightCodeBlock(code: string, lang?: string): Promise<string> {
	const trimmedCode = code.trim()
	if (!trimmedCode) return ''

	try {
		let detectedLang = lang?.toLowerCase().trim()
		let highlightedCode: string

		// ---------------------------------------------------------
		// 1. PRIOR INTERCEPTOR (Obvious tree detection)
		// ---------------------------------------------------------
		if (!detectedLang) {
			// Detects:
			// - Unicode: ├──, └──, │
			// - ASCII: |--, +--, \--, `--
			// - Simple paths: starts with "/" or "./" or ends with "/"
			const isTree =
				/[├└│]/.test(trimmedCode) || /^[\s]*[\+\|`\\]--/m.test(trimmedCode) || /^[\s]*[.\/].*\/$/m.test(trimmedCode)

			if (isTree) detectedLang = 'plain'
		}

		// ---------------------------------------------------------
		// 2. HIGHLIGHTING PROCESS (via background script)
		// ---------------------------------------------------------
		if (detectedLang === 'plaintext' || detectedLang === 'text' || detectedLang === 'txt' || detectedLang === 'plain') {
			// Manual bypass for plain text
			highlightedCode = escapeHtml(trimmedCode)
			detectedLang = 'plain'
		} else {
			// Use heuristics if no language specified
			if (!detectedLang) {
				detectedLang = detectLanguageHeuristic(trimmedCode)
			}
			// Highlight via background script messaging
			highlightedCode = await sendMessage('highlightCode', {
				code: trimmedCode,
				language: detectedLang,
			})
		}

		// ---------------------------------------------------------
		// 3. FINAL LABELING
		// ---------------------------------------------------------
		const displayLang = detectedLang
			? LANG_DISPLAY_MAP[detectedLang] || detectedLang.charAt(0).toUpperCase() + detectedLang.slice(1)
			: ''

		const label = displayLang ? `<div class="mv-code-lang-label">${displayLang}</div>` : ''

		return `
            <div class="code-wrapper">
                ${label}
                <code class="language-${detectedLang}">${highlightedCode}</code>
            </div>
        `
	} catch (e) {
		return `<div class="code-wrapper"><code>${escapeHtml(trimmedCode)}</code></div>`
	}
}

/**
 * Simple heuristic-based language detection (since Prism doesn't have auto-detect)
 */
function detectLanguageHeuristic(code: string): string {
	// Rust
	if (
		code.includes('fn main()') ||
		code.includes('let mut ') ||
		code.includes('impl ') ||
		code.includes('#[derive') ||
		code.includes('println!')
	) {
		return 'rust'
	}
	// Go
	if (
		code.includes('package main') ||
		code.includes('func main()') ||
		code.includes('fmt.Println') ||
		(code.includes('func ') && code.includes(':='))
	) {
		return 'go'
	}
	// Python
	if (
		code.includes('def __init__') ||
		code.includes('if __name__ ==') ||
		(code.includes('def ') && code.includes('self'))
	) {
		return 'python'
	}
	// JavaScript/TypeScript
	if (
		code.includes('const ') ||
		code.includes('let ') ||
		code.includes('function ') ||
		code.includes('=>') ||
		code.includes('console.log')
	) {
		return 'javascript'
	}
	// HTML/XML
	if (/<\w+[^>]*>/.test(code) && /<\/\w+>/.test(code)) {
		return 'markup'
	}
	// JSON
	if (/^\s*[\{\[]/.test(code) && /[\}\]]\s*$/.test(code)) {
		return 'json'
	}
	// SQL
	if (/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE)\b/i.test(code)) {
		return 'sql'
	}
	// CSS
	if (/\{[^}]*:[^}]*\}/.test(code) && code.includes('{') && code.includes('}')) {
		return 'css'
	}
	// Bash
	if (code.includes('#!/bin/bash') || code.includes('echo ') || /^\$\s/.test(code)) {
		return 'bash'
	}

	// Default fallback
	return 'plain'
}

function escapeHtml(text: string): string {
	const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
	return text.replace(/[&<>"']/g, char => map[char])
}

/**
 * Converts a 2-letter ISO country code to a Mediavida flag emoji image
 * Each letter maps to a Unicode Regional Indicator Symbol:
 * a=1f1e6, b=1f1e7, ..., z=1f1ff
 */
function countryCodeToFlagImg(code: string): string {
	if (!/^[a-z]{2}$/.test(code)) return `[flag]${code}[/flag]`

	const toRegionalIndicator = (char: string) => (0x1f1e6 + char.charCodeAt(0) - 97).toString(16)

	const hex1 = toRegionalIndicator(code[0])
	const hex2 = toRegionalIndicator(code[1])

	return `<img alt="${code}" class="emoji" draggable="false" src="https://www.mediavida.com/img/emoji/u/${hex1}-${hex2}.png">`
}

function parseMediaTag(url: string): string {
	const cleanUrl = url.trim()

	// 1. YOUTUBE
	const ytMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
	if (ytMatch) {
		const id = ytMatch[1]
		return `
            <div data-s9e-mediaembed="youtube" class="embed r16-9 yt">
                <div class="youtube_lite">
                    <a class="preinit" 
                       data-youtube="${id}" 
                       /* CHANGE HERE: Added https: before // */
                       style="background-image:url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)" 
                       href="https://www.youtube.com/watch?v=${id}" 
                       target="_blank">
                    </a>
                </div>
            </div>
        `
	}

	// 2. TWITTER / X
	const twMatch = cleanUrl.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/)

	if (twMatch) {
		const username = twMatch[1]
		// const tweetId = twMatch[2];

		return `
            <div class="embed-placeholder generic-card twitter-card">
                <div class="generic-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4l11.733 16h4.267l-11.733 -16z" />
                        <path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772" />
                    </svg>
                </div>
                <div class="generic-content">
                    <div class="generic-domain">Twitter / X</div>
                    <a href="${cleanUrl}" target="_blank" class="generic-link">${cleanUrl}</a>
                    <div class="generic-footer">Tweet de @${username}</div>
                </div>
            </div>
        `
	}

	// 3. INSTAGRAM
	const instaMatch = cleanUrl.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel)\/([\w-]{5,})/)
	if (instaMatch) {
		return `
            <div class="embed-placeholder generic-card instagram-card">
                <div class="generic-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
                </div>
                <div class="generic-content">
                    <div class="generic-domain">Instagram</div>
                    <a href="${cleanUrl}" target="_blank" class="generic-link">${cleanUrl}</a>
                    <div class="generic-footer">Ver publicación en Instagram</div>
                </div>
            </div>
        `
	}

	// 4. STEAM (Game Store - Placeholder for React hydration)
	const steamMatch = cleanUrl.match(/store\.steampowered\.com\/app\/(\d+)/i)
	if (steamMatch) {
		const appId = steamMatch[1]
		// Generate a placeholder that will be hydrated by React
		return `
            <div class="steam-embed-placeholder" data-steam-appid="${appId}">
                <div class="steam-card-loading">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round">
                            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
                        </path>
                    </svg>
                    <span>Cargando juego de Steam...</span>
                </div>
            </div>
        `
	}
	// 5. AMAZON AND OTHERS
	let domain = 'Enlace externo'
	try {
		const urlObj = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`)
		domain = urlObj.hostname.replace('www.', '')
		// Capitalize (amazon.es -> Amazon.es)
		domain = domain.charAt(0).toUpperCase() + domain.slice(1)
	} catch {
		// Malformed URL - use default domain 'External Link'
	}

	return `
        <div class="embed-placeholder generic-card">
            <div class="generic-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            </div>
            <div class="generic-content">
                <div class="generic-domain">${domain}</div>
                <a href="${cleanUrl}" target="_blank" class="generic-link">${cleanUrl}</a>
                <div class="generic-footer">Contenido incrustado no disponible en vista previa</div>
            </div>
        </div>
    `
}

function parseMarkdownTables(html: string): string {
	const lines = html.split('\n')
	const result: string[] = []
	let inTable = false
	let tableRows: string[][] = []
	let alignments: string[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		if (line.startsWith('|') && line.endsWith('|')) {
			const cells = line
				.slice(1, -1)
				.split('|')
				.map(c => c.trim())
			if (cells.every(c => /^:?-+:?$/.test(c))) {
				alignments = cells.map(c => {
					if (c.startsWith(':') && c.endsWith(':')) return 'center'
					if (c.endsWith(':')) return 'right'
					return 'left'
				})
				continue
			}
			if (!inTable) {
				inTable = true
				tableRows = []
				alignments = []
			}
			tableRows.push(cells)
		} else {
			if (inTable && tableRows.length > 0) {
				result.push(buildTable(tableRows, alignments))
				inTable = false
				tableRows = []
				alignments = []
			}
			result.push(line)
		}
	}
	if (inTable && tableRows.length > 0) result.push(buildTable(tableRows, alignments))
	return result.join('\n')
}

function buildTable(rows: string[][], alignments: string[]): string {
	if (rows.length === 0) return ''
	const headerRow = rows[0]
	const bodyRows = rows.slice(1)
	let html = '<div class="table-wrap"><table><thead><tr>'
	headerRow.forEach((cell, i) => (html += `<th style="text-align:${alignments[i] || 'left'}">${cell}</th>`))
	html += '</tr></thead>'
	if (bodyRows.length > 0) {
		html += '<tbody>'
		bodyRows.forEach(row => {
			html += '<tr>'
			row.forEach((cell, i) => (html += `<td style="text-align:${alignments[i] || 'left'}">${cell}</td>`))
			html += '</tr>'
		})
		html += '</tbody>'
	}
	html += '</table></div>'
	return html
}

function parseMarkdownLists(html: string): string {
	const lines = html.split('\n')
	const result: string[] = []

	// Stack to control depth and list type
	const stack: { type: 'ul' | 'ol' | 'checklist'; indent: number }[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Calculate indentation
		const indentMatch = line.match(/^(\s*)/)
		const indentLevel = indentMatch ? indentMatch[1].length : 0

		const trimmed = line.trim()

		// --- TYPE DETECTION ---

		const taskMatch = trimmed.match(/^- \[([ xX])\] (.*)$/)
		const orderedMatch = trimmed.match(/^(\d+)\. (.*)$/)
		const isHrule = /^[-*]{3,}$/.test(trimmed)
		const unorderedMatch = !isHrule && !taskMatch && trimmed.match(/^[-*] (.*)$/)

		// Is it a valid list item?
		if (taskMatch || orderedMatch || unorderedMatch) {
			// ... (ALL THIS LOGICAL PART REMAINS THE SAME AS BEFORE) ...
			let currentType: 'ul' | 'ol' | 'checklist' = 'ul'
			let content = ''

			if (taskMatch) {
				currentType = 'checklist'
				const isChecked = taskMatch[1].toLowerCase() === 'x'
				const text = taskMatch[2]
				const checkedAttr = isChecked ? 'checked=""' : ''
				const labelClass = isChecked ? ' class="done"' : ''
				content = `<p><label${labelClass}><input type="checkbox" class="check" disabled="" ${checkedAttr}> ${text}</label></p>`
			} else if (orderedMatch) {
				currentType = 'ol'
				content = orderedMatch[2]
			} else if (unorderedMatch) {
				currentType = 'ul'
				content = unorderedMatch[1]
			}

			// 1. Close deeper levels
			while (stack.length > 0 && indentLevel < stack[stack.length - 1].indent) {
				const last = stack.pop()
				if (last) result.push(last.type === 'checklist' ? '</ul>' : `</${last.type}>`)
			}

			// 2. Open new level
			if (stack.length === 0 || indentLevel > stack[stack.length - 1].indent) {
				stack.push({ type: currentType, indent: indentLevel })
				result.push(currentType === 'checklist' ? '<ul class="checklist">' : `<${currentType}>`)
			}
			// 3. Change type at same level
			else if (indentLevel === stack[stack.length - 1].indent && currentType !== stack[stack.length - 1].type) {
				const last = stack.pop()
				if (last) result.push(last.type === 'checklist' ? '</ul>' : `</${last.type}>`)

				stack.push({ type: currentType, indent: indentLevel })
				result.push(currentType === 'checklist' ? '<ul class="checklist">' : `<${currentType}>`)
			}

			result.push(`<li>${content}</li>`)
		} else {
			// === THE ERROR WAS HERE ===

			// If the line is empty, WE KEEP IT.
			// Before we ignored it, which merged paragraphs.
			if (trimmed === '') {
				result.push(line)
				continue // Move to the next line
			}

			// If there is text and it's not a list, close open lists
			while (stack.length > 0) {
				const last = stack.pop()
				if (last) result.push(last.type === 'checklist' ? '</ul>' : `</${last.type}>`)
			}

			result.push(line)
		}
	}

	// Close whatever remains open at the end
	while (stack.length > 0) {
		const last = stack.pop()
		if (last) result.push(last.type === 'checklist' ? '</ul>' : `</${last.type}>`)
	}

	return result.join('\n')
}

/**
 * Parses BBCode list content to properly close <li> tags.
 * Splits by [*] markers and wraps each item's content (including multi-line) in <li>...</li>
 */
function parseListItems(content: string): string {
	// Split by [*] marker
	const parts = content.split(/\[\*\]/g)

	return parts
		.map(part => {
			const trimmed = part.trim()
			if (!trimmed) return '' // Skip empty parts (usually the first one before any [*])

			// Convert newlines within the item to <br> and wrap in <li>
			// This keeps sub-indices on separate lines but inside the same <li>
			const htmlContent = trimmed.replace(/\n/g, '<br>')
			return `<li>${htmlContent}</li>`
		})
		.filter(Boolean)
		.join('')
}

export async function parseBBCode(input: string): Promise<string> {
	if (!input) return ''

	// Store code blocks with their promises for lazy highlighting
	const codeBlocks: { placeholder: string; htmlPromise: Promise<string> | string }[] = []
	let processedInput = input.replace(/{{cursor}}/g, '').trim()

	// 1. Protect large code blocks [code]...[/code]
	processedInput = processedInput.replace(/\[code(?:=([^\]]+))?\]([\s\S]*?)\[\/code\]/gi, (_, lang, code) => {
		const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
		codeBlocks.push({ placeholder, htmlPromise: highlightCodeBlock(code, lang) })
		return placeholder + '\n\n'
	})

	// ========================================================================
	// 1.5. Support for Markdown Fenced Code Blocks (```language code ```)
	// ========================================================================
	processedInput = processedInput.replace(/```(?:(\w+)\n)?([\s\S]*?)```/g, (_, lang, code) => {
		const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`
		// If no language (undefined), highlightCodeBlock will auto-detect
		codeBlocks.push({ placeholder, htmlPromise: highlightCodeBlock(code, lang || undefined) })
		return placeholder + '\n\n'
	})

	// ========================================================================
	// 1.8. NEW: Protect Media Embeds [media]...[/media]
	// We do it here so escapeHtml doesn't break iframes
	// ========================================================================
	processedInput = processedInput.replace(/\[media\](.*?)\[\/media\]/gi, (_, url) => {
		const placeholder = `__MEDIA_BLOCK_${codeBlocks.length}__`
		codeBlocks.push({
			placeholder,
			htmlPromise: parseMediaTag(url), // Sync func returns string directly
		})
		return placeholder + '\n\n'
	})

	// 2. Protect Inline Code (Backticks)
	processedInput = processedInput.replace(/`([^`\n]+)`/g, (_, code) => {
		const placeholder = `__INLINE_CODE_${codeBlocks.length}__`
		codeBlocks.push({
			placeholder,
			htmlPromise: `<code class="inline">${escapeHtml(code)}</code>`, // Sync, just a string
		})
		return placeholder
	})

	// 3. Escape HTML
	let html = escapeHtml(processedInput)

	// ========================================================================
	// 4. HORIZONTAL LINES (HR) - MOVED HERE!
	// By doing it after escaping, <hr> remains a valid HTML tag.
	// ========================================================================
	html = html.replace(/^[\t ]*([-*])(?:[\t ]*\1){2,}[\t ]*$/gm, '<hr>')

	// Clean empty lines around <hr> to avoid extra spacing
	// This allows BBCode to have empty lines (necessary for native MV)
	// but our preview doesn't show extra space
	// CHANGED: Force double \n to ensure HR is treated as a separate block
	html = html.replace(/\n*<hr>\n*/g, '\n\n<hr>\n\n')

	// ========================================================================
	// 4. LISTS (BBCode and Markdown) - MOVED HERE!
	// IMPORTANT: Must go BEFORE Formatting (Bold/Italic) so that
	// list asterisks (* item) are not confused with italics (*text*).
	// ========================================================================

	// 4.1. BBCode Lists - Must properly close <li> tags
	// The [*] marker starts a list item that continues until the next [*] or [/list]
	// This allows multi-line content (like sub-indices) inside a single <li>
	html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
		return '<ul>' + parseListItems(content) + '</ul>\n\n'
	})
	html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, (_, content) => {
		return '<ol>' + parseListItems(content) + '</ol>\n\n'
	})

	// 4.2. Markdown Lists (The smart function)
	html = parseMarkdownLists(html)

	// 4. MARKDOWN QUOTES
	html = html.replace(/((?:^&gt; .*(?:\n|$))+)/gm, match => {
		const content = match
			.split('\n')
			.filter(line => line.trim().length > 0)
			.map(line => line.replace(/^&gt; ?/, ''))
			.join('<br>')
		return `<blockquote class="quote"><p>${content}</p></blockquote>\n\n`
	})

	// 5. Formatting
	html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>')
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>')
	html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
	html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
	html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
	html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')

	// 6. Headers
	html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>\n\n')
	html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>\n\n')
	html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>\n\n')
	html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>\n\n')
	html = html.replace(/\[h1\]([\s\S]*?)\[\/h1\]/gi, '<h2>$1</h2>\n\n')
	html = html.replace(/\[h2\]([\s\S]*?)\[\/h2\]/gi, '<h3>$1</h3>\n\n')
	html = html.replace(/\[bar\]([\s\S]*?)\[\/bar\]/gi, '<h3 class="bar">$1</h3>\n\n')

	// 7. Links and Images
	html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank">$2</a>')
	html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank">$1</a>')
	html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, '<img src="$1" />')

	// 7.1a. Anchor Links: [ancla=id]text[/ancla] -> <a href="#id">text</a>
	html = html.replace(/\[ancla=([^\]]+)\]([\s\S]*?)\[\/ancla\]/gi, '<a href="#$1" class="ancla-link">$2</a>')

	// 7.1b. Anchor Targets: [ancla]id[/ancla] -> <a class="bar-offset" name="$1"></a>
	html = html.replace(/\[ancla\]([^\[]+)\[\/ancla\]/gi, '<a class="bar-offset" name="$1"></a>')

	// 7.1. Markdown Images: ![alt](url)
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gi, '<img src="$2" alt="$1" />')

	// 7.3. Flags (Country Code to Emoji)
	html = html.replace(/\[flag\]([a-zA-Z]{2})\[\/flag\]/gi, (_, code) => {
		return countryCodeToFlagImg(code.toLowerCase())
	})

	// 7.4. All Other Emojis (:psydudk:, :alien:, etc.)
	// Load emoji map (cached after first load)
	const emojiMap = await getEmojiMap()
	html = html.replace(EMOJI_REGEX, match => {
		const emoji = emojiMap[match]
		if (emoji) {
			return `<img alt="${match}" class="${emoji.className}" draggable="false" src="https://www.mediavida.com${emoji.url}">`
		}
		return match
	})

	// 7.5. Center
	html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="center"><p>$1</p></div>\n\n')

	// 7.6. Media (videos, tweets, etc.)
	html = html.replace(
		/\[media\]([\s\S]*?)\[\/media\]/gi,
		'<div class="media-embed"><a href="$1" target="_blank">$1</a></div>\n\n'
	)

	// 7.6.5. User Mentions (@username, max 13 chars)
	// Matches @User at start, after space, newline, > or (
	// Max 13 chars as restricted by Mediavida
	html = html.replace(/(^|[\s\n>(])@([a-zA-Z0-9_\-]{1,13})\b/g, '$1<a href="/id/$2" target="_blank">@$2</a>')

	// 7.7. Auto-link generic URLs (that weren't caught by [url], [img] or [media])
	// Matches http/s starting with space, newline, > or (
	// This avoids replacing URLs inside href="..." or src="..."
	html = html.replace(
		/(^|[\s\n>(])(https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=%]+)/g,
		'$1<a href="$2" target="_blank">$2</a>'
	)

	// 8. BBCode Quotes - with and without author
	html = html.replace(/\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/gi, (_, author, content) => {
		return `<blockquote class="quote"><p>${content}</p><footer>— <cite>${author}</cite></footer></blockquote>\n\n`
	})
	html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="quote"><p>$1</p></blockquote>\n\n')

	// 9. Spoilers
	html = html.replace(/\[spoiler(?:=([^\]]*))?](.*?)\[\/spoiler\]/gis, (_, title, content) => {
		const displayTitle = title?.trim() || 'Spoiler'
		return `<div class="spoiler-wrap"><a href="#" class="spoiler">${displayTitle}</a><div class="spoiler animated"><p>${content}</p></div></div>\n\n`
	})

	// 10. Lists (BBCode and Markdown)
	html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul>$1</ul>')
	html = html.replace(/\[\*\]/g, '<li>')

	// Markdown Lists
	html = parseMarkdownLists(html)

	// Markdown Tables
	html = parseMarkdownTables(html)

	// ========================================================================
	// 11. PARAGRAPHS (IMPROVED)
	// Divide the text into blocks separated by empty lines.
	// ========================================================================

	// Normalize line breaks (CRLF -> LF)
	html = html.replace(/\r\n/g, '\n')

	// Divide by one or more consecutive line breaks
	// Note: Mediavida considers a double break (\n\n) a new paragraph.
	// A single break (\n) is a <br> within the same paragraph.
	// But if there are HTML block tags, we should not wrap them.

	// Strategy:
	// 1. Divide by double line breaks (potential paragraphs)
	const rawBlocks = html.split(/\n\s*\n/)

	html = rawBlocks
		.map(block => {
			const trimmed = block.trim()
			if (!trimmed) return ''

			// List of block tags that MUST NOT go inside <p>
			// Add 'hr' and 'div' (for embeds) to the list
			const isBlockTag =
				/^<(div|table|h[2-5]|ul|ol|li|blockquote|pre|hr|style|script)/i.test(trimmed) ||
				/^<a class="bar-offset"/.test(trimmed) || // Anchor targets
				trimmed.startsWith('__CODE_BLOCK_') ||
				trimmed.startsWith('__INLINE_CODE_') ||
				trimmed.startsWith('__MEDIA_BLOCK_')

			if (isBlockTag) {
				return trimmed
			} else {
				// It's plain text: Convert single line breaks to <br> and wrap in <p>
				return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
			}
		})
		.join('\n') // Join the blocks with a break so the HTML is readable

	// 12. Restore protected blocks (resolve all promises)
	const resolvedBlocks = await Promise.all(
		codeBlocks.map(async block => ({
			placeholder: block.placeholder,
			html: await block.htmlPromise,
		}))
	)

	for (const block of resolvedBlocks) {
		html = html.replace(block.placeholder, block.html)
	}

	return html
}
