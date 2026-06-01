import { describe, expect, it } from 'vitest'
import { matchContentRules, ruleMatches } from './matcher'
import type { ContentRule } from './types'

function makeRule(overrides: Partial<ContentRule> = {}): ContentRule {
	return {
		id: 'rule-1',
		name: 'Rule',
		enabled: true,
		action: 'hide',
		matchTitle: '',
		matchAuthor: '',
		subforumIds: [],
		highlightColor: undefined,
		createdAt: 1,
		updatedAt: 1,
		...overrides,
	}
}

describe('content rules matcher', () => {
	it('matches titles case-insensitively', () => {
		const rule = makeRule({ matchTitle: 'Steam Deck' })

		expect(ruleMatches(rule, { title: 'ofertas de STEAM deck', subforumId: '/foro/juegos' })).toBe(true)
	})

	it('keeps different season formats literal', () => {
		const rule = makeRule({ matchTitle: 'Pretemporada 2026/2027' })

		expect(ruleMatches(rule, { title: 'Pretemporada 2026/27: Real Madrid CF', subforumId: '/foro/deportes' })).toBe(false)
		expect(ruleMatches(rule, { title: 'Pretemporada 2026/2027: FC Barcelona', subforumId: '/foro/futbol' })).toBe(true)
	})

	it('matches titles ignoring accents', () => {
		const rule = makeRule({ matchTitle: 'Mexico' })

		expect(ruleMatches(rule, { title: 'FIFA Mundial 2026 - EEUU, México y Canadá', subforumId: '/foro/futbol' })).toBe(true)
	})

	it('matches authors by exact normalized username', () => {
		const rule = makeRule({ matchAuthor: 'Adan' })

		expect(ruleMatches(rule, { title: 'Tema', author: ' adan ' })).toBe(true)
		expect(ruleMatches(rule, { title: 'Tema', author: 'adan-dev' })).toBe(false)
	})

	it('matches only configured subforums when present', () => {
		const rule = makeRule({ subforumIds: ['/foro/juegos'] })

		expect(ruleMatches(rule, { title: 'Tema', subforumId: '/foro/juegos' })).toBe(true)
		expect(ruleMatches(rule, { title: 'Tema', subforumId: '/foro/cine' })).toBe(false)
	})

	it('does not apply disabled rules', () => {
		const rule = makeRule({ enabled: false, matchTitle: 'spoiler' })

		expect(ruleMatches(rule, { title: 'spoiler final' })).toBe(false)
	})

	it('gives hide priority over highlight', () => {
		const result = matchContentRules(
			[
				makeRule({ id: 'highlight', action: 'highlight', matchTitle: 'oferta' }),
				makeRule({ id: 'hide', action: 'hide', matchTitle: 'oferta' }),
			],
			{ title: 'Oferta semanal' }
		)

		expect(result.action).toBe('hide')
		expect(result.matchedRules).toHaveLength(2)
	})
})
