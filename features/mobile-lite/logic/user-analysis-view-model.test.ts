import { describe, expect, it } from 'vitest'
import type { UserAnalysis } from '@/features/thread-summarizer/logic/analyze-user'
import {
	toUserAnalysisBBCode,
	toUserAnalysisViewModel,
	userAnalysisNeedsAiConfig,
} from './user-analysis-view-model'

const BASE_ANALYSIS: UserAnalysis = {
	username: 'Morkar',
	tagline: 'El abogado del diablo del subforo',
	profile: 'Participa sobre todo en debates políticos.',
	topics: ['Política', 'Economía'],
	interactions: ['Discute con UserB'],
	style: 'Irónico y directo',
	highlights: ['Su hilo sobre impuestos'],
	verdict: 'Polariza pero aporta datos.',
	title: 'Hilo de actualidad',
	postsAnalyzed: 18,
}

describe('toUserAnalysisViewModel', () => {
	it('maps a single-page analysis', () => {
		const vm = toUserAnalysisViewModel(BASE_ANALYSIS)
		expect(vm.hasError).toBe(false)
		expect(vm.username).toBe('Morkar')
		expect(vm.topics).toEqual(['Política', 'Economía'])
		expect(vm.verdict).toBe('Polariza pero aporta datos.')
		expect(vm.metaLabel).toBe('18 posts analizados')
	})

	it('uses a page-range footer for multi-page analysis', () => {
		const vm = toUserAnalysisViewModel({ ...BASE_ANALYSIS, postsAnalyzed: 64, pagesAnalyzed: 4, pageRange: '1-4' })
		expect(vm.metaLabel).toBe('64 posts · 4 páginas · Págs. 1-4')
	})

	it('maps an error analysis', () => {
		const vm = toUserAnalysisViewModel({ ...BASE_ANALYSIS, error: 'IA no configurada. Ve a Ajustes.' })
		expect(vm.hasError).toBe(true)
		expect(vm.topics).toEqual([])
		expect(userAnalysisNeedsAiConfig(vm)).toBe(true)
	})

	it('needs-config is false for a transient error', () => {
		const vm = toUserAnalysisViewModel({ ...BASE_ANALYSIS, error: 'Límite de velocidad excedido.' })
		expect(userAnalysisNeedsAiConfig(vm)).toBe(false)
	})
})

describe('toUserAnalysisBBCode', () => {
	it('wraps the analysis in BBCode', () => {
		const bbcode = toUserAnalysisBBCode(BASE_ANALYSIS, 'single')
		expect(bbcode).toContain('🔍 Análisis de Morkar')
		expect(bbcode).toContain('[bar]TEMAS RECURRENTES[/bar]')
		expect(bbcode).toContain('[*] Política')
		expect(bbcode).toContain('💬 VEREDICTO:')
	})
})
