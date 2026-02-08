import { clsx } from 'clsx'
import type { PropsWithChildren } from 'react'
import { getIconClassBySlug } from '../lib/forum-icons'
import type { HomepageThread } from '../types'

function NewsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return <div className={clsx(className, 'grid grid-cols-5 gap-2')}>{children}</div>
}

function NewsItem({ url, forumSlug, title, thumbnail, createdAt }: HomepageThread) {
	return (
		<div
			className="flex flex-col justify-end h-44 w-full rounded shadow overflow-hidden relative"
			style={{
				backgroundImage: `url(${thumbnail})`,
				backgroundSize: 'cover',
				backgroundPosition: 'center',
				backgroundRepeat: 'no-repeat',
			}}
		>
			<div className="bg-mv-surface w-full p-2" style={{ minHeight: '48px' }}>
				<div className="flex items-start gap-2">
					<a className="hover:scale-125 duration-200 transition" href={`/foro/${forumSlug}`}>
						<i className={clsx('fid', getIconClassBySlug(forumSlug))} />
					</a>
					<a href={url} title={title} className="text-sm font-medium line-clamp-2 hover:underline" style={{ minHeight: '40px' }}>
						{title}
					</a>
				</div>
				<div className="text-gray-400 dark:text-gray-600 text-right mt-2">{createdAt}</div>
			</div>
		</div>
	)
}

function NewsItemSkeleton() {
	return <div className="flex flex-col justify-end min-h-44 bg-mv-surface animate-pulse rounded" />
}

function NewsItemList({
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
				? [...Array(maxThreads).keys()].map(i => <NewsItemSkeleton key={i} />)
				: threads
						?.filter((_, i) => i < maxThreads)
						.map(thread => <NewsItem key={thread.url} {...thread} />)}
		</>
	)
}

export const News = {
	Root: NewsRoot,
	NewsItem,
	NewsItemSkeleton,
	NewsItemList,
}
