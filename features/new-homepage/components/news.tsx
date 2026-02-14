import { clsx } from 'clsx'
import type { CSSProperties, PropsWithChildren } from 'react'
import Bookmark from 'lucide-react/dist/esm/icons/bookmark'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import type { HomepageNewsItem } from '../types'

const TWO_LINE_CLAMP_STYLE: CSSProperties = {
	display: '-webkit-box',
	WebkitLineClamp: 2,
	WebkitBoxOrient: 'vertical',
	overflow: 'hidden',
}

function NewsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return <div className={clsx('grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5', className)}>{children}</div>
}

function NewsItem({
	url,
	forumSlug,
	title,
	thumbnail,
	createdAt,
    author,
    totalResponses,
	onHide,
	onSave,
	isSaved,
}: HomepageNewsItem & { onHide?: (url: string) => void; onSave?: (url: string) => void; isSaved?: (url: string) => boolean }) {
	const forumIconId = getSubforumIconId(forumSlug)
	const threadIsSaved = isSaved?.(url) ?? false

	return (
		<a
			href={url}
			className="group relative flex flex-col w-full h-full overflow-hidden rounded border border-border/60 bg-mv-bg-secondary text-left transition-all hover:border-mv-blue/50"
		>
			{/* Image Section - Top (16:9) */}
			<div
				className="aspect-video w-full bg-cover bg-center transition-transform duration-500 group-hover:opacity-90 relative"
				style={
					thumbnail
						? { backgroundImage: `url(${thumbnail})` }
						: { backgroundColor: 'var(--mv-bg-tertiary)' }
				}
			>
				{/* Post Count Badge (Bottom Left) */}
				{totalResponses && (
					<div className="absolute bottom-1 left-1 z-10 flex items-center justify-center rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
						{totalResponses}
					</div>
				)}

				{/* Thread action buttons (Visible on Hover) */}
				{(onSave || onHide) && (
					<div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
						{onSave && (
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault()
									e.stopPropagation()
									onSave(url)
								}}
								className={clsx(
									'flex h-7 w-7 items-center justify-center rounded bg-black/50 backdrop-blur-sm hover:bg-black/70',
									threadIsSaved ? 'text-amber-300' : 'text-white'
								)}
								title={threadIsSaved ? 'Quitar de guardados' : 'Guardar hilo'}
								aria-label={threadIsSaved ? 'Quitar de guardados' : 'Guardar hilo'}
								aria-pressed={threadIsSaved}
							>
								<Bookmark className={clsx('h-4 w-4', threadIsSaved && 'fill-current')} />
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
								className="flex h-7 w-7 items-center justify-center rounded bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
								title="Ocultar hilo"
								aria-label="Ocultar hilo"
							>
								<EyeOff className="h-4 w-4" />
							</button>
						)}
					</div>
				)}
			</div>

			{/* Content Section - Bottom */}
			<div className="flex flex-1 flex-col justify-between bg-table-row p-3">
				{/* Title & Icon */}
				<div className="flex items-start gap-2">
					<div className="shrink-0 pt-1">
						{forumIconId ? (
							<NativeFidIcon iconId={forumIconId} className="h-4 w-4 rounded-sm" />
						) : (
							<span className="inline-block h-4 w-4 rounded-sm bg-mv-bg-tertiary" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h3
							className="h-8 text-xs font-semibold leading-tight text-white/90 transition-colors group-hover:text-primary"
							style={TWO_LINE_CLAMP_STYLE}
							title={title}
						>
							{title}
						</h3>
					</div>
				</div>

				{/* Date & Author */}
                <div className="mt-2 flex h-4 items-center justify-between text-[10px] text-white/60">
                    <span className="truncate max-w-[60%]">
                        <span className="text-primary">{author}</span>
                    </span>
					<span>{createdAt || <span className="invisible">00 min</span>}</span>
				</div>
			</div>
		</a>
	)
}

function NewsItemSkeleton() {
	return <div className="h-48 animate-pulse rounded border border-border/60 bg-mv-bg-secondary/70" />
}

function NewsItemList({
	threads,
	loading,
	maxThreads,
	onHide,
	onSave,
	isSaved,
}: {
	threads?: HomepageNewsItem[]
	loading: boolean
	maxThreads: number
	onHide?: (url: string) => void
	onSave?: (url: string) => void
	isSaved?: (url: string) => boolean
}) {
	if (loading && (!threads || threads.length === 0)) {
		return <>{Array.from({ length: maxThreads }, (_, i) => <NewsItemSkeleton key={i} />)}</>
	}

	return <>{threads?.slice(0, maxThreads).map(thread => <NewsItem key={thread.url} {...thread} onHide={onHide} onSave={onSave} isSaved={isSaved} />)}</>
}

export const News = {
	Root: NewsRoot,
	NewsItem,
	NewsItemSkeleton,
	NewsItemList,
}
