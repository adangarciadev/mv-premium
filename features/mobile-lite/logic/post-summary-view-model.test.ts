import { describe, expect, it } from 'vitest'
import {
	postSummaryNeedsAiConfig,
	toPostSummaryBBCode,
	toPostSummaryViewModel,
} from './post-summary-view-model'

describe('toPostSummaryViewModel', () => {
	it('maps a successful result', () => {
		const vm = toPostSummaryViewModel({ summary: 'Explica cómo montar Docker en WSL2.', tone: 'Didáctico' })
		expect(vm).toEqual({
			summary: 'Explica cómo montar Docker en WSL2.',
			tone: 'Didáctico',
			hasError: false,
			errorMessage: '',
		})
	})

	it('treats a tone="Error" parse failure as an error', () => {
		const vm = toPostSummaryViewModel({ summary: 'Error al procesar la respuesta de la IA.', tone: 'Error' })
		expect(vm.hasError).toBe(true)
		expect(vm.errorMessage).toBe('Error al procesar la respuesta de la IA.')
		expect(vm.summary).toBe('')
	})

	it('maps a thrown-error message', () => {
		const vm = toPostSummaryViewModel(null, 'IA no configurada. Ve a Ajustes > Inteligencia Artificial.')
		expect(vm.hasError).toBe(true)
		expect(vm.errorMessage).toBe('IA no configurada. Ve a Ajustes > Inteligencia Artificial.')
	})
})

describe('toPostSummaryBBCode', () => {
	it('wraps the summary and tone in BBCode', () => {
		const bbcode = toPostSummaryBBCode({
			summary: 'Explica cómo montar Docker en WSL2.',
			tone: 'Didáctico',
			hasError: false,
			errorMessage: '',
		})
		expect(bbcode).toContain('[quote][b]🤖 Resumen IA del post[/b]')
		expect(bbcode).toContain('Explica cómo montar Docker en WSL2.')
		expect(bbcode).toContain('[i]Tono: Didáctico[/i][/quote]')
	})
})

describe('postSummaryNeedsAiConfig', () => {
	it('is true for the missing-key error', () => {
		const vm = toPostSummaryViewModel(null, 'IA no configurada. Ve a Ajustes > Inteligencia Artificial.')
		expect(postSummaryNeedsAiConfig(vm)).toBe(true)
	})

	it('is false for a transient error', () => {
		const vm = toPostSummaryViewModel({ summary: 'Error al procesar la respuesta de la IA.', tone: 'Error' })
		expect(postSummaryNeedsAiConfig(vm)).toBe(false)
	})

	it('is false for a successful summary', () => {
		expect(postSummaryNeedsAiConfig(toPostSummaryViewModel({ summary: 'x', tone: 'Neutro' }))).toBe(false)
	})
})
