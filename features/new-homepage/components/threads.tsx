import { clsx } from 'clsx'
import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import Bookmark from 'lucide-react/dist/esm/icons/bookmark'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import type { HomepageItemBase, HomepageThread } from '../types'
import { formatRelativeTime, useRelativeTimeTick } from '../hooks/use-relative-time'

function abbrevNumberToInt(value: string): number {
	const match = value.match(/^(\d+(\.\d+)?)([kK])?$/)
	if (!match) return 0

	const numPart = parseFloat(match[1])
	if (match[3]?.toLowerCase() === 'k') {
		return Math.round(numPart * 1000)
	}

	return Math.round(numPart)
}

function ThreadsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return (
		<div
			className={clsx('grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-table-border bg-[var(--table-border)] shadow-sm', className)}
		>
			{children}
		</div>
	)
}

function ThreadItem({
	url,
	urlSinceLastVisit,
	title,
	lastActivityAt,
	lastActivityTimestamp,
	responsesSinceLastVisit,
	totalResponses,
	hasLive,
	forumSlug,
	onHide,
	onSave,
	isSaved,
	compact,
	showUnreadFallback,
}: HomepageThread & {
	onHide?: (url: string) => void
	onSave?: (url: string) => void
	isSaved?: (url: string) => boolean
	compact?: boolean
	showUnreadFallback?: boolean
}) {
	const totalResponsesAsInt = totalResponses ? abbrevNumberToInt(totalResponses) : 0
	const forumIconId = getSubforumIconId(forumSlug)
	const threadIsSaved = isSaved?.(url) ?? false
	const unreadUrl = responsesSinceLastVisit && urlSinceLastVisit ? urlSinceLastVisit : null
	const unreadCount = responsesSinceLastVisit && urlSinceLastVisit ? responsesSinceLastVisit : null
	const shouldShowStats = !compact && Boolean(hasLive || totalResponses || lastActivityAt)

	return (
		<div className="group/thread flex justify-between bg-table-row text-[var(--table-row-foreground)] transition-colors hover:bg-table-row-hover!">
			<div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
				<a href={`/foro/${forumSlug}`} title={`Ir a ${forumSlug}`} className="shrink-0 transition hover:opacity-80">
					{forumIconId ? (
						<NativeFidIcon iconId={forumIconId} className="rounded-sm" />
					) : (
						<span className="inline-block h-6 w-6 rounded-sm bg-mv-bg-tertiary" />
					)}
				</a>
				<a href={url} className="min-w-0 flex-1 truncate text-sm transition-colors hover:text-primary group-hover/thread:text-primary" title={title}>
					{title}
				</a>

				{/* Thread action buttons (Visible on Hover) */}
				{(onSave || onHide) && (
					<div className="invisible flex shrink-0 items-center gap-1 opacity-0 group-hover/thread:visible group-hover/thread:opacity-100">
						{onSave && (
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onSave(url)
								}}
								className={clsx('flex h-6 w-6 items-center justify-center rounded hover:bg-mv-bg-hover', {
									'text-amber-400 hover:text-amber-300': threadIsSaved,
									'text-muted-foreground hover:text-foreground': !threadIsSaved,
								})}
								title={threadIsSaved ? 'Quitar de guardados' : 'Guardar hilo'}
								aria-label={threadIsSaved ? 'Quitar de guardados' : 'Guardar hilo'}
								aria-pressed={threadIsSaved}
							>
								<Bookmark className={clsx('h-3.5 w-3.5', threadIsSaved && 'fill-current')} />
							</button>
						)}
						{onHide && (
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onHide(url)
								}}
								className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-mv-bg-hover hover:text-foreground"
								title="Ocultar hilo"
								aria-label="Ocultar hilo"
							>
								<EyeOff className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				)}

				{shouldShowStats && (
					<div className="flex shrink-0 items-center gap-2 text-xs">
						{hasLive && <a href={`${url}/live`} title="Abrir live" className="h-2.5 w-2.5 rounded-full bg-red-500" />}
						<span
							title="Total de respuestas"
							className={clsx('w-10 text-right font-medium', {
								'text-muted-foreground': totalResponsesAsInt < 100,
								'text-foreground/80': totalResponsesAsInt >= 100 && totalResponsesAsInt <= 1000,
								'text-orange-400': totalResponsesAsInt > 1000 && totalResponsesAsInt <= 10000,
								'text-purple-400': totalResponsesAsInt > 10000,
							})}
						>
							{totalResponses}
						</span>
						<span title="Tiempo desde la última respuesta" className="w-8 text-right text-muted-foreground">
							{lastActivityTimestamp ? formatRelativeTime(lastActivityTimestamp) : lastActivityAt}
						</span>
					</div>
				)}
			</div>

				{unreadUrl && unreadCount ? (
					<a
						href={unreadUrl}
						title="Respuestas nuevas"
						className={clsx(
							'flex w-10 shrink-0 items-center justify-center text-xs font-semibold text-white transition hover:opacity-90',
							{
								'bg-blue-500': unreadCount < 30,
								'bg-orange-500': unreadCount >= 30 && unreadCount <= 99,
								'bg-red-500': unreadCount > 99,
							}
						)}
					>
						{unreadCount > 99 ? '+99' : unreadCount}
					</a>
				) : showUnreadFallback !== false ? (
					<div
						title="Sin respuestas nuevas"
						className="flex w-10 shrink-0 items-center justify-center bg-[var(--table-row-alt)] text-xs text-muted-foreground"
					>
						/
					</div>
				) : null}
			</div>
		)
}

function ThreadSkeleton() {
	return <div className="h-10 animate-pulse bg-table-row" />
}

function ThreadList({
	threads,
	loading,
	maxThreads,
	onHide,
	onSave,
	isSaved,
	compact,
	showUnreadFallback,
}: {
	threads?: HomepageItemBase[]
	loading: boolean
	maxThreads: number
	onHide?: (url: string) => void
	onSave?: (url: string) => void
	isSaved?: (url: string) => boolean
	compact?: boolean
	showUnreadFallback?: boolean
}) {
	// Track the first load to prevent animation on initial render
	useRelativeTimeTick(5_000)
	const firstLoadRef = useRef(true)
	const previousThreadsRef = useRef<HomepageItemBase[]>([])
	const [newThreadUrls, setNewThreadUrls] = useState<Set<string>>(new Set())

	useEffect(() => {
		if (loading || !threads) return

		if (firstLoadRef.current) {
			firstLoadRef.current = false
			previousThreadsRef.current = threads
			return
		}

		// Calculate distinct threads at the top that are different from the previous top
		const currentTopUrsl = threads.slice(0, 5).map(t => t.url)
		const previousTopUrls = previousThreadsRef.current.slice(0, 5).map(t => t.url)
		
		const newlyAppearedAtTop = new Set<string>()
		
		
		// If the top thread URL is different, it's a candidate for animation
		for (const url of currentTopUrsl) {
			if (!previousTopUrls.includes(url)) {
				newlyAppearedAtTop.add(url)
			}
		}

		if (newlyAppearedAtTop.size > 0) {
			setNewThreadUrls(newlyAppearedAtTop)
			const timer = setTimeout(() => {
				setNewThreadUrls(new Set())
			}, 1000)
			previousThreadsRef.current = threads
			return () => clearTimeout(timer)
		}
		
		previousThreadsRef.current = threads
	}, [threads, loading])
	
	if (loading) {
		const skeletonCount = Math.min(maxThreads, 8)
		return <>{Array.from({ length: skeletonCount }, (_, i) => <ThreadSkeleton key={i} />)}</>
	}

	return (
		<>
			{threads?.slice(0, maxThreads).map(thread => (
				<div
					key={thread.url}
					className={clsx({
						'animate-in fade-in slide-in-from-top-2 duration-500': newThreadUrls.has(thread.url),
					})}
				>
					<ThreadItem
						{...(thread as HomepageThread)}
						onHide={onHide}
						onSave={onSave}
						isSaved={isSaved}
						compact={compact}
						showUnreadFallback={showUnreadFallback}
					/>
				</div>
			))}
		</>
	)
}

export const Threads = {
	Root: ThreadsRoot,
	Thread: ThreadItem,
	ThreadSkeleton,
	ThreadList,
}
