/**
 * Summary Modal Component
 *
 * Displays the thread summary in a modal overlay.
 */

import { useState, useEffect } from 'react'
import X from 'lucide-react/dist/esm/icons/x'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Users from 'lucide-react/dist/esm/icons/users'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Check from 'lucide-react/dist/esm/icons/check'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Settings from 'lucide-react/dist/esm/icons/settings'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import { summarizeCurrentThread, type ThreadSummary } from '../logic/summarize'
import { cn } from '@/lib/utils'
import { sendMessage } from '@/lib/messaging'

interface SummaryModalProps {
	isOpen: boolean
	onClose: () => void
}

export function SummaryModal({ isOpen, onClose }: SummaryModalProps) {
	const [summary, setSummary] = useState<ThreadSummary | null>(null)
	const [isLoading, setIsLoading] = useState(true)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		if (isOpen) {
			setIsLoading(true)
			setSummary(null)

			summarizeCurrentThread().then(result => {
				setSummary(result)
				setIsLoading(false)
			})
		}
	}, [isOpen])

	const handleCopy = () => {
		if (summary) {
			const text = [
				`📋 Resumen del Hilo (Pág. ${summary.pageNumber})`,
				'',
				`🔹 TEMA: ${summary.topic}`,
				'',
				'🔹 PUNTOS CLAVE:',
				...summary.keyPoints.map(p => `• ${p}`),
				'',
				'🔹 PARTICIPANTES:',
				...summary.participants.map(p => `• ${p.name}: ${p.contribution}`),
				'',
				`🔹 ESTADO: ${summary.status}`,
			].join('\n')

			navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}

	const openAISettings = () => {
		// Open options page with AI tab selected via background script
		sendMessage('openOptionsPage', 'settings?tab=ai')
		onClose()
	}

	// Check if error is about AI not configured
	const isAINotConfigured = summary?.error?.includes('IA no configurada')

	if (!isOpen) return null

	return (
		<ShadowWrapper className="fixed inset-0 z-[9999]">
			{/* Backdrop */}
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
				onClick={handleBackdropClick}
			>
				{/* Modal */}
				<div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
						<div className="flex items-center gap-2">
							<Bot className="w-5 h-5 text-primary" />
							<h2 className="text-lg font-semibold text-foreground">
								Resumen {summary?.pageNumber && summary.pageNumber > 1 ? `(Pag. ${summary.pageNumber})` : ''}
							</h2>
						</div>
						<button
							onClick={onClose}
							className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
						>
							<X className="w-5 h-5" />
						</button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto p-4">
						{isLoading ? (
							<div className="flex flex-col items-center justify-center py-12 gap-4">
								<Loader2 className="w-10 h-10 animate-spin text-primary" />
								<div className="text-center">
									<p className="text-sm font-medium text-foreground">Analizando hilo...</p>
									<p className="text-xs text-muted-foreground mt-1">Esto puede tardar unos segundos</p>
								</div>
							</div>
						) : summary?.error ? (
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
										{isAINotConfigured ? 'API de Gemini no configurada' : 'Error'}
									</p>
									<p className="text-xs text-muted-foreground">
										{isAINotConfigured
											? 'Necesitas una API Key de Google Gemini para usar esta funcion.'
											: summary.error}
									</p>
									{isAINotConfigured && (
										<Button size="sm" onClick={openAISettings} className="mt-3 gap-2">
											<Settings className="w-4 h-4" />
											Configurar API
										</Button>
									)}
								</div>
							</div>
						) : summary ? (
							<div className="space-y-6">
								{/* Topic */}
								<div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
									<h3 className="text-xs font-bold text-primary mb-1 uppercase tracking-wider flex items-center gap-1.5">
										<Bot className="w-3.5 h-3.5" /> Tema Principal
									</h3>
									<p className="text-sm font-medium text-foreground leading-relaxed">{summary.topic}</p>
								</div>

								{/* Key Points */}
								<div className="space-y-3">
									<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
										<Check className="w-3.5 h-3.5" /> Puntos Clave
									</h3>
									<ul className="grid gap-2">
										{summary.keyPoints?.map((point, i) => (
											<li key={i} className="text-sm text-foreground/90 bg-muted/30 rounded-md p-2.5 flex gap-3 items-start border border-border/50">
												<span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
												<span className="leading-relaxed">{point}</span>
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
										{summary.participants?.map((p, i) => (
											<div key={i} className="flex gap-3 text-sm border border-border/40 rounded-md p-2 hover:bg-muted/20 transition-colors">
												<div className="flex-shrink-0 w-8 h-8 rounded-md bg-secondary flex items-center justify-center font-bold text-xs text-secondary-foreground uppercase overflow-hidden">
													{p.avatarUrl ? (
														<img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
													) : (
														p.name.substring(0, 2)
													)}
												</div>
												<div className="space-y-0.5">
													<div className="font-semibold text-foreground">{p.name}</div>
													<div className="text-muted-foreground text-xs leading-relaxed">{p.contribution}</div>
												</div>
											</div>
										))}
									</div>
								</div>

                {/* Status */}
								<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
									<h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Estado del Debate</h3>
									<p className="text-sm text-foreground/80 italic">"{summary.status}"</p>
								</div>

								{/* Metadata Clean Stats - No border top here, keep flow */}
								<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70 pt-2">
									<div className="flex items-center gap-1.5">
										<FileText className="w-3.5 h-3.5" />
										<span>Pagina {summary.pageNumber}</span>
									</div>
									<div className="flex items-center gap-1.5">
										<MessageSquare className="w-3.5 h-3.5" />
										<span>{summary.postsAnalyzed} posts</span>
									</div>
									<div className="flex items-center gap-1.5">
										<Users className="w-3.5 h-3.5" />
										<span>{summary.uniqueAuthors} autores</span>
									</div>
								</div>
							</div>
						) : null}
					</div>

					{/* Footer */}
					{!isLoading && summary && !summary.error && (
						<div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/10">
							<Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
								{copied ? (
									<>
										<Check className="w-4 h-4" />
										Copiado
									</>
								) : (
									<>
										<Copy className="w-4 h-4" />
										Copiar
									</>
								)}
							</Button>
							<Button size="sm" onClick={onClose}>
								Cerrar
							</Button>
						</div>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}
