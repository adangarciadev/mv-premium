/**
 * Prism.js Highlighter for Background Script
 *
 * Provides syntax highlighting via PrismJS in the background context.
 * This keeps the heavy Prism library (~100-150KB) out of the content script bundle.
 *
 * Languages are loaded on-demand to minimize memory usage.
 */
import Prism from 'prismjs'
import { logger } from '@/lib/logger'

// Track which languages have been loaded
const loadedLanguages = new Set<string>(['plain', 'plaintext', 'text'])

// Language alias mapping for normalization
const LANGUAGE_ALIASES: Record<string, string> = {
	// JavaScript family
	js: 'javascript',
	ts: 'typescript',
	tsx: 'tsx',
	// Python
	py: 'python',
	// Shell
	sh: 'bash',
	shell: 'bash',
	// Go
	golang: 'go',
	// Rust
	rs: 'rust',
	// C#
	cs: 'csharp',
	'c#': 'csharp',
	// C++
	'c++': 'cpp',
	// HTML/XML
	html: 'markup',
	xml: 'markup',
	// Text
	text: 'plain',
	txt: 'plain',
	plaintext: 'plain',
}

// Language dependencies (must be loaded before the target language)
const LANGUAGE_DEPS: Record<string, string[]> = {
	typescript: ['javascript'],
	jsx: ['markup', 'javascript'],
	tsx: ['jsx', 'typescript'],
	cpp: ['c'],
	csharp: ['clike'],
	java: ['clike'],
}

// Available language loaders (dynamic imports)
const LANGUAGE_LOADERS: Record<string, () => Promise<unknown>> = {
	javascript: () => import('prismjs/components/prism-javascript'),
	typescript: () => import('prismjs/components/prism-typescript'),
	css: () => import('prismjs/components/prism-css'),
	markup: () => import('prismjs/components/prism-markup'),
	python: () => import('prismjs/components/prism-python'),
	bash: () => import('prismjs/components/prism-bash'),
	json: () => import('prismjs/components/prism-json'),
	sql: () => import('prismjs/components/prism-sql'),
	java: () => import('prismjs/components/prism-java'),
	go: () => import('prismjs/components/prism-go'),
	rust: () => import('prismjs/components/prism-rust'),
	c: () => import('prismjs/components/prism-c'),
	cpp: () => import('prismjs/components/prism-cpp'),
	clike: () => import('prismjs/components/prism-clike'),
	csharp: () => import('prismjs/components/prism-csharp'),
	php: () => import('prismjs/components/prism-php'),
	jsx: () => import('prismjs/components/prism-jsx'),
	tsx: () => import('prismjs/components/prism-tsx'),
}

/**
 * Normalizes a language name or alias to its canonical PrismJS identifier
 */
function normalizeLanguage(lang: string): string {
	const lower = lang.toLowerCase().trim()
	return LANGUAGE_ALIASES[lower] || lower
}

/**
 * Dynamically loads a PrismJS language component and its recursive dependencies
 */
async function loadLanguage(lang: string): Promise<boolean> {
	const canonical = normalizeLanguage(lang)

	// Already loaded
	if (loadedLanguages.has(canonical)) return true

	// Plain text doesn't need loading
	if (canonical === 'plain') {
		loadedLanguages.add(canonical)
		return true
	}

	// No loader available
	const loader = LANGUAGE_LOADERS[canonical]
	if (!loader) return false

	try {
		// Load dependencies first
		const deps = LANGUAGE_DEPS[canonical]
		if (deps) {
			for (const dep of deps) {
				await loadLanguage(dep)
			}
		}

		// Load the language
		await loader()
		loadedLanguages.add(canonical)

		return true
	} catch (e) {
		logger.warn(`Failed to load language: ${lang}`, e)
		return false
	}
}

/**
 * Sanitizes text for HTML embedding by escaping characters sensitive to the parser.
 */
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Converts a stream of Prism tokens into an HTML string with appropriate span classes.
 */
type PrismToken = string | Prism.Token

function stringifyTokens(tokens: PrismToken[]): string {
	return tokens.map(token => stringifyToken(token)).join('')
}

function stringifyToken(token: PrismToken): string {
	if (typeof token === 'string') {
		return escapeHtml(token)
	}

	// It's a Prism.Token object
	const content = Array.isArray(token.content)
		? stringifyTokens(token.content as PrismToken[])
		: typeof token.content === 'string'
		? escapeHtml(token.content)
		: stringifyToken(token.content as PrismToken)

	// Build class string
	const classes = ['token', token.type]
	if (token.alias) {
		if (Array.isArray(token.alias)) {
			classes.push(...token.alias)
		} else {
			classes.push(token.alias)
		}
	}

	return `<span class="${classes.join(' ')}">${content}</span>`
}

/**
 * Highlight code with the specified language
 * Main export for the background message handler
 */
export async function highlightCode(code: string, language: string): Promise<string> {
	const canonical = normalizeLanguage(language)

	// Plain text - just escape HTML
	if (canonical === 'plain') {
		return escapeHtml(code)
	}

	// Try to load the language
	const loaded = await loadLanguage(canonical)

	if (loaded && Prism.languages[canonical]) {
		try {
			const grammar = Prism.languages[canonical]
			const tokens = Prism.tokenize(code, grammar)
			return stringifyTokens(tokens)
		} catch (e) {
			logger.error('Prism highlight error:', e)
		}
	}

	// Fallback: return escaped code
	return escapeHtml(code)
}
