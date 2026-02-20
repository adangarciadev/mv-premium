/**
 * Shared Summary Modal Components
 *
 * Reusable pieces extracted from summary-modal.tsx and multi-page-summary-modal.tsx
 * to eliminate ~80% code duplication between the two modals.
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import X from 'lucide-react/dist/esm/icons/x'
import Copy from 'lucide-react/dist/esm/icons/copy'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Users from 'lucide-react/dist/esm/icons/users'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Check from 'lucide-react/dist/esm/icons/check'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Settings from 'lucide-react/dist/esm/icons/settings'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { renderInlineMarkdown } from '../../logic/render-inline-markdown'
import { toast } from '@/lib/lazy-toast'

// =============================================================================
// UTILITIES
// =============================================================================

export function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	if (minutes > 0) return `${minutes}m ${seconds}s`
	return `${seconds}s`
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Tracks elapsed seconds while a summary is being generated.
 */
export function useSummaryTimer(isActive: boolean, startedAtMs: number | null) {
	const [elapsedSeconds, setElapsedSeconds] = useState(0)

	useEffect(() => {
		if (!isActive || startedAtMs === null) return

		setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
		const intervalId = window.setInterval(() => {
			setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [isActive, startedAtMs])

	return { elapsedSeconds, setElapsedSeconds }
}

/**
 * Manages clipboard copy state with auto-reset.
 */
export function useSummaryClipboard(buildText: () => string | null) {
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(() => {
		const text = buildText()
		if (text) {
			navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
			toast.success('Resumen copiado al portapapeles')
		}
	}, [buildText])

	return { copied, setCopied, handleCopy }
}

// =============================================================================
// SHARED COMPONENTS
// =============================================================================

interface SummaryModalHeaderProps {
	icon: ReactNode
	title: string
	modelLabel: string
	isModelFallback: boolean
	isProviderFallback: boolean
	badgeTitle?: string
	onClose?: () => void
}

export function SummaryModalHeader({
	icon,
	title,
	modelLabel,
	isModelFallback,
	isProviderFallback,
	badgeTitle,
	onClose,
}: SummaryModalHeaderProps) {
	return (
		<div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
			<div className="flex items-center gap-2">
				{icon}
				<h2 className="text-lg font-semibold text-foreground">{title}</h2>
				<span
					className={cn(
						'text-[10px] px-1.5 py-0.5 rounded font-medium',
						isProviderFallback || isModelFallback
							? 'text-amber-600 bg-amber-500/10'
							: 'text-muted-foreground bg-muted'
					)}
					title={badgeTitle}
				>
					{modelLabel}
				</span>
			</div>
			{onClose && (
				<button
					onClick={onClose}
					className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
				>
					<X className="w-5 h-5" />
				</button>
			)}
		</div>
	)
}

interface SummaryErrorStateProps {
	error: string
	isAINotConfigured: boolean
	onOpenSettings: () => void
	/** Optional extra action (e.g. "retry" button for multi-page) */
	extraAction?: ReactNode
}

export function SummaryErrorState({ error, isAINotConfigured, onOpenSettings, extraAction }: SummaryErrorStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 gap-4">
			<div
				className={cn(
					'w-12 h-12 rounded-full flex items-center justify-center',
					isAINotConfigured ? 'bg-primary/10' : 'bg-destructive/10'
				)}
			>
				{isAINotConfigured ? (
					<Settings className="w-6 h-6 text-primary" />
				) : (
					<AlertCircle className="w-6 h-6 text-destructive" />
				)}
			</div>
			<div className="text-center space-y-2">
				<p className={cn('text-sm font-medium', isAINotConfigured ? 'text-foreground' : 'text-destructive')}>
					{isAINotConfigured ? 'IA no configurada' : 'Error'}
				</p>
				<p className="text-xs text-muted-foreground">
					{isAINotConfigured ? 'Necesitas una API Key de Gemini o Groq para usar esta función.' : error}
				</p>
				{isAINotConfigured ? (
					<Button size="sm" onClick={onOpenSettings} className="mt-3 gap-2">
						<Settings className="w-4 h-4" />
						Configurar API
					</Button>
				) : (
					extraAction
				)}
			</div>
		</div>
	)
}

interface SummaryParticipant {
	name: string
	contribution: string
	avatarUrl?: string
}

interface SummaryResultSectionProps {
	topic: string
	keyPoints: string[]
	participants: SummaryParticipant[]
	status: string
	/** Content rendered before the topic (e.g. fetch errors warning) */
	beforeContent?: ReactNode
}

export function SummaryResultSection({ topic, keyPoints, participants, status, beforeContent }: SummaryResultSectionProps) {
	return (
		<div className="space-y-6">
			{beforeContent}

			{/* Topic */}
			<div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
				<h3 className="text-xs font-bold text-primary mb-1 uppercase tracking-wider flex items-center gap-1.5">
					<Bot className="w-3.5 h-3.5" /> Tema Principal
				</h3>
				<p className="text-sm font-medium text-foreground leading-relaxed">{renderInlineMarkdown(topic)}</p>
			</div>

			{/* Key Points */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<Check className="w-3.5 h-3.5" /> Puntos Clave
				</h3>
				<ul className="grid gap-2">
					{keyPoints?.map((point, i) => (
						<li
							key={i}
							className="text-sm text-foreground/90 bg-muted/30 rounded-md p-2.5 flex gap-3 items-start border border-border/50"
						>
							<span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
							<span className="leading-relaxed">{renderInlineMarkdown(point)}</span>
						</li>
					))}
				</ul>
			</div>

			{/* Participants */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<Users className="w-3.5 h-3.5" /> Participantes Destacados
				</h3>
				<div className="grid gap-2">
					{participants?.map((p, i) => (
						<div
							key={i}
							className="flex gap-3 text-sm border border-border/40 rounded-md p-2 hover:bg-muted/20 transition-colors"
						>
							<div className="flex-shrink-0 w-8 h-8 rounded-md bg-secondary flex items-center justify-center font-bold text-xs text-secondary-foreground uppercase overflow-hidden">
								{p.avatarUrl ? (
									<img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
								) : (
									p.name.substring(0, 2)
								)}
							</div>
							<div className="space-y-0.5">
								<div className="font-semibold text-foreground">{p.name}</div>
								<div className="text-muted-foreground text-xs leading-relaxed">
									{renderInlineMarkdown(p.contribution)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Status */}
			<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
				<h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Estado del Debate</h3>
				<p className="text-sm text-foreground/80 italic">{renderInlineMarkdown(status)}</p>
			</div>
		</div>
	)
}

interface MetadataItem {
	icon: ReactNode
	label: string
}

interface SummaryMetadataProps {
	items: MetadataItem[]
}

export function SummaryMetadata({ items }: SummaryMetadataProps) {
	return (
		<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70 pt-2">
			{items.map((item, i) => (
				<div key={i} className="flex items-center gap-1.5">
					{item.icon}
					<span>{item.label}</span>
				</div>
			))}
		</div>
	)
}

export function APIConsoleLinks() {
	return (
		<div className="flex flex-col gap-1 pt-1">
			<a
				href="https://aistudio.google.com/"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
			>
				<ExternalLink className="w-3 h-3" />
				Gemini: Consulta tu uso en AI Studio
			</a>
			<a
				href="https://console.groq.com/"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
			>
				<ExternalLink className="w-3 h-3" />
				Groq: Consulta tu uso en Groq Console
			</a>
		</div>
	)
}

interface SummaryModalFooterProps {
	onRegenerate: () => void
	onCopy: () => void
	onClose: () => void
	copied: boolean
	/** Extra buttons rendered before Regenerar (e.g. "Otro rango") */
	extraButtons?: ReactNode
}

export function SummaryModalFooter({ onRegenerate, onCopy, onClose, copied, extraButtons }: SummaryModalFooterProps) {
	return (
		<div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/10">
			<div className="flex items-center gap-1">
				{extraButtons}
				<Button variant="ghost" size="sm" onClick={onRegenerate} className="gap-1.5 text-muted-foreground">
					<RefreshCw className="w-3.5 h-3.5" />
					Regenerar
				</Button>
			</div>
			<div className="flex items-center gap-2">
				<Button variant="outline" size="sm" onClick={onCopy} className="gap-2">
					{copied ? (
						<>
							<Check className="w-4 h-4" /> Copiado
						</>
					) : (
						<>
							<Copy className="w-4 h-4" /> Copiar
						</>
					)}
				</Button>
				<Button size="sm" onClick={onClose}>
					Cerrar
				</Button>
			</div>
		</div>
	)
}

/**
 * Helper to build metadata items for SummaryMetadata.
 * Common icons used by both modals.
 */
export const MetadataIcons = {
	page: <FileText className="w-3.5 h-3.5" />,
	posts: <MessageSquare className="w-3.5 h-3.5" />,
	authors: <Users className="w-3.5 h-3.5" />,
	model: <Bot className="w-3.5 h-3.5" />,
	time: <Clock3 className="w-3.5 h-3.5" />,
} as const
