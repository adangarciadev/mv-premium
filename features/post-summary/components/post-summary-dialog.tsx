import { useEffect, useState } from 'react'
import X from 'lucide-react/dist/esm/icons/x'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Check from 'lucide-react/dist/esm/icons/check'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square' // Using generic icon for tone if needed
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { summarizePost, isPostLongEnough, getShortPostMessage, extractPostText } from '../logic/summarize-post'

interface PostSummaryDialogProps {
	postElement: HTMLElement
	onClose: () => void
}

type DialogState = 'loading' | 'success' | 'error' | 'short-post'

export function PostSummaryDialog({ postElement, onClose }: PostSummaryDialogProps) {
	const [state, setState] = useState<DialogState>('loading')
	const [content, setContent] = useState<{ summary: string; tone: string }>({ summary: '', tone: '' })
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		// Prevent body scroll
		document.body.style.overflow = 'hidden'
        
        // Extract post content
		const postBody = postElement.querySelector('.post-contents .body, .post-body, .cuerpo')
		if (!postBody) {
			setState('error')
			setContent({ summary: 'No se pudo encontrar el contenido del post.', tone: 'Error' })
			return
		}

		const text = extractPostText(postBody)

		if (!isPostLongEnough(text)) {
			setState('short-post')
			setContent({ summary: getShortPostMessage(), tone: 'Humor' })
			return
		}

		// Summarize with AI
		summarizePost(text)
			.then(result => {
				setState('success')
				setContent(result)
			})
			.catch(err => {
				setState('error')
				setContent({ summary: err.message || 'Error al generar resumen', tone: 'Error' })
			})

		return () => {
			document.body.style.overflow = ''
		}
	}, [postElement])

    // Close on escape
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [onClose])

	const handleCopy = () => {
		if (content.summary && state === 'success') {
			navigator.clipboard.writeText(content.summary)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	return (
		<ShadowWrapper className="fixed inset-0 z-[99999]">
			<div className="w-full h-full flex items-center justify-center p-4">
				{/* Backdrop */}
				<div 
					className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
					onClick={onClose}
				/>

				{/* Dialog */}
				<div className="relative w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
					
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
						<div className="flex items-center gap-2.5">
							<div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
								<Bot className="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 className="text-lg font-semibold text-foreground leading-none">Resumen de Post</h2>
								<p className="text-xs text-muted-foreground mt-1">Generado por IA</p>
							</div>
						</div>
						<Button variant="ghost" size="icon" onClick={onClose} className="rounded-full w-8 h-8 hover:bg-muted/50">
							<X className="w-4 h-4" />
						</Button>
					</div>

					{/* Content */}
					<div className="p-6 overflow-y-auto">
						{state === 'loading' ? (
							<div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
								<Loader2 className="w-10 h-10 animate-spin text-primary" />
								<div className="space-y-1">
									<p className="text-sm font-medium text-foreground">Analizando contenido...</p>
									<p className="text-xs text-muted-foreground">Esto tomará unos segundos</p>
								</div>
							</div>
						) : state === 'error' ? (
							<div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20 text-center">
								<p className="text-sm font-medium text-destructive mb-1">Ocurrió un error</p>
								<p className="text-xs text-destructive/80">{content.summary}</p>
							</div>
						) : state === 'short-post' ? (
							<div className="text-center py-6 px-4">
								<span className="text-4xl mb-4 block">😅</span>
								<p className="text-lg font-medium text-foreground italic">"{content.summary}"</p>
								<p className="text-xs text-muted-foreground mt-4">Este post es demasiado corto para resumirlo.</p>
							</div>
						) : (
							<div className="space-y-6">
								{/* Summary Text */}
								<div className="bg-muted/10 rounded-lg p-1">
									<p className="text-base text-foreground leading-relaxed p-2">
										{content.summary}
									</p>
								</div>

								{/* Meta Info (Tone) */}
								{content.tone && (
									<div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-full w-fit">
										<MessageSquare className="w-3.5 h-3.5" />
										<span>Tono: <span className="font-medium text-foreground">{content.tone}</span></span>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Footer (Actions) */}
					{state === 'success' && (
						<div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-3">
							<Button variant="outline" onClick={onClose}>Cerrar</Button>
							<Button onClick={handleCopy} disabled={copied} className="gap-2">
								{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
								{copied ? 'Copiado' : 'Copiar Resumen'}
							</Button>
						</div>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}
