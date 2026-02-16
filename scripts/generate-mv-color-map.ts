/**
 * Build-time script: Parse dark-mv.css and generate a TypeScript color-rule map.
 *
 * Outputs features/mv-theme/generated/color-map.ts with a list of entries:
 * [{ s: selector, p: property, v: originalValue, c: [normalizedHexes] }]
 *
 * This keeps shorthand values intact (border/background/gradients) so runtime
 * overrides can replace only the color literals without breaking declarations.
 *
 * Usage: npx tsx scripts/generate-mv-color-map.ts
 */
import postcss, { type Node, type Rule } from 'postcss'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const CSS_PATH = path.join(ROOT, 'assets', 'styles', 'dark-mv.css')
const OUT_PATH = path.join(ROOT, 'features', 'mv-theme', 'generated', 'color-map.ts')

const HEX_RE = /#[0-9a-f]{3,8}\b/gi

interface PendingEntry {
	p: string
	v: string
	c: string[]
	selectors: Set<string>
}

interface ColorRuleEntry {
	s: string
	p: string
	v: string
	c: string[]
}

function normalizeHex(hex: string): string {
	const clean = hex.toLowerCase()

	// Expand #RGB and #RGBA to full forms
	if (clean.length === 4 || clean.length === 5) {
		const chunks = clean.slice(1).split('')
		return `#${chunks.map(ch => ch + ch).join('')}`
	}

	return clean
}

function normalizeWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

function extractNormalizedHexes(value: string): string[] {
	const matches = value.match(HEX_RE)
	if (!matches) return []

	const unique = new Set<string>()
	for (const rawHex of matches) {
		unique.add(normalizeHex(rawHex))
	}

	return [...unique]
}

function isInsideKeyframes(rule: Rule): boolean {
	let current: Node | undefined = rule.parent
	while (current) {
		if (current.type === 'atrule' && /keyframes$/i.test(current.name)) {
			return true
		}
		current = current.parent
	}
	return false
}

async function main() {
	const css = fs.readFileSync(CSS_PATH, 'utf-8')
	const root = postcss.parse(css)

	// Map key: property + value + colors → combined selectors
	const entriesMap = new Map<string, PendingEntry>()

	root.walkRules(rule => {
		if (isInsideKeyframes(rule)) return

		const selector = normalizeWhitespace(rule.selector)
		if (!selector) return

		rule.walkDecls(decl => {
			const value = normalizeWhitespace(decl.value)
			if (!value) return

			const colors = extractNormalizedHexes(value)
			if (colors.length === 0) return

			const key = `${decl.prop}\u0000${value}\u0000${colors.join('|')}`
			const existing = entriesMap.get(key)
			if (existing) {
				existing.selectors.add(selector)
				return
			}

			entriesMap.set(key, {
				p: decl.prop,
				v: value,
				c: colors,
				selectors: new Set([selector]),
			})
		})
	})

	const entries: ColorRuleEntry[] = []
	for (const entry of entriesMap.values()) {
		entries.push({
			s: [...entry.selectors].join(','),
			p: entry.p,
			v: entry.v,
			c: entry.c,
		})
	}

	const ts = `// AUTO-GENERATED - Do not edit manually
// Run: npx tsx scripts/generate-mv-color-map.ts
// Source: assets/styles/dark-mv.css

export interface MvThemeColorRuleEntry {
\ts: string
\tp: string
\tv: string
\tc: string[]
}

export const MV_THEME_COLOR_RULES: MvThemeColorRuleEntry[] = ${JSON.stringify(entries, null, '\t')}
`

	fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
	fs.writeFileSync(OUT_PATH, ts, 'utf-8')

	const uniqueHexes = new Set<string>()
	for (const entry of entries) {
		for (const hex of entry.c) {
			uniqueHexes.add(hex)
		}
	}

	console.log(`Generated ${OUT_PATH}`)
	console.log(`  ${uniqueHexes.size} hex colors, ${entries.length} selector/property/value entries`)
}

main().catch(err => {
	console.error(err)
	process.exit(1)
})
