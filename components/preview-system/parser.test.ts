import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/messaging', () => ({
	sendMessage: vi.fn(async () => ''),
}))

vi.mock('@/constants/mv-emojis', () => ({
	loadEmojis: vi.fn(async () => [
		{
			category: 'Mediavida',
			icon: ':)',
			items: [
				{
					code: ':psyduck:',
					url: '/img/emoji/u/1f914.png',
				},
			],
		},
	]),
}))

import { parseBBCode } from './parser'

describe('parseBBCode [c] inline code support', () => {
	it('renders [c]...[/c] as inline code', async () => {
		const html = await parseBBCode('Usa [c]partydeck[/c] en desktop')
		expect(html).toContain('<code class="inline">partydeck</code>')
	})

	it('does not parse emojis or nested bbcode inside [c] tag', async () => {
		const html = await parseBBCode('[c]:psyduck: [b]bold[/b] <tag>[/c]')
		expect(html).toContain('<code class="inline">:psyduck: [b]bold[/b] &lt;tag&gt;</code>')
		expect(html).not.toContain('<strong>bold</strong>')
		expect(html).not.toContain('class="smiley"')
		expect(html).not.toContain('class="emoji"')
	})
})

describe('parseBBCode quote support', () => {
	it('renders [quote=]...[/quote] as a regular quote when author is empty', async () => {
		const html = await parseBBCode('Antes\n\n[quote=]Texto citado[/quote]')
		expect(html).toContain('<blockquote class="quote"><p>Texto citado</p></blockquote>')
		expect(html).not.toContain('[quote=]')
	})
})

describe('parseBBCode GOG media support', () => {
	it.each(['https://www.gog.com/game/baldurs_gate_iii', 'https://www.gog.com/en/game/baldurs_gate_iii'])(
		'renders a GOG hydration placeholder for %s',
		async url => {
			const html = await parseBBCode(`[media]${url}[/media]`)

			expect(html).toContain('class="gog-embed-placeholder"')
			expect(html).toContain('data-gog-slug="baldurs_gate_iii"')
			expect(html).not.toContain('<iframe')
		}
	)

	it('keeps non-game GOG links on the generic fallback', async () => {
		const html = await parseBBCode('[media]https://www.gog.com/forum/general[/media]')

		expect(html).not.toContain('gog-embed-placeholder')
		expect(html).toContain('class="embed-placeholder generic-card"')
	})

	it('does not interpolate encoded markup into the iframe source', async () => {
		const html = await parseBBCode('[media]https://www.gog.com/game/foo%22%3E%3Cscript%3Ealert(1)%3C/script%3E[/media]')

		expect(html).not.toContain('gog-embed-placeholder')
		expect(html).not.toContain('<script>')
	})
})
