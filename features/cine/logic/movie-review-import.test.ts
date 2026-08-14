import { describe, expect, it } from 'vitest'
import { CARD_RATIO } from './movie-card-shape'
import { collectCandidateImages, collectCandidatesInPost, filterByCardShape } from './movie-review-import'

function makeDocument(html: string): HTMLElement {
	const root = document.createElement('div')
	root.innerHTML = html
	return root
}

const ownPost = (num: string, html: string, author = 'SupermaN_CK') =>
	`<div class="post" data-num="${num}" data-autor="${author}">${html}</div>`

describe('collectCandidateImages', () => {
	it('collects images from the user own posts', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toEqual([
			{ imageUrl: 'https://iili.io/4ypDNabBJ.png', imageId: '4ypDNabBJ', postNumber: '45' },
		])
	})

	it('ignores posts by other users', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">', 'otro'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toEqual([])
	})

	/** The same name in a different case — the underscore has to survive, or it is another user. */
	it('compares the author case-insensitively', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">', 'SUPERMAN_CK'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toHaveLength(1)
	})

	/** And a name that merely looks similar is still somebody else. */
	it('does not match an author whose name only resembles the user', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">', 'supermanck'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toEqual([])
	})

	it('skips images already registered', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set(['4ypDNabBJ']))).toEqual([])
	})

	it('skips images whose URL yields no usable identifier', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/ab.png">'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toEqual([])
	})

	it('reads lazy-loaded sources', () => {
		const root = makeDocument(ownPost('45', '<img data-src="https://iili.io/4ypDNabBJ.png">'))

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toHaveLength(1)
	})

	it('collects several images across several of the user posts', () => {
		const root = makeDocument(
			ownPost('45', '<img src="https://iili.io/aaaaaaaaa.png"><img src="https://iili.io/bbbbbbbbb.png">') +
				ownPost('88', '<img src="https://iili.io/ccccccccc.png">')
		)

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set()).map(candidate => candidate.postNumber)).toEqual([
			'45',
			'45',
			'88',
		])
	})

	it('reports a repeated image once, against the first post it appears in', () => {
		const root = makeDocument(
			ownPost('45', '<img src="https://iili.io/aaaaaaaaa.png"><img src="https://iili.io/aaaaaaaaa.png">') +
				ownPost('88', '<img src="https://iili.io/aaaaaaaaa.png">')
		)

		expect(collectCandidateImages(root, 'SupermaN_CK', new Set())).toEqual([
			{ imageUrl: 'https://iili.io/aaaaaaaaa.png', imageId: 'aaaaaaaaa', postNumber: '45' },
		])
	})

	it('returns nothing without a username', () => {
		const root = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">'))

		expect(collectCandidateImages(root, '', new Set())).toEqual([])
	})

	it('handles a document with no posts at all', () => {
		expect(collectCandidateImages(makeDocument('<p>Nada</p>'), 'SupermaN_CK', new Set())).toEqual([])
	})

	/**
	 * querySelectorAll only searches descendants, so a post element passed as the root finds
	 * nothing: a post does not contain itself. That is what collectCandidatesInPost is for.
	 */
	it('finds nothing when handed a post element, which is why the per-post variant exists', () => {
		const post = makeDocument(ownPost('45', '<img src="https://iili.io/4ypDNabBJ.png">')).firstElementChild!

		expect(collectCandidateImages(post, 'SupermaN_CK', new Set())).toEqual([])
	})
})

describe('collectCandidatesInPost', () => {
	function makePost(html: string, author = 'SupermaN_CK', num = '45'): HTMLElement {
		const root = document.createElement('div')
		root.innerHTML = ownPost(num, html, author)
		return root.firstElementChild as HTMLElement
	}

	it('collects images from the post element itself', () => {
		expect(
			collectCandidatesInPost(makePost('<img src="https://iili.io/4ypDNabBJ.png">'), 'SupermaN_CK', new Set())
		).toEqual([{ imageUrl: 'https://iili.io/4ypDNabBJ.png', imageId: '4ypDNabBJ', postNumber: '45' }])
	})

	it('collects several cards from a single post', () => {
		const post = makePost('<img src="https://iili.io/aaaaaaaaa.png"><img src="https://iili.io/bbbbbbbbb.png">')

		expect(collectCandidatesInPost(post, 'SupermaN_CK', new Set())).toHaveLength(2)
	})

	it('ignores a post by another user', () => {
		const post = makePost('<img src="https://iili.io/4ypDNabBJ.png">', 'otro')

		expect(collectCandidatesInPost(post, 'SupermaN_CK', new Set())).toEqual([])
	})

	it('skips images already registered', () => {
		const post = makePost('<img src="https://iili.io/4ypDNabBJ.png">')

		expect(collectCandidatesInPost(post, 'SupermaN_CK', new Set(['4ypDNabBJ']))).toEqual([])
	})
})

describe('filterByCardShape', () => {
	const candidates = [
		{ imageUrl: 'card.png', imageId: 'cardaaaaa', postNumber: '45' },
		{ imageUrl: 'meme.png', imageId: 'memeaaaaa', postNumber: '45' },
		{ imageUrl: 'roto.png', imageId: 'rotoaaaaa', postNumber: '45' },
	]

	const measure = async (url: string) => {
		if (url === 'card.png') return CARD_RATIO
		if (url === 'meme.png') return 16 / 9
		return null
	}

	it('keeps only images shaped like a card', async () => {
		expect((await filterByCardShape(candidates, measure)).map(candidate => candidate.imageId)).toEqual(['cardaaaaa'])
	})

	it('drops images that cannot be measured rather than guessing', async () => {
		expect(await filterByCardShape(candidates, async () => null)).toEqual([])
	})

	it('keeps a resized copy of a card', async () => {
		expect(await filterByCardShape([{ imageUrl: 'card.png' }], async () => 600 / 226.5)).toHaveLength(1)
	})

	it('handles an empty list without measuring anything', async () => {
		let calls = 0
		await filterByCardShape([], async () => {
			calls += 1
			return CARD_RATIO
		})

		expect(calls).toBe(0)
	})
})
