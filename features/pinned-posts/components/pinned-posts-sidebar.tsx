import { useState, useEffect } from 'react'
import Pin from 'lucide-react/dist/esm/icons/pin'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import X from 'lucide-react/dist/esm/icons/x'
import {
	getPinnedPosts,
	unpinPost,
	clearPinnedPosts,
	PinnedPost,
	getThreadId,
} from '@/features/pinned-posts/logic/storage'
import { subscribeToPinChanges } from '@/features/pinned-posts/logic/pin-posts'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { DOM_MARKERS } from '@/constants'
import { cn } from '@/lib/utils'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function PinnedPostsSidebar() {
	const [posts, setPosts] = useState<PinnedPost[]>([])
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [showClearDialog, setShowClearDialog] = useState(false)

	useEffect(() => {
		const loadPosts = async () => {
			const current = await getPinnedPosts()
			setPosts(current)
		}

		void loadPosts()

		const unsubscribe = subscribeToPinChanges(() => void loadPosts())
		return unsubscribe
	}, [])

	const handleUnpin = async (postNum: number, e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		await unpinPost(postNum)
		const current = await getPinnedPosts()
		setPosts(current)
		window.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.PIN_CHANGED))
	}

	const navigateToPost = (post: PinnedPost) => {
		const postElement = document.querySelector(`.post[data-num="${post.num}"]`)

		if (postElement) {
			postElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
			postElement.classList.add('mv-highlight-post')
			setTimeout(() => postElement.classList.remove('mv-highlight-post'), 2000)
		} else {
			const threadId = getThreadId()
			const pageUrl = post.pageNum > 1 ? `${threadId}/${post.pageNum}` : threadId
			window.location.href = `${pageUrl}#${post.num}`
		}
	}

	const handleClearAll = async () => {
		await clearPinnedPosts()
		setPosts([])
		window.dispatchEvent(new CustomEvent(DOM_MARKERS.EVENTS.PIN_CHANGED))
		setShowClearDialog(false)
	}

	if (posts.length === 0) return null

	return (
		<ShadowWrapper className="mt-3">
			<div
				className={cn(
					'b-side backdrop-blur-md rounded-xl border overflow-hidden shadow-lg transition-all duration-500 ease-in-out group/sidebar',
					'bg-[color-mix(in_srgb,var(--card)90%,transparent)]',
					'border-[color-mix(in_srgb,var(--border)40%,transparent)]',
					isCollapsed ? 'max-h-14 shadow-sm' : 'max-h-[600px]'
				)}
			>
				{/* Header */}
				<div
					onClick={() => setIsCollapsed(!isCollapsed)}
					className={cn(
						'cursor-pointer flex items-center gap-3 p-3 px-4 transition-all relative overflow-hidden',
						'bg-[color-mix(in_srgb,var(--muted)30%,transparent)] hover:bg-[color-mix(in_srgb,var(--muted)50%,transparent)]',
						'border-b border-[color-mix(in_srgb,var(--border)30%,transparent)]',
						isCollapsed && 'border-b-0'
					)}
				>
					{/* Highlight effect on hover */}
					<div
						className={cn(
							'absolute inset-0 bg-gradient-to-r to-transparent opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-500',
							'from-[color-mix(in_srgb,var(--primary)5%,transparent)]'
						)}
					/>

					<div className="relative z-10">
						<div
							className={cn(
								'w-8 h-8 rounded-lg flex items-center justify-center text-primary transition-transform duration-300',
								'bg-[color-mix(in_srgb,var(--primary)10%,transparent)]'
							)}
						>
							<Pin size={15} className="rotate-45" />
						</div>
						<span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center ring-2 ring-card shadow-sm animate-in zoom-in duration-300">
							{posts.length}
						</span>
					</div>

					<div className="flex flex-col flex-1 relative z-10">
						<span className="text-[13px] font-bold text-foreground tracking-tight group-hover/sidebar:text-primary transition-colors duration-300">
							Anclados
						</span>
						<span className="text-[10px] text-muted-foreground font-medium">Marcadores rápidos</span>
					</div>

					<div className="flex items-center gap-2 relative z-10">
						{!isCollapsed && (
							<button
								onClick={e => {
									e.stopPropagation()
									setShowClearDialog(true)
								}}
								className={cn(
									'p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive transition-colors',
									'hover:bg-[color-mix(in_srgb,var(--destructive)10%,transparent)]'
								)}
								title="Limpiar todos"
							>
								<Trash2 size={13} />
							</button>
						)}
						<div
							className={cn('transition-transform duration-500 text-muted-foreground/60', !isCollapsed && 'rotate-180')}
						>
							<ChevronDown size={14} />
						</div>
					</div>
				</div>

				{/* Posts list */}
				<div
					className={cn(
						'transition-all duration-500 ease-in-out',
						isCollapsed ? 'opacity-0 pointer-events-none translate-y-[-10px]' : 'opacity-100 translate-y-0'
					)}
				>
					{/* Posts container with custom scroll */}
					<div className="max-h-[350px] overflow-y-auto p-2 space-y-2 custom-scroll">
						{posts.map((post, idx) => (
							<div
								key={post.num}
								onClick={() => navigateToPost(post)}
								className={cn(
									'group/item flex flex-col gap-2 p-2.5 rounded-lg border border-transparent cursor-pointer relative transition-all duration-300 hover:shadow-sm',
									'bg-[color-mix(in_srgb,var(--muted)30%,transparent)] hover:bg-[color-mix(in_srgb,var(--muted)60%,transparent)]',
									'hover:border-[color-mix(in_srgb,var(--primary)10%,transparent)]'
								)}
								style={{ animationDelay: `${idx * 50}ms` }}
							>
								{/* Avatar and Info */}
								<div className="flex items-center gap-2.5">
									<div className="relative shrink-0">
										{post.avatarUrl ? (
											<img
												src={post.avatarUrl}
												alt={post.author}
												className={cn(
													'w-7 h-7 rounded-md object-cover shadow-sm transition-transform duration-300 group-hover/item:scale-105',
													'border border-[color-mix(in_srgb,var(--border)40%,transparent)]'
												)}
											/>
										) : (
											<div
												className={cn(
													'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-primary-foreground uppercase shadow-sm',
													'bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)80%,transparent)] to-primary'
												)}
											>
												{post.author.charAt(0)}
											</div>
										)}
									</div>
									<div className="flex flex-col min-w-0">
										<span className="text-[12px] font-bold text-foreground leading-none truncate group-hover/item:text-primary transition-colors">
											{post.author}
										</span>
										<div className="flex items-center gap-1.5 mt-1">
											<span className="text-[9px] text-muted-foreground font-medium">Pág. {post.pageNum}</span>
											<span className="mx-0.5 text-[8px] text-border">•</span>
											<span
												className={cn(
													'text-[9px] text-primary/70 font-bold px-1 rounded-sm',
													'bg-[color-mix(in_srgb,var(--primary)5%,transparent)]'
												)}
											>
												#{post.num}
											</span>
										</div>
									</div>
									<button
										onClick={e => handleUnpin(post.num, e)}
										className={cn(
											'ml-auto p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive transition-all opacity-0 -translate-x-2 group-hover/item:opacity-100 group-hover/item:translate-x-0',
											'hover:bg-[color-mix(in_srgb,var(--destructive)10%,transparent)]'
										)}
										title="Desanclar"
									>
										<X size={12} />
									</button>
								</div>

								{/* Preview */}
								<div
									className={cn(
										'relative pl-2.5 border-l-2 transition-colors',
										'border-[color-mix(in_srgb,var(--primary)20%,transparent)] group-hover/item:border-[color-mix(in_srgb,var(--primary)40%,transparent)]'
									)}
								>
									<p
										className={cn(
											'text-[11px] m-0 leading-relaxed line-clamp-2 italic font-medium',
											'text-[color-mix(in_srgb,var(--muted-foreground)_60%,transparent)]'
										)}
									>
										"{post.preview}"
									</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* Clear All Confirmation Dialog */}
			<AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
				<AlertDialogContent className="bg-card text-card-foreground border-border shadow-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle>¿Limpiar anclados?</AlertDialogTitle>
						<AlertDialogDescription className="text-muted-foreground opacity-90">
							Esta acción eliminará todos los posts anclados en este hilo. No se puede deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="bg-accent hover:bg-accent/80 text-accent-foreground border-none">
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleClearAll}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ShadowWrapper>
	)
}
