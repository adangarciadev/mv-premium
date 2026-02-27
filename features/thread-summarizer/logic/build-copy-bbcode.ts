/**
 * BBCode Copy Text Builders
 *
 * Builds BBCode-formatted text for clipboard copy in both
 * summary-modal and multi-page-summary-modal.
 * Single source of truth to avoid duplication across modals.
 */

import { markdownToBBCode } from './render-inline-markdown'
import type { UserAnalysis } from './analyze-user'

interface SummaryLike {
	topic: string
	keyPoints: string[]
	participants: { name: string; contribution: string }[]
	status: string
}

// =============================================================================
// USER ANALYSIS
// =============================================================================

/**
 * Builds BBCode for a user analysis result.
 *
 * @param analysis - The user analysis data
 * @param variant  - 'single' for current-page, 'multi' for multi-page
 */
export function buildUserAnalysisBBCode(analysis: UserAnalysis, variant: 'single' | 'multi'): string {
	const header = variant === 'multi' && analysis.pageRange
		? `[center][b]🔍 Análisis de ${analysis.username} — Págs. ${analysis.pageRange}[/b][/center]`
		: `[center][b]🔍 Análisis de ${analysis.username} en el hilo[/b][/center]`

	const lines: string[] = [
		header,
		...(analysis.tagline ? [`[center][i]"${markdownToBBCode(analysis.tagline)}"[/i][/center]`, ''] : ['']),
		`[b]🎭 PERFIL:[/b] ${markdownToBBCode(analysis.profile)}`,
		'',
		'[bar]TEMAS RECURRENTES[/bar]',
		'[list]',
		...analysis.topics.map(t => `[*] ${markdownToBBCode(t)}`),
		'[/list]',
		'',
		'[bar]INTERACCIONES[/bar]',
		'[list]',
		...analysis.interactions.map(i => `[*] ${markdownToBBCode(i)}`),
		'[/list]',
		'',
		`[b]✍️ ESTILO:[/b] ${markdownToBBCode(analysis.style)}`,
		'',
		...(analysis.highlights.length > 0 ? [
			'[bar]MOMENTOS DESTACADOS[/bar]',
			'[list]',
			...analysis.highlights.map(h => `[*] ${markdownToBBCode(h)}`),
			'[/list]',
			'',
		] : []),
		`[quote][b]💬 VEREDICTO:[/b] [i]"${markdownToBBCode(analysis.verdict)}"[/i][/quote]`,
		'',
	]

	if (variant === 'multi' && analysis.pagesAnalyzed) {
		lines.push(`📊 [b]${analysis.postsAnalyzed}[/b] posts · [b]${analysis.pagesAnalyzed}[/b] páginas analizadas`)
		lines.push('')
	}

	lines.push('[i]Análisis generado con Mediavida Premium[/i]')

	return lines.join('\n')
}

// =============================================================================
// THREAD SUMMARY
// =============================================================================

interface SingleSummaryCopyData extends SummaryLike {
	pageNumber: number
}

/**
 * Builds BBCode for a single-page thread summary.
 */
export function buildSingleSummaryBBCode(summary: SingleSummaryCopyData): string {
	return [
		`[center][b]✨ Resumen del Hilo (Pág. ${summary.pageNumber})[/b][/center]`,
		'',
		`[b]🤖 TEMA:[/b] ${markdownToBBCode(summary.topic)}`,
		'',
		'[bar]PUNTOS CLAVE[/bar]',
		'[list]',
		...summary.keyPoints.map(p => `[*] ${markdownToBBCode(p)}`),
		'[/list]',
		'',
		'[bar]PARTICIPANTES DESTACADOS[/bar]',
		'[list]',
		...summary.participants.map(p => `[*] [b]${p.name}[/b]: ${markdownToBBCode(p.contribution)}`),
		'[/list]',
		'',
		`[quote][b]📝 ESTADO DEL DEBATE:[/b] [i]"${markdownToBBCode(summary.status)}"[/i][/quote]`,
		'',
		'[i]Generado con Resumidor IA de Mediavida Premium[/i]',
	].join('\n')
}

interface MultiSummaryCopyData extends SummaryLike {
	pageRange: string
	totalPostsAnalyzed: number
	pagesAnalyzed: number
	totalUniqueAuthors: number
}

/**
 * Builds BBCode for a multi-page thread summary.
 */
export function buildMultiSummaryBBCode(summary: MultiSummaryCopyData): string {
	return [
		`[center][b]✨ Resumen del Hilo (Págs. ${summary.pageRange})[/b][/center]`,
		'',
		`[b]🤖 TEMA:[/b] ${markdownToBBCode(summary.topic)}`,
		'',
		'[bar]PUNTOS CLAVE[/bar]',
		'[list]',
		...summary.keyPoints.map(p => `[*] ${markdownToBBCode(p)}`),
		'[/list]',
		'',
		'[bar]PARTICIPANTES DESTACADOS[/bar]',
		'[list]',
		...summary.participants.map(p => `[*] [b]${p.name}[/b]: ${markdownToBBCode(p.contribution)}`),
		'[/list]',
		'',
		`[quote][b]📝 ESTADO DEL DEBATE:[/b] [i]"${markdownToBBCode(summary.status)}"[/i][/quote]`,
		'',
		`📊 [b]${summary.totalPostsAnalyzed}[/b] posts · [b]${summary.pagesAnalyzed}[/b] páginas · [b]${summary.totalUniqueAuthors}[/b] autores`,
		'',
		'[i]Generado con Resumidor IA de Mediavida Premium[/i]',
	].join('\n')
}
