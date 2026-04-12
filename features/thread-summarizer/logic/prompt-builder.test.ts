import { describe, it, expect } from 'vitest'
import {
	getScaledLimits,
	buildSummaryPrompt,
	buildSingleBatchPromptGemini,
	buildMetaSummaryPromptGemini,
} from './prompt-builder'

describe('prompt-builder', () => {
	describe('getScaledLimits', () => {
		it('should return small limits for few pages', () => {
			expect(getScaledLimits(2)).toEqual({ maxKeyPoints: 5, maxParticipants: 5 })
			expect(getScaledLimits(3)).toEqual({ maxKeyPoints: 5, maxParticipants: 5 })
		})

		it('should scale up for medium page counts', () => {
			expect(getScaledLimits(5)).toEqual({ maxKeyPoints: 7, maxParticipants: 8 })
			expect(getScaledLimits(10)).toEqual({ maxKeyPoints: 9, maxParticipants: 10 })
		})

		it('should return large limits for many pages', () => {
			expect(getScaledLimits(20)).toEqual({ maxKeyPoints: 12, maxParticipants: 14 })
			expect(getScaledLimits(30)).toEqual({ maxKeyPoints: 15, maxParticipants: 16 })
		})
	})

	describe('buildSummaryPrompt', () => {
		it('should produce a Gemini batch prompt with JSON format and full rules', () => {
			const prompt = buildSummaryPrompt({ type: 'batch', pageCount: 5 })
			expect(prompt).toContain('analista de foros')
			expect(prompt).toContain('MULTIPLES PAGINAS')
			expect(prompt).toContain('"topic"')
			expect(prompt).toContain('"keyPoints"')
			expect(prompt).toContain('"participants"')
			expect(prompt).toContain('"status"')
			expect(prompt).toContain('7 puntos clave')
			expect(prompt).toContain('8 participantes')
			expect(prompt).toContain('Responde en espanol')
			expect(prompt).toContain('EXACTAMENTE 8 participantes')
			expect(prompt).toContain('minimo 12 palabras')
			expect(prompt).toContain('REGLAS ESTRICTAS')
			expect(prompt).toContain('ESTADISTICAS DEL HILO')
			expect(prompt).toContain('no inventes cifras')
		})

		it('should produce a Gemini meta prompt', () => {
			const prompt = buildSummaryPrompt({ type: 'meta', pageCount: 10 })
			expect(prompt).toContain('RESUMENES PARCIALES')
			expect(prompt).toContain('UN UNICO RESUMEN GLOBAL')
			expect(prompt).toContain('9 puntos clave')
			expect(prompt).toContain('Responde en espanol')
			expect(prompt).toContain('EXACTAMENTE 10 participantes')
			expect(prompt).toContain('REGLAS ESTRICTAS')
		})

		it('should scale limits based on page count', () => {
			const small = buildSummaryPrompt({ type: 'batch', pageCount: 2 })
			const large = buildSummaryPrompt({ type: 'batch', pageCount: 30 })
			expect(small).toContain('5 puntos clave')
			expect(large).toContain('15 puntos clave')
		})
	})

	describe('convenience wrappers', () => {
		it('should match buildSummaryPrompt output', () => {
			expect(buildSingleBatchPromptGemini(5)).toBe(
				buildSummaryPrompt({ type: 'batch', pageCount: 5 })
			)
			expect(buildMetaSummaryPromptGemini(5)).toBe(
				buildSummaryPrompt({ type: 'meta', pageCount: 5 })
			)
		})
	})
})
