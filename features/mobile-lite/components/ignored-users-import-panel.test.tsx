import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { IgnoredUsersSyncPayload } from '@/features/ignored-users-mobile-sync'
import { IgnoredUsersImportPanel } from './ignored-users-import-panel'

const payload: IgnoredUsersSyncPayload = {
	type: 'mvp-ignored-users',
	version: 1,
	users: [
		{ nick: 'HiddenUser', ignoreType: 'hide' },
		{ nick: 'MutedUser', ignoreType: 'mute' },
	],
}

describe('IgnoredUsersImportPanel', () => {
	it('shows confirmation counts before importing', () => {
		render(<IgnoredUsersImportPanel payload={payload} onCancel={vi.fn()} onImport={vi.fn()} />)

		expect(screen.getByText('Importar ignorados')).toBeInTheDocument()
		expect(screen.getByText('2')).toBeInTheDocument()
		expect(screen.getByText('Ocultos')).toBeInTheDocument()
		expect(screen.getByText('Silenciados')).toBeInTheDocument()
		expect(screen.getByText('Se fusionarán con los usuarios existentes. No se borrará ningún filtro actual.')).toBeInTheDocument()
	})

	it('imports only after the user confirms', async () => {
		const onImport = vi.fn(() => Promise.resolve())
		render(<IgnoredUsersImportPanel payload={payload} onCancel={vi.fn()} onImport={onImport} />)

		expect(onImport).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole('button', { name: 'Importar' }))

		await waitFor(() => expect(onImport).toHaveBeenCalledOnce())
		expect(await screen.findByText('Importación completada')).toBeInTheDocument()
		expect(screen.getByText('Se han importado 2 usuarios. Ya puedes cerrar este panel.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Importar' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
	})

	it('does not import when the user cancels', () => {
		const onCancel = vi.fn()
		const onImport = vi.fn(() => Promise.resolve())
		render(<IgnoredUsersImportPanel payload={payload} onCancel={onCancel} onImport={onImport} />)

		fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

		expect(onCancel).toHaveBeenCalledOnce()
		expect(onImport).not.toHaveBeenCalled()
	})
})
