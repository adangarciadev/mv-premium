import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RhythmClock } from './rhythm-clock'
import { accumulateRhythm, createEmptyRhythm, type RhythmStats } from '../logic/rhythm-model'

// Deterministic builders (no generateRandomRhythm) so states are stable.

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

describe('RhythmClock', () => {
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
})
