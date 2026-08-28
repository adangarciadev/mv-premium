import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FootballCalendar } from './football-calendar'

const fetchCompetitionMatchesMock = vi.hoisted(() => vi.fn())
const fetchCompetitionStandingsMock = vi.hoisted(() => vi.fn())
const settingsState = vi.hoisted(() => ({
	footballFavoriteTeamIds: [] as number[],
	setFootballFavoriteTeamIds: vi.fn(),
}))

vi.mock('@/services', () => ({
	fetchCompetitionMatches: fetchCompetitionMatchesMock,
	// The calendar mounts the standings panel, which reads these on render.
	fetchCompetitionStandings: fetchCompetitionStandingsMock,
	getCurrentSeasonStartYear: () => 2026,
	// Keeps the live-refresh ticker out of the tests.
	shouldPollMatches: () => false,
	shouldWatchMatches: () => false,
}))

vi.mock('@/store/settings-store', () => ({
	useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}))

describe('FootballCalendar', () => {
	beforeEach(() => {
		fetchCompetitionMatchesMock.mockReset()
		fetchCompetitionStandingsMock.mockReset()
		settingsState.footballFavoriteTeamIds = []
		settingsState.setFootballFavoriteTeamIds.mockClear()
	})

	it('shows the registration guidance for a missing API key', async () => {
		fetchCompetitionMatchesMock.mockResolvedValue({ ok: false, reason: 'no-key' })

		render(<FootballCalendar />)

		expect(await screen.findByText('Configura una API key para ver el calendario')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: /football-data\.org/ })).toHaveAttribute(
			'href',
			'https://www.football-data.org/client/register'
		)
	})

	it('shows the unpublished Champions calendar message for an empty response', async () => {
		fetchCompetitionMatchesMock.mockImplementation(async () => ({ ok: true, matches: [] }))
		const user = userEvent.setup()

		render(<FootballCalendar />)
		await waitFor(() => expect(fetchCompetitionMatchesMock).toHaveBeenCalledWith('PD'))
		await user.click(screen.getByRole('button', { name: 'Champions' }))

		expect(await screen.findByText('La Champions 2026/27 todavía no tiene calendario publicado')).toBeInTheDocument()
		expect(screen.queryByText(/No se pudo conectar|API key no es válida|Límite de peticiones/)).not.toBeInTheDocument()
	})

	it('disables the favorites-only switch when no favorite teams exist', async () => {
		fetchCompetitionMatchesMock.mockResolvedValue({ ok: true, matches: [] })

		render(<FootballCalendar />)

		expect(await screen.findByRole('switch', { name: 'Solo mis equipos' })).toBeDisabled()
	})

	it('renders matches grouped inside the complete calendar panel', async () => {
		fetchCompetitionMatchesMock.mockResolvedValue({
			ok: true,
			matches: [
				{
					id: 1,
					utcDate: '2026-08-20T18:00:00.000Z',
					status: 'TIMED',
					competition: 'PD',
					matchday: 1,
					stage: 'REGULAR_SEASON',
					minute: null,
					home: { id: 10, name: 'Casa FC', shortName: 'Casa', tla: 'CAS', crest: 'https://example.com/casa.png' },
					away: { id: 20, name: 'Visitante FC', shortName: 'Visitante', tla: 'VIS', crest: 'https://example.com/visitante.png' },
					score: null,
				},
			],
		})

		render(<FootballCalendar />)

		expect(await screen.findByText('Casa FC')).toBeInTheDocument()
		expect(screen.getByText('Jornada')).toBeInTheDocument()
		expect(screen.getByText('1', { exact: true })).toBeInTheDocument()
		expect(screen.getByRole('heading', { name: 'Calendario de fútbol' }).closest('section')).not.toBeNull()
		expect(screen.queryByText('Fútbol', { exact: true })).not.toBeInTheDocument()
	})
})
