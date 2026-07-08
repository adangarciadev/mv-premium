import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { FragranticaCard } from './fragrantica-card'

const mockSendMessage = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	sendMessage: mockSendMessage,
}))

const URL = 'https://www.fragrantica.es/perfume/Dior/Sauvage-31861.html'

describe('FragranticaCard', () => {
	beforeEach(() => {
		mockSendMessage.mockReset()
	})

	it('shows a loading state before the fragrance data resolves', () => {
		mockSendMessage.mockReturnValue(new Promise(() => {}))

		render(<FragranticaCard url={URL} />)

		expect(screen.getByText('Cargando ficha de Fragrantica...')).toBeInTheDocument()
	})

	it('renders the collapsed summary once the fragrance data resolves', async () => {
		mockSendMessage.mockResolvedValue({
			success: true,
			data: {
				url: URL,
				id: '31861',
				title: 'Sauvage Dior',
				brand: 'Dior',
				audience: 'Hombres',
				image: 'https://fimgs.net/mdimg/perfume-thumbs/dark-375x500.31861.avif',
				fallbackImage: '',
				rating: { value: 4.02, count: 18421 },
				accords: [{ label: 'fresco especiado', color: '#9ed7d5', score: 94 }],
				pyramid: { top: ['Bergamota'], middle: ['Lavanda'], base: ['Cedro'] },
				notes: [],
				wear: [],
			},
		})

		render(<FragranticaCard url={URL} />)

		expect(await screen.findByRole('link', { name: 'Sauvage Dior' })).toBeInTheDocument()
		expect(screen.getByText('Dior · Hombres')).toBeInTheDocument()
		expect(screen.getByText('4.02')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Ver ficha' })).toHaveAttribute('aria-expanded', 'false')
	})

	it('expands the details section when the toggle button is clicked', async () => {
		mockSendMessage.mockResolvedValue({
			success: true,
			data: {
				url: URL,
				id: '31861',
				title: 'Sauvage Dior',
				brand: 'Dior',
				audience: 'Hombres',
				image: '',
				fallbackImage: '',
				rating: null,
				accords: [{ label: 'fresco especiado', color: '#9ed7d5', score: 94 }],
				pyramid: { top: ['Bergamota'], middle: [], base: [] },
				notes: [],
				wear: [{ key: 'summer', label: 'Verano', score: 80 }],
			},
		})

		const user = userEvent.setup()
		render(<FragranticaCard url={URL} />)

		const toggle = await screen.findByRole('button', { name: 'Ver ficha' })
		await user.click(toggle)

		expect(screen.getByRole('button', { name: 'Ocultar ficha' })).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByText('Acordes principales')).toBeInTheDocument()
		expect(screen.getByText('Pirámide del perfume')).toBeInTheDocument()
		expect(screen.getByText('Cuándo usarlo')).toBeInTheDocument()
	})

	it('falls back to the flat notes widget when there is no Salida/Corazón/Base pyramid', async () => {
		mockSendMessage.mockResolvedValue({
			success: true,
			data: {
				url: URL,
				id: '136622',
				title: 'Bogoss Blue Temptation Zara',
				brand: 'Zara',
				audience: 'Hombres',
				image: '',
				fallbackImage: '',
				rating: { value: 4, count: 3 },
				accords: [],
				pyramid: { top: [], middle: [], base: [] },
				notes: ['Agua de coco', 'piña', 'bergamota'],
				wear: [],
			},
		})

		const user = userEvent.setup()
		render(<FragranticaCard url={URL} />)

		// "Agua de coco" renders both in the collapsed highlight chip and in the (visually
		// collapsed but always-mounted) expanded flat-notes panel, so there are 2 matches.
		expect(await screen.findAllByText('Agua de coco')).toHaveLength(2)

		await user.click(screen.getByRole('button', { name: 'Ver ficha' }))

		expect(screen.getByText('Notas de fragancia')).toBeInTheDocument()
		expect(screen.queryByText('Pirámide del perfume')).not.toBeInTheDocument()
		expect(screen.getAllByText('Piña')).toHaveLength(2)
	})

	it('shows an error state when the fetch fails', async () => {
		mockSendMessage.mockResolvedValue({
			success: false,
			error: 'Fragrantica no disponible',
		})

		render(<FragranticaCard url={URL} />)

		await waitFor(() => {
			expect(screen.getByText('Fragrantica no disponible')).toBeInTheDocument()
		})
		expect(screen.getByRole('link', { name: 'Ver en Fragrantica' })).toBeInTheDocument()
	})
})
