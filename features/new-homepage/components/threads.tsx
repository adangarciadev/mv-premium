import { clsx } from 'clsx'
import type { PropsWithChildren } from 'react'
import { getIconClassBySlug } from '../lib/forum-icons'
import type { HomepageThread } from '../types'

function abbrevNumberToInt(str: string): number {
	const match = str.match(/^(\d+(\.\d+)?)([kK])?$/)
	if (!match) return 0

	const numPart = parseFloat(match[1])
	const unit = match[3]

	switch (unit) {
		case 'k':
		case 'K':
			return Math.round(numPart * 1000)
		default:
			return Math.round(numPart)
	}
}

function ThreadsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return <div className={clsx(className, 'grid grid-cols-1 shadow gap-y-0.5 rounded')}>{children}</div>
}

function ThreadItem(props: HomepageThread) {
	const { url, urlSinceLastVisit, title, lastActivityAt, responsesSinceLastVisit, totalResponses, hasLive, forumSlug } =
		props

	const totalResponsesAsInt = totalResponses ? abbrevNumberToInt(totalResponses) : 0

	return (
		<div className="flex justify-between relative bg-mv-surface first:rounded-t last:rounded-b">
			<div className="flex cursor-pointer flex-1 items-center gap-2 p-2 hover:bg-opacity-50 transition duration-150">
				<a
					href={`https://www.mediavida.com/foro/${forumSlug}`}
					title={`Ir a ${forumSlug}`}
					className="hover:scale-125 transition duration-150"
				>
					<i className={clsx('fid', getIconClassBySlug(forumSlug))} />
				</a>
				<a href={url} className="flex-1 line-clamp-2 hover:underline" title={`Ir al inicio de ${title}`}>
					{title}
				</a>
				<div className="flex items-center justify-center gap-2 mr-2">
					{hasLive && (
						<a
							href={`${url}/live`}
							title="Ir al live"
							className="hover:scale-125 transition duration-200 mr-1 bg-red-500 text-white rounded-xs px-0.5 w-3 h-3 rounded-full hover:bg-opacity-75"
						/>
					)}
					<div
						title="Total respuestas"
						className={clsx(
							'w-8 text-right',
							totalResponsesAsInt < 100 && 'text-gray-400 dark:text-gray-600',
							totalResponsesAsInt >= 100 && 'text-gray-600 dark:text-gray-400',
							totalResponsesAsInt > 1000 && 'text-orange-500 dark:text-orange-500',
							totalResponsesAsInt > 10000 && 'text-purple-500 dark:text-purple-500'
						)}
					>
						{totalResponses}
					</div>
					<div title="Tiempo desde el ultimo mensaje" className="w-8 text-right text-gray-500">
						{lastActivityAt}
					</div>
				</div>
			</div>
			{responsesSinceLastVisit && urlSinceLastVisit ? (
				<a
					title="Respuestas desde la ultima visita"
					href={urlSinceLastVisit}
					className={clsx(
						'w-10 cursor-pointer hover:bg-opacity-75 transition duration-200 text-white text-xs font-medium flex items-center justify-center',
						responsesSinceLastVisit < 10 && 'bg-blue-400',
						responsesSinceLastVisit >= 10 && 'bg-blue-500',
						responsesSinceLastVisit > 30 && 'bg-orange-500',
						responsesSinceLastVisit > 99 && 'bg-red-500'
					)}
				>
					{responsesSinceLastVisit > 99 ? '+99' : responsesSinceLastVisit}
				</a>
			) : (
				<div
					title="Sin respuestas desde la ultima visita"
					className="bg-mv-surface-high w-10 text-gray-300 dark:text-gray-600 text-xs font-medium flex items-center justify-center"
				>
					/
				</div>
			)}
		</div>
	)
}

function ThreadSkeleton() {
	return <div className="bg-mv-surface first:rounded-t last:rounded-b min-h-[40px] animate-pulse" />
}

function ThreadList({
	threads,
	loading,
	maxThreads,
}: {
	threads?: HomepageThread[]
	loading: boolean
	maxThreads: number
}) {
	return (
		<>
			{loading
				? [...Array(maxThreads).keys()].map(i => <ThreadSkeleton key={i} />)
				: threads
						?.filter((_, i) => i < maxThreads)
						.map(thread => <ThreadItem key={thread.url} {...thread} />)}
		</>
	)
}

export const Threads = {
	Root: ThreadsRoot,
	Thread: ThreadItem,
	ThreadSkeleton,
	ThreadList,
}
