/**
 * Summary Modal Component
 *
 * Displays the thread summary in a modal overlay.
 */

import { useState, useEffect, useCallback } from 'react'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Bot from 'lucide-react/dist/esm/icons/bot'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { summarizeCurrentThread, type ThreadSummary } from '../logic/summarize'
import { getCurrentPageNumber } from '../logic/extract-posts'
import { getCachedSingleSummary, setCachedSingleSummary } from '../logic/summary-cache'
import { sendMessage } from '@/lib/messaging'
import { getLastModelUsed } from '@/services/ai/gemini-service'
import { useAIModelLabel } from '@/hooks/use-ai-model-label'
import { markdownToBBCode } from '../logic/render-inline-markdown'
import { useSettingsStore } from '@/store/settings-store'
import { toast } from '@/lib/lazy-toast'
import {
	formatDuration,
	useSummaryTimer,
	useSummaryClipboard,
	SummaryModalHeader,
	SummaryErrorState,
	SummaryResultSection,
	SummaryMetadata,
	SummaryModalFooter,
	APIConsoleLinks,
	MetadataIcons,
} from './shared/summary-modal-shared'

interface SummaryModalProps {
	isOpen: boolean
	onClose: () => void
}

export function SummaryModal({ isOpen, onClose }: SummaryModalProps) {
	const [summary, setSummary] = useState<ThreadSummary | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [actualModel, setActualModel] = useState<string | null>(null)
	const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
	const aiProvider = useSettingsStore(s => s.aiProvider)
	const hasProviderKey = useSettingsStore(s =>
		s.aiProvider === 'gemini' ? s.geminiApiKey.trim().length > 0 : s.groqApiKey.trim().length > 0
	)
	const { modelLabel, isModelFallback, configuredModel, isProviderFallback, providerFallbackMessage } =
		useAIModelLabel(actualModel)

	const { elapsedSeconds, setElapsedSeconds } = useSummaryTimer(isLoading, startedAtMs)

	const buildCopyText = useCallback(() => {
		if (!summary) return null
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
	}, [summary])

	const { copied, setCopied, handleCopy } = useSummaryClipboard(buildCopyText)

	const generateSummary = useCallback(async () => {
		const startedAt = Date.now()
		setIsLoading(true)
		setSummary(null)
		setActualModel(null)
		setStartedAtMs(startedAt)
		setElapsedSeconds(0)

		const result = await summarizeCurrentThread()
		const usedModel = getLastModelUsed()
		const timedResult: ThreadSummary = { ...result, generationMs: Date.now() - startedAt, modelUsed: usedModel || undefined }

		if (!timedResult.error) {
			setCachedSingleSummary(timedResult.pageNumber, timedResult)
		}

		setActualModel(usedModel)
		setSummary(timedResult)
		setIsLoading(false)
		setStartedAtMs(null)
	}, [setElapsedSeconds])

	useEffect(() => {
		if (isOpen) {
			setCopied(false)
			setActualModel(null)
			setStartedAtMs(null)
			setElapsedSeconds(0)

			const pageNumber = getCurrentPageNumber()
			const cached = getCachedSingleSummary(pageNumber)

			if (cached) {
				setActualModel(cached.modelUsed || null)
				setSummary(cached)
				setIsLoading(false)
				setStartedAtMs(null)
				setElapsedSeconds(0)
			} else {
				generateSummary()
			}
		}
	}, [isOpen, generateSummary, setCopied, setElapsedSeconds])

	useEffect(() => {
		if (isOpen && !hasProviderKey) {
			toast.error(
				`No hay API Key configurada para ${aiProvider === 'gemini' ? 'Gemini' : 'Groq'}. Cerrando resumen.`
			)
			onClose()
		}
	}, [isOpen, hasProviderKey, aiProvider, onClose])

	const openAISettings = () => {
		sendMessage('openOptionsPage', 'settings?tab=ai')
		onClose()
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) onClose()
	}

	const isAINotConfigured = summary?.error?.includes('IA no configurada')
	const badgeTitle = providerFallbackMessage
		? providerFallbackMessage
		: isModelFallback
			? `Modelo configurado: ${configuredModel}`
			: undefined

	if (!isOpen) return null

	return (
		<ShadowWrapper className="fixed inset-0 z-[9999]">
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
				onClick={handleBackdropClick}
			>
				<div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
					<SummaryModalHeader
						icon={<Bot className="w-5 h-5 text-primary" />}
						title={`Resumen ${summary?.pageNumber && summary.pageNumber > 1 ? `(Pag. ${summary.pageNumber})` : ''}`}
						modelLabel={modelLabel}
						isModelFallback={isModelFallback}
						isProviderFallback={isProviderFallback}
						badgeTitle={badgeTitle}
						onClose={onClose}
					/>

					<div className="flex-1 overflow-y-auto p-4" aria-live="polite" aria-busy={isLoading}>
						{providerFallbackMessage && (
							<div className="mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
								<AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
								<p className="text-xs text-amber-700 dark:text-amber-400">{providerFallbackMessage}</p>
							</div>
						)}
						{isLoading ? (
							<div className="flex flex-col items-center justify-center py-12 gap-4">
								<Loader2 className="w-10 h-10 animate-spin text-primary" />
								<div className="text-center">
									<p className="text-sm font-medium text-foreground">Resumiendo página...</p>
									<p className="text-xs text-muted-foreground mt-1">Esto puede tardar unos segundos</p>
									<p className="text-xs text-muted-foreground/80 mt-1">
										Tiempo transcurrido: {elapsedSeconds}s
									</p>
								</div>
							</div>
						) : summary?.error ? (
							<SummaryErrorState
								error={summary.error}
								isAINotConfigured={!!isAINotConfigured}
								onOpenSettings={openAISettings}
							/>
						) : summary ? (
							<>
								<SummaryResultSection
									topic={summary.topic}
									keyPoints={summary.keyPoints}
									participants={summary.participants}
									status={summary.status}
								/>
								<SummaryMetadata
									items={[
										{ icon: MetadataIcons.page, label: `Pagina ${summary.pageNumber}` },
										{ icon: MetadataIcons.posts, label: `${summary.postsAnalyzed} posts` },
										{ icon: MetadataIcons.authors, label: `${summary.uniqueAuthors} autores` },
										{ icon: MetadataIcons.model, label: summary.modelUsed || modelLabel },
										...(typeof summary.generationMs === 'number'
											? [{ icon: MetadataIcons.time, label: formatDuration(summary.generationMs) }]
											: []),
									]}
								/>
								<APIConsoleLinks />
							</>
						) : null}
					</div>

					{!isLoading && summary && !summary.error && (
						<SummaryModalFooter
							onRegenerate={generateSummary}
							onCopy={handleCopy}
							onClose={onClose}
							copied={copied}
						/>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}
