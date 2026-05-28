import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MovieReleaseCalendar } from './movie-release-calendar'
import type { UpcomingSpanishMovieRelease } from '@/services/api/tmdb'

const {
	getUpcomingSpanishMovieReleasesMock,
	getMovieThreadPrefillDataMock,
	hasTmdbApiKeyMock,
	savePrefillMock,
	settingsState,
} = vi.hoisted(() => ({
	getUpcomingSpanishMovieReleasesMock: vi.fn(),
	getMovieThreadPrefillDataMock: vi.fn(),
	hasTmdbApiKeyMock: vi.fn(),
	savePrefillMock: vi.fn(),
	settingsState: {
		movieReleaseCalendarLayout: 'minimal' as 'showcase' | 'minimal' | 'bottom',
		setSetting: vi.fn((key: string, value: 'showcase' | 'minimal' | 'bottom') => {
			if (key === 'movieReleaseCalendarLayout') {
				settingsState.movieReleaseCalendarLayout = value
			}
		}),
	},
}))

vi.mock('@/services/api/tmdb', () => ({
	hasTmdbApiKey: () => hasTmdbApiKeyMock(),
	getUpcomingSpanishMovieReleases: (...args: unknown[]) => getUpcomingSpanishMovieReleasesMock(...args),
	getMovieThreadPrefillData: (...args: unknown[]) => getMovieThreadPrefillDataMock(...args),
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: (selector: (state: unknown) => unknown) =>
		selector({
			movieReleaseCalendarLayout: settingsState.movieReleaseCalendarLayout,
			setSetting: settingsState.setSetting,
		}),
}))

vi.mock('@/features/release-calendar/logic/thread-prefill', () => ({
	saveReleaseThreadPrefill: (...args: unknown[]) => savePrefillMock(...args),
}))

function dateAfter(days: number): string {
	const date = new Date()
	date.setHours(0, 0, 0, 0)
	date.setDate(date.getDate() + days)
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function makeRelease(overrides: Partial<UpcomingSpanishMovieRelease>): UpcomingSpanishMovieRelease {
	const releaseDate = overrides.releaseDate ?? dateAfter(2)
	return {
		id: 1,
		title: 'Dune: Parte Tres',
		originalTitle: 'Dune: Part Three',
		overview: 'Arrakis vuelve a estar animada.',
		posterUrl: 'https://example.com/dune.jpg',
		backdropUrl: null,
		releaseDate,
		releaseTimestamp: new Date(`${releaseDate}T00:00:00`).getTime(),
		voteAverage: 7.4,
		popularity: 12,
		voteCount: 20,
		genreIds: [878],
		genres: ['Ciencia ficción', 'Aventura'],
		director: 'Denis Villeneuve',
		runtime: 166,
		releaseNote: null,
		isRerelease: false,
		source: 'tmdb',
		tmdbUrl: 'https://www.themoviedb.org/movie/1',
		...overrides,
	}
}

describe('MovieReleaseCalendar', () => {
	beforeEach(() => {
		hasTmdbApiKeyMock.mockReset()
		getUpcomingSpanishMovieReleasesMock.mockReset()
		getMovieThreadPrefillDataMock.mockReset()
		savePrefillMock.mockReset()
		settingsState.setSetting.mockClear()
		settingsState.movieReleaseCalendarLayout = 'minimal'
		hasTmdbApiKeyMock.mockResolvedValue(true)
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([makeRelease({})])
		getMovieThreadPrefillDataMock.mockResolvedValue({
			title: "'Dune: Parte Tres', de Denis Villeneuve (2026)",
			body: '[b]Dune: Parte Tres[/b]',
		})
	})

	it('loads Spanish movie releases for the next 30 days', async () => {
		render(<MovieReleaseCalendar />)

		await waitFor(() => expect(getUpcomingSpanishMovieReleasesMock).toHaveBeenCalled())

		const [{ from, to, limit }] = getUpcomingSpanishMovieReleasesMock.mock.calls[0]
		expect(Math.round((to.getTime() - from.getTime()) / 86_400_000)).toBe(30)
		expect(limit).toBe(72)
		expect(await screen.findByTitle(/Dune: Parte Tres/)).toBeInTheDocument()
		expect(screen.getByText('Cine en España · 30 días')).toBeInTheDocument()
	})

	it('shows a missing TMDB key state', async () => {
		hasTmdbApiKeyMock.mockResolvedValue(false)

		render(<MovieReleaseCalendar />)

		expect(await screen.findByText('TMDB no está configurado en la extensión.')).toBeInTheDocument()
		expect(getUpcomingSpanishMovieReleasesMock).not.toHaveBeenCalled()
	})

	it('switches between carousel, minimal, and bottom layouts', async () => {
		const user = userEvent.setup()
		render(<MovieReleaseCalendar />)

		await screen.findByTitle(/Dune: Parte Tres/)

		await user.click(screen.getByRole('button', { name: 'Carrusel' }))
		expect(settingsState.setSetting).toHaveBeenCalledWith('movieReleaseCalendarLayout', 'showcase')
		expect(screen.getByRole('button', { name: 'Crear hilo de Dune: Parte Tres' })).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Minimalista' }))
		expect(settingsState.setSetting).toHaveBeenCalledWith('movieReleaseCalendarLayout', 'minimal')

		await user.click(screen.getByRole('button', { name: 'Inferior' }))
		expect(settingsState.setSetting).toHaveBeenCalledWith('movieReleaseCalendarLayout', 'bottom')
	})

	it('does not show TMDB links or vote labels on movie cards', async () => {
		render(<MovieReleaseCalendar />)

		await screen.findByTitle(/Dune: Parte Tres/)

		expect(screen.queryByText('TMDB')).not.toBeInTheDocument()
		expect(screen.queryByText('7.4')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Origen de los estrenos' })).toBeInTheDocument()
	})

	it('shows genres, director, and runtime below carousel movie posters', async () => {
		const user = userEvent.setup()
		render(<MovieReleaseCalendar />)

		await user.click(screen.getByRole('button', { name: 'Carrusel' }))
		await screen.findByText('Dune: Parte Tres')

		expect(screen.getByText('Dune: Parte Tres')).toBeInTheDocument()
		expect(screen.getByText(/Ciencia ficción/)).toBeInTheDocument()
		expect(screen.getByText('Dirección')).toBeInTheDocument()
		expect(screen.getByText('Duración')).toBeInTheDocument()
		expect(screen.getByText('Género')).toBeInTheDocument()
		expect(screen.getByText(/Denis Villeneuve/)).toBeInTheDocument()
		expect(screen.getByText('166 minutos')).toBeInTheDocument()
		expect(screen.getByText('Estreno')).toBeInTheDocument()
	})

	it('shows movie metadata and rerelease labels in the carousel view', async () => {
		const user = userEvent.setup()
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([
			makeRelease({
				title: 'Shrek',
				releaseDate: dateAfter(4),
				releaseNote: '25th Anniversary re-release',
				isRerelease: true,
				genres: ['Animación'],
				director: 'Andrew Adamson',
				runtime: 87,
			}),
		])

		render(<MovieReleaseCalendar />)

		await user.click(screen.getByRole('button', { name: 'Carrusel' }))

		expect(await screen.findByText('Shrek')).toBeInTheDocument()
		expect(screen.getByText(/Reestreno aniversario/)).toBeInTheDocument()
		expect(screen.getByText(/Animación/)).toBeInTheDocument()
		expect(screen.getByText(/Andrew Adamson/)).toBeInTheDocument()
		expect(screen.getByText('87 minutos')).toBeInTheDocument()
	})

	it('shows only the all, 7-day, and 14-day filters', async () => {
		render(<MovieReleaseCalendar />)

		await screen.findByTitle(/Dune: Parte Tres/)

		expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '7 días' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: '14 días' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Reestrenos' })).not.toBeInTheDocument()
	})

	it('filters releases to the next 14 days', async () => {
		const user = userEvent.setup()
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([
			makeRelease({ id: 2, title: 'Estreno cercano', releaseDate: dateAfter(12) }),
			makeRelease({ id: 3, title: 'Estreno lejano', releaseDate: dateAfter(20) }),
		])

		render(<MovieReleaseCalendar />)

		await screen.findByTitle(/Estreno lejano/)
		await user.click(screen.getByRole('button', { name: '14 días' }))

		expect(screen.getByTitle(/Estreno cercano/)).toBeInTheDocument()
		expect(screen.queryByTitle(/Estreno lejano/)).not.toBeInTheDocument()
	})

	it('sorts releases by Spanish release date', async () => {
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([
			makeRelease({ id: 2, title: 'La segunda', releaseDate: dateAfter(12) }),
			makeRelease({ id: 3, title: 'La primera', releaseDate: dateAfter(1) }),
		])

		render(<MovieReleaseCalendar />)

		await userEvent.click(screen.getByRole('button', { name: 'Carrusel' }))
		await screen.findByText('La primera')
		const titles = screen.getAllByRole('heading', { level: 3 }).map(node => node.textContent)
		expect(titles).toEqual(['La primera', 'La segunda'])
	})

	it('filters releases to the next 7 days', async () => {
		const user = userEvent.setup()
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([
			makeRelease({ id: 2, title: 'Estreno cercano', releaseDate: dateAfter(3) }),
			makeRelease({ id: 3, title: 'Estreno lejano', releaseDate: dateAfter(20) }),
		])

		render(<MovieReleaseCalendar />)

		await screen.findByTitle(/Estreno lejano/)
		await user.click(screen.getByRole('button', { name: '7 días' }))

		expect(screen.getByTitle(/Estreno cercano/)).toBeInTheDocument()
		expect(screen.queryByTitle(/Estreno lejano/)).not.toBeInTheDocument()
	})

	it('shows an empty state when there are no releases', async () => {
		getUpcomingSpanishMovieReleasesMock.mockResolvedValue([])

		render(<MovieReleaseCalendar />)

		expect(await screen.findByText('No hay estrenos próximos para este filtro.')).toBeInTheDocument()
	})
})
