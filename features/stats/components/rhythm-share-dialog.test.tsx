import { describe, it, expect } from 'vitest'
import { render, within } from '@testing-library/react'
import { RhythmShareDialog } from './rhythm-share-dialog'
import { createEmptyRhythm, type RhythmStats } from '../logic/rhythm-model'

function makeEmptyStats(): RhythmStats {
	return createEmptyRhythm()
}

const noop = () => {}

/**
 * The dialog portals into a (closed in test mode) Shadow DOM host, so `screen`
 * can't reach it. Query through the shadow root instead.
 */
function shadowScope() {
	const host = document.getElementById('mvp-shadow-host') as
		| (HTMLElement & { __shadowRoot?: ShadowRoot })
		| null
	const root = host?.shadowRoot ?? host?.__shadowRoot
	if (!root) throw new Error('Shadow root not found')
	return within(root as unknown as HTMLElement)
}

describe('RhythmShareDialog (sharing unavailable)', () => {
	it('shows the dialog title when open', () => {
		render(<RhythmShareDialog open onOpenChange={noop} stats={makeEmptyStats()} />)

		expect(shadowScope().getByText('Compartir resumen')).toBeInTheDocument()
	})

	it('explains why a scope cannot be shared on disabled options', () => {
		render(<RhythmShareDialog open onOpenChange={noop} stats={makeEmptyStats()} />)

		// The "Año actual" option is disabled and surfaces its reason as the description.
		expect(shadowScope().getAllByText(/al menos 1 h registrada este año/i).length).toBeGreaterThan(0)
	})

	it('disables copy and download when no scope can be exported', () => {
		render(<RhythmShareDialog open onOpenChange={noop} stats={makeEmptyStats()} />)

		const ui = shadowScope()
		expect(ui.getByRole('button', { name: /Copiar imagen/ })).toBeDisabled()
		expect(ui.getByRole('button', { name: /Descargar PNG/ })).toBeDisabled()
	})

	it('shows the insufficient-data preview, not the loading state', () => {
		render(<RhythmShareDialog open onOpenChange={noop} stats={makeEmptyStats()} />)

		const ui = shadowScope()
		expect(ui.getByText('Datos insuficientes')).toBeInTheDocument()
		expect(ui.queryByText('Preparando imagen')).not.toBeInTheDocument()
	})
})
