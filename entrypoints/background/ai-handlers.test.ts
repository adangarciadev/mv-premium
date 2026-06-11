import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockOnMessage = vi.hoisted(() => vi.fn())
const mockSettingsGetValue = vi.hoisted(() => vi.fn())

vi.mock('@/lib/messaging', () => ({
	onMessage: mockOnMessage,
}))

vi.mock('#imports', () => ({
	storage: {
		defineItem: vi.fn(() => ({
			getValue: mockSettingsGetValue,
		})),
	},
}))

import { setupGeminiHandler } from './ai-handlers'

type GenerateGeminiHandler = (message: {
	data: {
		model: string
		history?: { role: 'user' | 'model'; parts: { text: string }[] }[]
		prompt?: string
	}
}) => Promise<unknown>
type TestGeminiConnectionHandler = () => Promise<unknown>

describe('setupGeminiHandler', () => {
	const handlers = new Map<string, unknown>()

	beforeEach(() => {
		handlers.clear()
		mockOnMessage.mockReset()
		mockOnMessage.mockImplementation((name: string, handler: unknown) => {
			handlers.set(name, handler)
		})
		mockSettingsGetValue.mockReset()
		vi.restoreAllMocks()
	})

	it('reads the stored key and calls Gemini with the key from the background context', async () => {
		mockSettingsGetValue.mockResolvedValue(JSON.stringify({ state: { geminiApiKey: 'test-gemini-key' } }))
		const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			Response.json({
				candidates: [
					{
						content: {
							parts: [{ text: 'Respuesta generada' }],
						},
					},
				],
			})
		)

		setupGeminiHandler()
		const handler = handlers.get('generateGemini') as GenerateGeminiHandler | undefined

		const result = await handler?.({
			data: {
				model: 'gemini-2.5-flash',
				history: [{ role: 'user', parts: [{ text: 'Resume esto' }] }],
			},
		})

		expect(result).toEqual({
			success: true,
			text: 'Respuesta generada',
			modelUsed: 'gemini-2.5-flash',
		})
		expect(fetchMock).toHaveBeenCalledWith(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-gemini-key',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			})
		)
	})

	it('returns a safe error when no Gemini key is configured', async () => {
		mockSettingsGetValue.mockResolvedValue(JSON.stringify({ state: { geminiApiKey: '' } }))
		const fetchMock = vi.spyOn(globalThis, 'fetch')

		setupGeminiHandler()
		const handler = handlers.get('generateGemini') as GenerateGeminiHandler | undefined

		const result = await handler?.({
			data: {
				model: 'gemini-2.5-flash',
				prompt: 'Resume esto',
			},
		})

		expect(result).toEqual({
			success: false,
			error: 'Configura una API key de Gemini antes de usar IA.',
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('returns available Gemini model IDs from a mocked models response', async () => {
		mockSettingsGetValue.mockResolvedValue(JSON.stringify({ state: { geminiApiKey: 'test-gemini-key' } }))
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			Response.json({
				models: [
					{ name: 'models/gemini-2.5-flash' },
					{ name: 'models/gemini-2.5-flash-lite' },
					{ name: 'models/embedding-001' },
				],
			})
		)

		setupGeminiHandler()
		const handler = handlers.get('testGeminiConnection') as TestGeminiConnectionHandler | undefined

		const result = await handler?.()

		expect(result).toEqual({
			success: true,
			message: 'Conexion correcta. 3 modelos disponibles (2 Gemini).',
			availableModelIds: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
		})
	})
})
