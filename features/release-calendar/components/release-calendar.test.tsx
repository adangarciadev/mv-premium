import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReleaseCalendar } from './release-calendar'
import type { UpcomingGameRelease } from '@/services/api/igdb'

const getUpcomingGameReleasesMock = vi.fn()
const settingsStoreMock = vi.hoisted(() => {
	const state: { gameReleaseCalendarLayout: 'showcase' | 'minimal' | 'bottom' } = {
		gameReleaseCalendarLayout: 'minimal',
	}

	return {
		state,
		setSetting: vi.fn((key: string, value: string) => {
			if (key === 'gameReleaseCalendarLayout') {
				state.gameReleaseCalendarLayout = value as typeof state.gameReleaseCalendarLayout
			}
		}),
	}
})

vi.mock('@/services/api/igdb', () => ({
	hasIgdbCredentials: vi.fn(() => Promise.resolve(true)),
	getUpcomingGameReleases: (...args: unknown[]) => getUpcomingGameReleasesMock(...args),
	getGameTemplateString: vi.fn(),
}))

vi.mock('../logic/thread-prefill', () => ({
	saveReleaseThreadPrefill: vi.fn(),
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: (selector: (state: unknown) => unknown) =>
		selector({
			gameReleaseCalendarLayout: settingsStoreMock.state.gameReleaseCalendarLayout,
			setSetting: settingsStoreMock.setSetting,
		}),
}))

const release: UpcomingGameRelease = {
	id: 1,
	name: 'Subnautica 2',
	slug: 'subnautica-2',
	coverUrl: 'https://example.com/subnautica.jpg',
	heroUrl: null,
	releaseDate: '2026-05-14',
	releaseTimestamp: 1_778_716_800,
	platforms: ['PC', 'Xbox Series X|S'],
	releasePlatforms: ['PC', 'Xbox Series X|S'],
	platformLogos: [],
	igdbUrl: 'https://www.igdb.com/games/subnautica-2',
	relevanceScore: 80,
	hypes: 20,
	follows: 0,
	rating: null,
	ratingCount: 0,
}

describe('ReleaseCalendar', () => {
	beforeEach(() => {
		getUpcomingGameReleasesMock.mockResolvedValue([release])
		settingsStoreMock.state.gameReleaseCalendarLayout = 'minimal'
		settingsStoreMock.setSetting.mockClear()
	})

	afterEach(() => {
		getUpcomingGameReleasesMock.mockReset()
	})

	it('loads and labels releases for the next 30 days', async () => {
		render(<ReleaseCalendar />)

		await waitFor(() => expect(getUpcomingGameReleasesMock).toHaveBeenCalled())

		const [{ from, to, limit }] = getUpcomingGameReleasesMock.mock.calls[0]
		expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(30)
		expect(limit).toBeUndefined()
		expect(screen.getByText('Próximos 30 días')).toBeInTheDocument()
	})

	it('uses minimal layout by default', async () => {
		render(<ReleaseCalendar />)

		await screen.findByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')

		expect(screen.getByRole('button', { name: 'Minimalista' })).toHaveClass('bg-primary')
		expect(screen.queryByText('Subnautica 2')).not.toBeInTheDocument()
		expect(screen.getByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')).toBeInTheDocument()
	})

	it('switches between carousel, minimal, and bottom layouts', async () => {
		const user = userEvent.setup()
		render(<ReleaseCalendar />)

		await screen.findByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')

		await user.click(screen.getByRole('button', { name: 'Carrusel' }))
		expect(screen.getByText('Plataformas')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Minimalista' }))
		expect(screen.queryByText('Subnautica 2')).not.toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Inferior' }))
		expect(screen.getByText('1 destacados')).toBeInTheDocument()
		expect(screen.getByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Crear hilo de Subnautica 2' })).toBeInTheDocument()
	})

	it('replaces the list layout with a minimal poster/date view', async () => {
		const user = userEvent.setup()
		render(<ReleaseCalendar />)

		await screen.findByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')

		expect(screen.queryByRole('button', { name: 'Lista' })).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Minimalista' }))

		expect(screen.queryByText('Subnautica 2')).not.toBeInTheDocument()
		expect(screen.getByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')).toBeInTheDocument()
		expect(screen.getByText('14 may')).toBeInTheDocument()
	})

	it('shows a create thread button in minimal layout', async () => {
		render(<ReleaseCalendar />)

		await screen.findByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')

		expect(screen.getByRole('button', { name: 'Crear hilo de Subnautica 2' })).toBeInTheDocument()
	})

	it('groups Xbox and Series X|S into a single Xbox platform badge', async () => {
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				platforms: ['Xbox', 'Series X|S', 'PC'],
				releasePlatforms: ['Xbox', 'Series X|S', 'PC'],
			},
		])

		render(<ReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		const title = await screen.findByText('Subnautica 2')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getAllByText('Xbox')).toHaveLength(1)
		expect(within(card!).queryByText('Series X|S')).not.toBeInTheDocument()
	})

	it('groups PS4 and PS5 into a single PlayStation platform badge', async () => {
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				platforms: ['PS4', 'PS5', 'PC'],
				releasePlatforms: ['PS4', 'PS5', 'PC'],
			},
		])

		render(<ReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		const title = await screen.findByText('Subnautica 2')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getAllByText('PlayStation')).toHaveLength(1)
		expect(within(card!).queryByText('PS4')).not.toBeInTheDocument()
		expect(within(card!).queryByText('PS5')).not.toBeInTheDocument()
	})

	it('shows all game platforms, not only the platforms released on the displayed date', async () => {
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				platforms: ['PC', 'PS5'],
				releasePlatforms: ['PC'],
			},
		])

		render(<ReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		const title = await screen.findByText('Subnautica 2')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getByText('Plataformas')).toBeInTheDocument()
		expect(within(card!).getByText('PC')).toBeInTheDocument()
		expect(within(card!).getByText('PlayStation')).toBeInTheDocument()
	})

	it('matches Xbox filter when the release platform is Series X|S', async () => {
		const user = userEvent.setup()
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				platforms: ['PC', 'Series X|S'],
				releasePlatforms: ['Series X|S'],
			},
		])

		render(<ReleaseCalendar />)

		await user.click(screen.getByRole('button', { name: 'Xbox' }))

		expect(screen.getByTitle('Subnautica 2 · 14 may · Plataformas: PC, Xbox')).toBeInTheDocument()
		expect(screen.queryByText('No hay lanzamientos próximos para este filtro.')).not.toBeInTheDocument()
	})

	it('keeps the active Xbox platform visible when a release has many platforms', async () => {
		const user = userEvent.setup()
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				name: 'RoadOut',
				platforms: ['Nintendo Switch', 'PC', 'PS5', 'Xbox Series X|S'],
				releasePlatforms: ['Nintendo Switch', 'PC', 'PS5', 'Xbox Series X|S'],
			},
		])

		render(<ReleaseCalendar />)

		await screen.findByTitle('RoadOut · 14 may · Plataformas: Nintendo Switch, PC, PlayStation, Xbox')
		await user.click(screen.getByRole('button', { name: 'Xbox' }))
		await user.click(screen.getByRole('button', { name: 'Carrusel' }))

		const title = await screen.findByText('RoadOut')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getByText('Xbox')).toBeInTheDocument()
	})

	it('shows every platform released on that date', async () => {
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				platforms: ['PC', 'PS5', 'Xbox Series X|S', 'Nintendo Switch', 'Meta Quest 3'],
				releasePlatforms: ['PC', 'PS5', 'Xbox Series X|S', 'Nintendo Switch', 'Meta Quest 3'],
			},
		])

		render(<ReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		const title = await screen.findByText('Subnautica 2')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getByText('PC')).toBeInTheDocument()
		expect(within(card!).getByText('PlayStation')).toBeInTheDocument()
		expect(within(card!).getByText('Xbox')).toBeInTheDocument()
		expect(within(card!).getByText('Nintendo Switch')).toBeInTheDocument()
		expect(within(card!).getByText('Meta Quest 3')).toBeInTheDocument()
	})

	it('curates busy days by relevance instead of showing every release', async () => {
		getUpcomingGameReleasesMock.mockResolvedValue(
			Array.from({ length: 8 }, (_, index) => ({
				...release,
				id: index + 1,
				name: `Busy Day Game ${index + 1}`,
				slug: `busy-day-game-${index + 1}`,
				relevanceScore: 100 - index,
				hypes: 8 - index,
			}))
		)

		render(<ReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		await screen.findByText('Busy Day Game 1')

		expect(screen.getByText('Busy Day Game 5')).toBeInTheDocument()
		expect(screen.queryByText('Busy Day Game 6')).not.toBeInTheDocument()
		expect(screen.queryByText('Busy Day Game 8')).not.toBeInTheDocument()
	})

	it('keeps the platform filter before curation so platform launches are not hidden by other platforms', async () => {
		const user = userEvent.setup()
		getUpcomingGameReleasesMock.mockResolvedValue([
			...Array.from({ length: 7 }, (_, index) => ({
				...release,
				id: index + 1,
				name: `PC Launch ${index + 1}`,
				slug: `pc-launch-${index + 1}`,
				releasePlatforms: ['PC'],
				platforms: ['PC'],
				relevanceScore: 120 - index,
				hypes: 10 - index,
			})),
			{
				...release,
				id: 99,
				name: 'Xbox Port',
				slug: 'xbox-port',
				releasePlatforms: ['Xbox Series X|S'],
				platforms: ['Xbox Series X|S'],
				relevanceScore: 45,
				hypes: 0,
			},
		])

		render(<ReleaseCalendar />)

		await screen.findByTitle('PC Launch 1 · 14 may · Plataformas: PC')
		expect(screen.queryByTitle('Xbox Port · 14 may · Plataformas: Xbox')).not.toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Xbox' }))

		expect(await screen.findByTitle('Xbox Port · 14 may · Plataformas: Xbox')).toBeInTheDocument()
	})

	it('matches platform filters against all known game platforms', async () => {
		const user = userEvent.setup()
		getUpcomingGameReleasesMock.mockResolvedValue([
			{
				...release,
				name: 'Forza Horizon 6',
				platforms: ['PC', 'Xbox Series X|S', 'PS5'],
				releasePlatforms: ['PC', 'Xbox Series X|S'],
			},
		])

		render(<ReleaseCalendar />)

		await screen.findByTitle('Forza Horizon 6 · 14 may · Plataformas: PC, Xbox, PlayStation')
		await user.click(screen.getByRole('button', { name: 'PlayStation' }))
		await user.click(screen.getByRole('button', { name: 'Carrusel' }))

		const title = await screen.findByText('Forza Horizon 6')
		const card = title.closest('article')

		expect(card).not.toBeNull()
		expect(within(card!).getByText('PlayStation')).toBeInTheDocument()
	})
})
