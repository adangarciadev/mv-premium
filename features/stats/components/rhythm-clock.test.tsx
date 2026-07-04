import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RhythmClock } from './rhythm-clock'
import { accumulateRhythm, createEmptyRhythm, type RhythmStats } from '../logic/rhythm-model'

// Deterministic builders (no generateRandomRhythm) so states are stable.
const FIXED_NOW = new Date(2026, 5, 20, 12, 0, 0)

function makeEmptyStats(): RhythmStats {
	return createEmptyRhythm()
}

/** Some data, but under the 1 minute insight threshold (hasEnoughRhythmData). */
function makeInsufficientStats(): RhythmStats {
	const year = new Date().getFullYear()
	return accumulateRhythm(createEmptyRhythm(), 30_000, new Date(year, 0, 7, 14, 0), 'subtest')
}

/** Comfortably past the insight threshold, with a clear weekday (Wednesday). */
function makeShareableStats(): RhythmStats {
	let stats = createEmptyRhythm()
	const year = new Date().getFullYear()
	// Jan 7 and Jan 14 2026 are both Wednesdays (getDay() === 3).
	stats = accumulateRhythm(stats, 90 * 60_000, new Date(year, 0, 7, 14, 0), 'subtest')
	stats = accumulateRhythm(stats, 30 * 60_000, new Date(year, 0, 14, 15, 0), 'subtest')
	return stats
}

function makeStatsWithTodayAndBusierWeekday(): RhythmStats {
	let stats = createEmptyRhythm()
	const year = new Date().getFullYear()
	stats = accumulateRhythm(stats, 90 * 60_000, new Date(year, 0, 7, 14, 0), 'peakday')
	stats = accumulateRhythm(stats, 30 * 60_000, FIXED_NOW, 'today')
	return stats
}

function makeEightHourWeekdayStats(): RhythmStats {
	const year = new Date().getFullYear()
	return accumulateRhythm(createEmptyRhythm(), 8 * 60 * 60_000, new Date(year, 0, 5, 14, 0), 'workday')
}

function makeWeeklyScaleStats(): RhythmStats {
	let stats = createEmptyRhythm()
	const year = new Date().getFullYear()
	stats = accumulateRhythm(stats, 20 * 60 * 60_000, new Date(year, 0, 5, 14, 0), 'week-a')
	stats = accumulateRhythm(stats, 1 * 60 * 60_000, new Date(year, 0, 12, 14, 0), 'week-b')
	return stats
}

function makeStatsWithCurrentAndBusierPastWeek(): RhythmStats {
	let stats = createEmptyRhythm()
	const year = new Date().getFullYear()
	stats = accumulateRhythm(stats, 90 * 60_000, new Date(year, 0, 7, 14, 0), 'past-week')
	stats = accumulateRhythm(stats, 30 * 60_000, FIXED_NOW, 'current-week')
	return stats
}

describe('RhythmClock', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(FIXED_NOW)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('renders the empty state with no data', () => {
		render(<RhythmClock stats={makeEmptyStats()} />)

		expect(screen.getByText('Tiempo en Mediavida')).toBeInTheDocument()
		expect(screen.getAllByText('Aún sin datos').length).toBeGreaterThan(0)
		// Mature insights must not appear without data.
		expect(screen.queryByText('Media diaria general')).not.toBeInTheDocument()
	})

	it('renders the insufficient-data state without mature insights', () => {
		render(<RhythmClock stats={makeInsufficientStats()} />)

		expect(screen.getByText('Pocos datos aún')).toBeInTheDocument()
		expect(screen.queryByText('Media diaria general')).not.toBeInTheDocument()
	})

	it('renders insights, the share button and the Dónde panel when data is shareable', () => {
		render(<RhythmClock stats={makeShareableStats()} />)

		expect(screen.getByText('Tiempo en Mediavida')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Compartir resumen' })).toBeInTheDocument()
		expect(screen.getByText('Media diaria general')).toBeInTheDocument()
		expect(screen.getAllByText(/subtest/i).length).toBeGreaterThan(0)
	})

	it('selects a weekday when clicking a bar with data', () => {
		render(<RhythmClock stats={makeShareableStats()} />)

		// Before selecting, the selected-weekday controls are absent.
		expect(screen.queryByText('Ver día actual')).not.toBeInTheDocument()

		fireEvent.click(screen.getByLabelText(/Seleccionar Miércoles/))

		// Selecting a weekday switches the panel into the per-weekday view.
		expect(screen.getByText('Ver día actual')).toBeInTheDocument()
	})

	it('features the current weekday by default instead of the busiest weekday', () => {
		render(<RhythmClock stats={makeStatsWithTodayAndBusierWeekday()} />)

		expect(screen.getByText(/S.*bado .* MEDIA 30m/)).toBeInTheDocument()
		expect(screen.queryByText(/Mi.*rcoles .* MEDIA 1h 30m/)).not.toBeInTheDocument()
		expect(screen.queryByText(/Ver d.*a actual/)).not.toBeInTheDocument()
	})

	it('returns from another weekday to the current weekday', () => {
		render(<RhythmClock stats={makeStatsWithTodayAndBusierWeekday()} />)

		fireEvent.click(screen.getByLabelText(/Seleccionar Mi.*rcoles/))

		const currentDayButton = screen.getByText(/Ver d.*a actual/)
		expect(currentDayButton).toBeInTheDocument()

		fireEvent.click(currentDayButton)

		expect(screen.getByText(/S.*bado .* MEDIA 30m/)).toBeInTheDocument()
		expect(screen.queryByText(/Ver d.*a actual/)).not.toBeInTheDocument()
	})

	it('scales weekday bars against a full day instead of the busiest visible day', () => {
		render(<RhythmClock stats={makeEightHourWeekdayStats()} />)

		expect(screen.getByLabelText(/Seleccionar Lunes, MEDIA 8h/)).toHaveStyle({ height: '67%' })
	})

	it('scales weekly bars against a useful visual week instead of a relative curve', () => {
		render(<RhythmClock stats={makeWeeklyScaleStats()} />)

		fireEvent.click(screen.getByRole('button', { name: 'Semana' }))

		expect(screen.getByLabelText(/Ver d.*as de la semana .* TOTAL 20h/)).toHaveStyle({ height: '67%' })
	})

	it('features the current week by default instead of the busiest week', () => {
		render(<RhythmClock stats={makeStatsWithCurrentAndBusierPastWeek()} />)

		fireEvent.click(screen.getByRole('button', { name: 'Semana' }))

		expect(screen.getByText(/Semana del 15 al 21 de jun .* TOTAL 30m/)).toBeInTheDocument()
	})

	it('shows remaining time to share when data is partial', () => {
		render(<RhythmClock stats={makeInsufficientStats()} />)

		expect(screen.getByText(/Faltan .* para compartir/i)).toBeInTheDocument()
	})

	it('shows the ready chip when data is shareable', () => {
		render(<RhythmClock stats={makeShareableStats()} />)

		expect(screen.getByText('Listo para compartir')).toBeInTheDocument()
	})

	it('lets an hour wedge be focused and toggled with the keyboard', () => {
		const { container } = render(<RhythmClock stats={makeShareableStats()} />)

		// jsdom doesn't compute accessible names for SVG paths, so query by aria-label.
		const wedge = container.querySelector<SVGPathElement>('path[aria-label^="00:00"]')
		expect(wedge).not.toBeNull()
		expect(wedge).toHaveAttribute('role', 'button')
		expect(wedge).toHaveAttribute('tabindex', '0')
		expect(wedge).toHaveAttribute('aria-pressed', 'false')

		fireEvent.focus(wedge as SVGPathElement)
		fireEvent.keyDown(wedge as SVGPathElement, { key: 'Enter' })

		expect(wedge).toHaveAttribute('aria-pressed', 'true')
	})
})
