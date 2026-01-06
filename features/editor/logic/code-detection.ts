/**
 * Code Detection Utilities
 *
 * Heuristics for detecting programming languages in code blocks.
 * Separated from code-highlighter.ts for maintainability.
 */

// =============================================================================
// CODE VALIDATION
// =============================================================================

/**
 * Performs heuristic analysis to determine if a text snippet is likely source code
 * @param text - The string content to analyze
 * @returns True if the content satisfies code-like patterns and complexity
 */
export function looksLikeCode(text: string): boolean {
	const trimmed = text.trim()

	// Too short to be meaningful code
	if (trimmed.length < 10) return false

	// Count lines
	const lines = trimmed.split('\n').filter(l => l.trim())

	// Single character lines or very short content
	if (lines.length === 1 && trimmed.length < 20) return false

	// Check if it's just symbols/bullets (markdown examples like "* * *", "- - -", "***")
	const onlySymbols = /^[\s\*\-\+\#\~\.\\|><\_\`\:\;\,\!\?\@\^\\&\%\$\(\)\[\]\{\}\/\\]+$/
	if (onlySymbols.test(trimmed)) return false

	// Check if all lines are very short (likely examples, not code)
	const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length
	if (avgLineLength < 8 && lines.length < 5) return false

	// Check for code-like patterns
	const codePatterns = [
		// Function definitions
		/\b(function|def|fn|func|sub|proc|method)\s+\w+/,
		// Variable declarations
		/\b(var|let|const|int|string|float|bool|char|void|auto)\s+\w+/,
		// Control structures
		/\b(if|else|for|while|switch|case|return|break|continue)\s*[\(\{]/,
		// Imports/includes
		/\b(import|from|require|include|using|use)\s+[\w\"\'\.@]/,
		// Class/struct definitions
		/\b(class|struct|interface|enum|trait|impl)\s+\w+/,
		// Common operators and syntax
		/[\w\)]\s*\{[\s\S]*\}/, // Braces with content
		/=>\s*[\{\(]/, // Arrow functions
		/\(\s*\w+\s*:\s*\w+/, // Type annotations
		// Comments
		/\/\/.*\n|\/\*[\s\S]*?\*\/|#.*\n/,
		// String with escape sequences
		/["'][^"']*\\[nrt"'\\][^"']*["']/,
		// Array/object syntax
		/\[\s*[\w"'\d].*\]|\{\s*["'\w]+\s*:/,
		// Function calls with arguments
		/\w+\s*\([^)]*\)\s*[;\n\{]/,
		// Assignment with operators
		/\w+\s*[+\-*/%]?=\s*[^=]/,
		// Comparison operators
		/[!=<>]=|&&|\|\|/,
		// Method chaining
		/\.\w+\([^)]*\)\.\w+/,
		// SQL keywords
		/\b(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN)\b/i,
		// HTML/XML tags
		/<\w+[^>]*>.*<\/\w+>/,
	]

	// Count how many patterns match
	let matches = 0
	for (const pattern of codePatterns) {
		if (pattern.test(trimmed)) {
			matches++
		}
	}

	// Require at least 1 pattern match for short blocks, more for longer ones
	const requiredMatches = lines.length < 5 ? 1 : 0
	return matches > requiredMatches
}

// =============================================================================
// LANGUAGE DETECTION HEURISTICS
// =============================================================================

/**
 * Detects the most likely programming language from the code content using structural heuristics
 * @param text - The code snippet to classify
 * @returns The lowercase language identifier (e.g., 'rust', 'go') or null if uncertain
 */
export function detectLanguage(text: string): string | null {
	// Rust Heuristics
	if (
		text.includes('fn main()') ||
		text.includes('let mut ') ||
		text.includes('impl ') ||
		text.includes('#[derive') ||
		text.includes('#[test]') ||
		text.includes('pub fn ') ||
		(text.includes('fn ') && text.includes('->')) ||
		text.includes('println!') ||
		text.includes('assert_eq!') ||
		text.includes('use std::') ||
		text.includes('pub mod ') ||
		(text.includes('fn ') && !text.includes('function '))
	) {
		return 'rust'
	}

	// Go Heuristics (more specific patterns)
	if (
		text.includes('package main') ||
		text.includes('func main()') ||
		text.includes('fmt.Println') ||
		text.includes('fmt.Printf') ||
		(text.includes('import (') && text.includes('"')) || // import block
		(text.includes('func ') && text.includes(':=')) || // Go assignment
		(text.includes('for ') && text.includes(' range ')) || // range loop
		text.includes('go func(') || // goroutine
		text.includes('make([]') || // slice creation
		text.includes('make(map[') // map creation
	) {
		return 'go'
	}

	// Java Heuristics
	if (
		text.includes('public class ') ||
		text.includes('private static ') ||
		text.includes('public static void main') ||
		text.includes('System.out.println') ||
		(text.includes('class ') && text.includes('extends ')) ||
		(text.includes('class ') && text.includes('implements ')) ||
		text.includes('new ArrayList') ||
		text.includes('new HashMap') ||
		(text.includes('public ') && text.includes('void ')) ||
		(text.includes('private ') && text.includes('final '))
	) {
		return 'java'
	}

	// Python Heuristics
	if (
		text.includes('def __init__') ||
		text.includes('if __name__ ==') ||
		(text.includes('import ') && text.includes('from ')) ||
		(text.includes('def ') && text.includes('self')) ||
		text.includes('print("') ||
		text.includes("print('") ||
		// Additional Python patterns
		(text.includes('with open(') && text.includes(' as ')) ||
		text.includes('.append(') ||
		text.includes('.items()') ||
		(text.includes('for ') && text.includes(' in ') && text.includes(':')) ||
		(text.includes('if ') && text.includes(':') && !text.includes('{')) ||
		text.includes('elif ') ||
		(text.includes('True') && text.includes('False')) ||
		text.includes('dict(') ||
		text.includes('list(') ||
		text.includes('range(')
	) {
		return 'python'
	}

	// React/JSX Heuristics - MUST have React-specific patterns, not just HTML tags
	// Plain HTML tags alone should fall through to markup/html detection
	if (
		text.includes('React.') ||
		text.includes('useState') ||
		text.includes('useEffect') ||
		text.includes('useRef') ||
		text.includes('useCallback') ||
		text.includes('useMemo') ||
		text.includes('className=') ||
		text.includes('onClick={') ||
		text.includes('onChange={') ||
		text.includes('onSubmit={') ||
		(text.includes('export default') && text.includes('function') && text.includes('return') && text.includes('<')) ||
		(text.includes('const') && text.includes('= () =>') && text.includes('return') && text.includes('<'))
	) {
		return 'jsx'
	}

	// HTML/Markup Heuristics - pure HTML without JS
	if (
		text.includes('<!DOCTYPE') ||
		text.includes('<html') ||
		text.includes('<head>') ||
		text.includes('<body>') ||
		(text.includes('<') &&
			text.includes('</') &&
			!text.includes('function') &&
			!text.includes('const ') &&
			!text.includes('let '))
	) {
		return 'markup'
	}

	// JavaScript/TypeScript Heuristics
	if (
		text.includes('const ') ||
		text.includes('let ') ||
		text.includes('function ') ||
		text.includes('=>') ||
		text.includes('console.log')
	) {
		return 'javascript'
	}

	return null
}

// =============================================================================
// LANGUAGE DISPLAY NAMES
// =============================================================================

/**
 * Map of language identifiers to display names
 */
export const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
	cs: 'C#',
	csharp: 'C#',
	cpp: 'C++',
	js: 'JavaScript',
	javascript: 'JavaScript',
	ts: 'TypeScript',
	typescript: 'TypeScript',
	jsx: 'React (JSX)',
	tsx: 'React (TSX)',
	py: 'Python',
	python: 'Python',
	rs: 'Rust',
	rust: 'Rust',
	go: 'Go',
	html: 'HTML',
	markup: 'HTML',
	xml: 'XML',
	plain: 'Text',
	sql: 'SQL',
	bash: 'Bash',
	sh: 'Shell',
	json: 'JSON',
	css: 'CSS',
	php: 'PHP',
	c: 'C',
	java: 'Java',
}

/**
 * Resolves a standardized identifier to a user-friendly display name
 * @param lang - The language identifier
 */
export function getLanguageDisplayName(lang: string): string {
	return LANGUAGE_DISPLAY_NAMES[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
}
