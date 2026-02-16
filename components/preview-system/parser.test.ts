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
