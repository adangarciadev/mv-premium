import { describe, expect, it } from 'vitest'
import type { ThreadSummary } from '@/features/thread-summarizer/logic/summarize'
import { summaryNeedsAiConfig, toThreadSummaryBBCode, toThreadSummaryViewModel } from './thread-summary-view-model'

const BASE_SUMMARY: ThreadSummary = {
	topic: 'Debate sobre las mejoras en el foro',
	keyPoints: ['Punto 1', 'Punto 2', 'Punto 3'],
	participants: [
		{ name: 'UserA', contribution: 'Defiende los cambios', avatarUrl: 'https://example.com/a.jpg' },
		{ name: 'UserB', contribution: 'Cuestiona la utilidad', avatarUrl: undefined },
	],
	status: 'Debate abierto sin consenso',
	title: 'Mejoras propuestas para el sistema',
	postsAnalyzed: 42,
	uniqueAuthors: 8,
	pageNumber: 2,
	generationMs: 1500,
	modelUsed: 'gemini-3-flash-preview',
}

describe('toThreadSummaryViewModel', () => {
	it('maps a normal summary correctly', () => {
		const vm = toThreadSummaryViewModel(BASE_SUMMARY)

		expect(vm.hasError).toBe(false)
		expect(vm.errorMessage).toBe('')
		expect(vm.title).toBe('Mejoras propuestas para el sistema')
		expect(vm.topic).toBe('Debate sobre las mejoras en el foro')
		expect(vm.keyPoints).toEqual(['Punto 1', 'Punto 2', 'Punto 3'])
		expect(vm.participants).toHaveLength(2)
		expect(vm.participants[0]).toEqual({
			name: 'UserA',
			contribution: 'Defiende los cambios',
			avatarUrl: 'https://example.com/a.jpg',
		})
		expect(vm.participants[1]).toEqual({
			name: 'UserB',
			contribution: 'Cuestiona la utilidad',
			avatarUrl: undefined,
		})
		expect(vm.status).toBe('Debate abierto sin consenso')
		expect(vm.postsAnalyzed).toBe(42)
		expect(vm.pageNumber).toBe(2)
	})

	it('maps a summary with the error field set', () => {
		const errorSummary: ThreadSummary = {
			...BASE_SUMMARY,
			topic: '',
			keyPoints: [],
			participants: [],
			status: '',
			error: 'Límite de velocidad excedido. Espera un momento e inténtalo de nuevo.',
		}

		const vm = toThreadSummaryViewModel(errorSummary)

		expect(vm.hasError).toBe(true)
		expect(vm.errorMessage).toBe('Límite de velocidad excedido. Espera un momento e inténtalo de nuevo.')
		expect(vm.topic).toBe('')
		expect(vm.keyPoints).toEqual([])
		expect(vm.participants).toEqual([])
		expect(vm.status).toBe('')
	})

	it('maps a summary with empty keyPoints and participants', () => {
		const emptySummary: ThreadSummary = {
			...BASE_SUMMARY,
			keyPoints: [],
			participants: [],
		}

		const vm = toThreadSummaryViewModel(emptySummary)

		expect(vm.hasError).toBe(false)
		expect(vm.keyPoints).toEqual([])
		expect(vm.participants).toEqual([])
		expect(vm.topic).toBe('Debate sobre las mejoras en el foro')
	})

	it('preserves title even in an error summary', () => {
		const errorSummary: ThreadSummary = {
			...BASE_SUMMARY,
			topic: '',
			keyPoints: [],
			participants: [],
			status: '',
			error: 'IA no configurada. Ve a Ajustes > Inteligencia Artificial.',
		}

		const vm = toThreadSummaryViewModel(errorSummary)

		expect(vm.title).toBe('Mejoras propuestas para el sistema')
		expect(vm.hasError).toBe(true)
	})
})

describe('toThreadSummaryBBCode', () => {
	it('produces Mediavida-ready BBCode from a summary view model', () => {
		const vm = toThreadSummaryViewModel(BASE_SUMMARY)
		const bbcode = toThreadSummaryBBCode(vm)

		expect(bbcode).toContain('[center][b]✨ Resumen del Hilo (Pág. 2)[/b][/center]')
		expect(bbcode).toContain('[bar]PUNTOS CLAVE[/bar]')
		expect(bbcode).toContain('[*] Punto 1')
		expect(bbcode).toContain('[bar]PARTICIPANTES DESTACADOS[/bar]')
		expect(bbcode).toContain('[*] [b]UserA[/b]: Defiende los cambios')
		expect(bbcode).toContain('[quote][b]📝 ESTADO DEL DEBATE:[/b]')
	})
})

describe('summaryNeedsAiConfig', () => {
	it('is true for the missing-key error', () => {
		const vm = toThreadSummaryViewModel({
			...BASE_SUMMARY,
			error: 'IA no configurada. Ve a Ajustes > Inteligencia Artificial.',
		})
		expect(summaryNeedsAiConfig(vm)).toBe(true)
	})

	it('is false for a transient (rate-limit) error', () => {
		const vm = toThreadSummaryViewModel({
			...BASE_SUMMARY,
			error: 'Límite de velocidad excedido. Espera un momento e inténtalo de nuevo.',
		})
		expect(summaryNeedsAiConfig(vm)).toBe(false)
	})

	it('is false for a successful summary', () => {
		expect(summaryNeedsAiConfig(toThreadSummaryViewModel(BASE_SUMMARY))).toBe(false)
	})
})
