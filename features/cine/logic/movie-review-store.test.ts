import { beforeEach, describe, expect, it, vi } from 'vitest'

const storageValues = vi.hoisted(() => new Map<string, unknown>())

vi.mock('#imports', () => ({
	storage: {
		defineItem: <T>(key: string, options?: { defaultValue?: T }) => ({
			getValue: vi.fn(() => Promise.resolve((storageValues.get(key) ?? options?.defaultValue) as T)),
			setValue: vi.fn((value: T) => {
				storageValues.set(key, value)
				return Promise.resolve()
			}),
			removeValue: vi.fn(() => {
				storageValues.delete(key)
				return Promise.resolve()
			}),
			watch: vi.fn(() => vi.fn()),
		}),
	},
}))

import {
	buildGeneratedReviewRecord,
	buildImportedReviewRecord,
	confirmMovieReviewPublication,
	deleteMovieReview,
	getMovieReviews,
	getPendingMovieReviews,
	movieReviewsStorage,
	recordGeneratedMovieReview,
	updateMovieReview,
	upsertMovieReview,
	type MovieReviewRecord,
} from './movie-review-store'
import type { MovieReviewCardData } from './movie-review'

function makeRecord(overrides: Partial<MovieReviewRecord> = {}): MovieReviewRecord {
	return {
		imageId: '4ypDNabBJ',
		imageUrl: 'https://iili.io/4ypDNabBJ.png',
		tmdbId: 693134,
		title: 'Dune: Parte dos',
		year: '2024',
		posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
		rating: 8.5,
		badge: 'masterpiece',
		quote: 'Un espectáculo de una ambición desmedida.',
		createdAt: 1_700_000_000_000,
		source: 'generated',
		publication: null,
		...overrides,
	}
}

function makeCardData(overrides: Partial<MovieReviewCardData> = {}): MovieReviewCardData {
	return {
		title: 'Dune: Parte dos',
		director: 'Denis Villeneuve',
		year: '2024',
		genres: ['Ciencia ficción', 'Aventura'],
		posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
		backdropUrl: 'https://image.tmdb.org/t/p/w780/backdrop.jpg',
		rating: 8.5,
		quote: 'Un espectáculo de una ambición desmedida.',
		username: 'adan',
		badge: 'masterpiece',
		rewatch: false,
		...overrides,
	}
}

const publishedAt = (postNumber: string): MovieReviewRecord['publication'] => ({
	threadUrl: 'https://www.mediavida.com/foro/cine/hilo-123',
	threadTitle: 'Hilo de cine',
	postNumber,
	confirmedAt: 1_700_000_100_000,
})

describe('movie review store', () => {
	beforeEach(() => {
		storageValues.clear()
	})

	it('starts empty', async () => {
		expect(await getMovieReviews()).toEqual([])
	})

	it('upserts keyed by imageId rather than by URL', async () => {
		await upsertMovieReview(makeRecord({ rating: 7 }))
		await upsertMovieReview(makeRecord({ rating: 9, imageUrl: 'http://iili.io/4ypDNabBJ_th.png' }))

		const records = await getMovieReviews()
		expect(records).toHaveLength(1)
		expect(records[0].rating).toBe(9)
	})

	it('keeps distinct identifiers apart and returns newest first', async () => {
		await upsertMovieReview(makeRecord({ imageId: 'aaaaaaaaa', createdAt: 1000 }))
		await upsertMovieReview(makeRecord({ imageId: 'bbbbbbbbb', createdAt: 2000 }))

		expect((await getMovieReviews()).map(record => record.imageId)).toEqual(['bbbbbbbbb', 'aaaaaaaaa'])
	})

	it('confirms publication on an existing record', async () => {
		await upsertMovieReview(makeRecord())

		expect(await confirmMovieReviewPublication('4ypDNabBJ', publishedAt('45')!)).toBe(true)

		const [record] = await getMovieReviews()
		expect(record.publication?.postNumber).toBe('45')
		expect(record.publication?.threadTitle).toBe('Hilo de cine')
	})

	it('reports failure when confirming an unknown identifier', async () => {
		expect(await confirmMovieReviewPublication('nosuchid00', publishedAt('1')!)).toBe(false)
	})

	it('lists only unpublished records as pending', async () => {
		await upsertMovieReview(makeRecord({ imageId: 'pendingaaa' }))
		await upsertMovieReview(makeRecord({ imageId: 'publishedb', publication: publishedAt('1') }))

		expect((await getPendingMovieReviews()).map(record => record.imageId)).toEqual(['pendingaaa'])
	})

	it('deletes by identifier and reports whether anything went', async () => {
		await upsertMovieReview(makeRecord())

		expect(await deleteMovieReview('4ypDNabBJ')).toBe(true)
		expect(await deleteMovieReview('4ypDNabBJ')).toBe(false)
		expect(await getMovieReviews()).toEqual([])
	})

	it('discards malformed persisted data instead of throwing', async () => {
		await movieReviewsStorage.setValue([
			null,
			'nonsense',
			{ imageId: '' },
			{ imageId: 'validaaaaa', rating: 'high' },
			makeRecord({ imageId: 'goodrecord' }),
		] as unknown as MovieReviewRecord[])

		expect((await getMovieReviews()).map(record => record.imageId)).toEqual(['goodrecord'])
	})

	it('survives a non-array value in storage', async () => {
		await movieReviewsStorage.setValue({ nope: true } as unknown as MovieReviewRecord[])

		expect(await getMovieReviews()).toEqual([])
	})
})

describe('buildGeneratedReviewRecord', () => {
	it('builds a pending record from the card data', () => {
		const record = buildGeneratedReviewRecord(makeCardData(), 693134, 'https://iili.io/4ypDNabBJ.png', 5000)

		expect(record).toEqual({
			imageId: '4ypDNabBJ',
			imageUrl: 'https://iili.io/4ypDNabBJ.png',
			tmdbId: 693134,
			title: 'Dune: Parte dos',
			year: '2024',
			posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
			rating: 8.5,
			badge: 'masterpiece',
			quote: 'Un espectáculo de una ambición desmedida.',
			createdAt: 5000,
			source: 'generated',
			publication: null,
			rewatch: false,
		})
	})

	it('carries the rewatch the user declared on the card', () => {
		const record = buildGeneratedReviewRecord(
			makeCardData({ rewatch: true }),
			693134,
			'https://iili.io/4ypDNabBJ.png',
			5000
		)

		expect(record?.rewatch).toBe(true)
	})

	it('keeps the whole path as identity for an ImgBB upload', () => {
		const record = buildGeneratedReviewRecord(
			makeCardData(),
			1,
			'https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg',
			5000
		)

		expect(record?.imageId).toBe('0jZ8XKq/image-1700000000000')
	})

	it('refuses to build a record when the URL yields no usable identifier', () => {
		expect(buildGeneratedReviewRecord(makeCardData(), 1, 'https://iili.io/ab.png', 0)).toBeNull()
	})

	it('refuses to build a record without a rating', () => {
		expect(buildGeneratedReviewRecord(makeCardData({ rating: null }), 1, 'https://iili.io/4ypDNabBJ.png', 0)).toBeNull()
	})
})

describe('recordGeneratedMovieReview', () => {
	beforeEach(() => {
		storageValues.clear()
	})

	it('persists a pending record', async () => {
		await recordGeneratedMovieReview(makeCardData(), 693134, 'https://iili.io/4ypDNabBJ.png')

		const [record] = await getMovieReviews()
		expect(record.imageId).toBe('4ypDNabBJ')
		expect(record.publication).toBeNull()
		expect(record.source).toBe('generated')
	})

	it('stores nothing when the record cannot be built, and does not throw', async () => {
		await expect(recordGeneratedMovieReview(makeCardData(), 1, 'https://iili.io/ab.png')).resolves.toBeUndefined()

		expect(await getMovieReviews()).toEqual([])
	})
})

describe('buildImportedReviewRecord', () => {
	const publication = {
		threadUrl: 'https://www.mediavida.com/foro/cine/hilo-123',
		threadTitle: 'Hilo de cine',
		postNumber: '45',
		confirmedAt: 1_700_000_000_000,
	}

	function makeInput(overrides: Record<string, unknown> = {}) {
		return {
			imageUrl: 'https://iili.io/4ypDNabBJ.png',
			tmdbId: 693134,
			title: 'Dune: Parte dos',
			year: '2024',
			posterUrl: null,
			rating: 8.5,
			badge: 'masterpiece' as const,
			publication,
			...overrides,
		}
	}

	it('builds a record that is already published', () => {
		expect(buildImportedReviewRecord(makeInput(), 5000)).toMatchObject({
			imageId: '4ypDNabBJ',
			source: 'imported',
			rating: 8.5,
			createdAt: 5000,
			publication,
		})
	})

	it('leaves the quote empty, because it cannot be recovered from the image', () => {
		expect(buildImportedReviewRecord(makeInput(), 0)?.quote).toBe('')
	})

	it('keeps the whole path as identity for an ImgBB upload', () => {
		const record = buildImportedReviewRecord(
			makeInput({ imageUrl: 'https://i.ibb.co/0jZ8XKq/image-1700000000000.jpg' }),
			0
		)

		expect(record?.imageId).toBe('0jZ8XKq/image-1700000000000')
	})

	it('refuses to build a record without a usable identifier', () => {
		expect(buildImportedReviewRecord(makeInput({ imageUrl: 'https://iili.io/ab.png' }), 0)).toBeNull()
	})
})

describe('updateMovieReview', () => {
	beforeEach(() => {
		storageValues.clear()
	})

	it('corrects a wrongly picked film without touching its publication', async () => {
		await upsertMovieReview(makeRecord({ publication: publishedAt('45') }))

		expect(await updateMovieReview('4ypDNabBJ', { title: 'Otra película', tmdbId: 999, rating: 6 })).toBe(true)

		const [record] = await getMovieReviews()
		expect(record.title).toBe('Otra película')
		expect(record.tmdbId).toBe(999)
		expect(record.rating).toBe(6)
		expect(record.publication?.postNumber).toBe('45')
	})

	it('leaves untouched fields alone', async () => {
		await upsertMovieReview(makeRecord())

		await updateMovieReview('4ypDNabBJ', { rating: 6 })

		const [record] = await getMovieReviews()
		expect(record.title).toBe('Dune: Parte dos')
		expect(record.badge).toBe('masterpiece')
	})

	it('reports failure for an unknown identifier', async () => {
		expect(await updateMovieReview('nosuchid00', { rating: 5 })).toBe(false)
	})
})
