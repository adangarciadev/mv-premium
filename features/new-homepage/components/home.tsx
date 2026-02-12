import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3'
import { toast } from 'sonner'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { logger } from '@/lib/logger'
import { getFavorites, getForumLastThreads, getLastNews, getUserLastPosts, getUsername } from '../logic/data'
import { getLatestVisitedForums } from '../lib/visited-forums'
import { getHiddenThreads, hideThreadFromUrl, watchHiddenThreads, type HiddenThread } from '@/features/hidden-threads/logic/storage'
import { buildHiddenNumericIds, isThreadUrlHidden, normalizeThreadPath } from '@/features/hidden-threads/logic/thread-utils'
import { getSavedThreads, toggleSaveThreadFromUrl, watchSavedThreads } from '@/features/saved-threads/logic/storage'
import { getSubforumIconId } from '@/lib/subforums'
import { slugToName } from '@/lib/url-helpers'
import { TOAST_IDS, TOAST_TIMINGS } from '@/constants'
import { useSettingsStore } from '@/store/settings-store'
import type { HomepageThread, HomepageFavorite, HomepageNewsItem } from '../types'
import { Threads } from './threads'
import { News } from './news'

const MAX_NEWS = 5
const MAX_THREADS = 40
const MAX_USER_LAST_POSTS = 6
const MAX_FAVORITES = 6
const THREADS_REFETCH_INTERVAL = 30_000
const NEWS_REFETCH_INTERVAL = 10 * 60_000
const HOMEPAGE_CACHE_KEY = 'mvp-homepage-cache-v1'
const NEW_HOMEPAGE_READY_EVENT = 'mvp:new-homepage-ready'

function getNewsPageFromUrl(): number {
	const match = window.location.pathname.match(/^\/p(\d+)$/)
	return match ? parseInt(match[1], 10) : 1
}

function newsPageToPath(page: number): string {
	return page <= 1 ? '/' : `/p${page}`
}

interface HomepageCache {
	lastThreads: HomepageThread[]
	userLastPosts: HomepageThread[]
	favorites: HomepageFavorite[]
	news: HomepageNewsItem[]
}

interface NewsViewState {
	items: HomepageNewsItem[]
	slideNonce: number
}

function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value)
}

function readHomepageCache(): HomepageCache | null {
	try {
		const raw = localStorage.getItem(HOMEPAGE_CACHE_KEY)
		if (!raw) return null

		const parsed: unknown = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object') return null

		const record = parsed as Record<string, unknown>
		const lastThreads = isArray(record.lastThreads) ? (record.lastThreads as HomepageThread[]) : []
		const userLastPosts = isArray(record.userLastPosts) ? (record.userLastPosts as HomepageThread[]) : []
		const favorites = isArray(record.favorites) ? (record.favorites as HomepageFavorite[]) : []
		const news = isArray(record.news) ? (record.news as HomepageNewsItem[]) : []

		return { lastThreads, userLastPosts, favorites, news }
	} catch {
		return null
	}
}

function writeHomepageCache(patch: Partial<HomepageCache>): void {
	try {
		const current = readHomepageCache() ?? {
			lastThreads: [],
			userLastPosts: [],
			favorites: [],
			news: [],
		}
		const next: HomepageCache = { ...current, ...patch }
		localStorage.setItem(HOMEPAGE_CACHE_KEY, JSON.stringify(next))
	} catch {
		// localStorage may be unavailable or full
	}
}

export function Home() {
	const cached = readHomepageCache()

	const [username] = useState<string | undefined>(() => getUsername())
	const [hiddenThreads, setHiddenThreads] = useState<HiddenThread[]>([])
	const [lastVisitedForums, setLastVisitedForums] = useState<string[]>([])
	const [savedThreadIds, setSavedThreadIds] = useState<Set<string>>(new Set())

	const [lastThreads, setLastThreads] = useState<HomepageThread[]>(() => cached?.lastThreads ?? [])
	const [userLastPosts, setUserLastPosts] = useState<HomepageThread[]>(() => cached?.userLastPosts ?? [])
	const [favorites, setFavorites] = useState<HomepageFavorite[]>(() => cached?.favorites ?? [])
	const [newsView, setNewsView] = useState<NewsViewState>(() => ({
		items: cached?.news ?? [],
		slideNonce: 0,
	}))

	const [threadsLoading, setThreadsLoading] = useState(() => !(cached?.lastThreads.length))
	const [userPostsLoading, setUserPostsLoading] = useState(() => !(cached?.userLastPosts.length))
	const [favoritesLoading, setFavoritesLoading] = useState(() => !(cached?.favorites.length))
	const [newsPage, setNewsPage] = useState(getNewsPageFromUrl)
	const [newsLoading, setNewsLoading] = useState(() => !(cached?.news.length))
	const [newsSlideDirection, setNewsSlideDirection] = useState<'next' | 'prev'>('next')
	const [newsAppliedSlideDirection, setNewsAppliedSlideDirection] = useState<'next' | 'prev'>('next')
	const lastLoadedNewsPageRef = useRef(newsPage)
	const lastThreadActionToastRef = useRef<{ key: string; at: number } | null>(null)
	const hideThreadEnabled = useSettingsStore(state => state.hideThreadEnabled)
	const saveThreadEnabled = useSettingsStore(state => state.saveThreadEnabled)

	const hiddenIds = useMemo(() => new Set(hiddenThreads.map(t => t.id)), [hiddenThreads])
	const hiddenNumericIds = useMemo(() => buildHiddenNumericIds(hiddenIds), [hiddenIds])

	const filteredNews = useMemo(() => {
		return newsView.items.filter(item => !isThreadUrlHidden(item.url, hiddenIds, hiddenNumericIds))
	}, [newsView.items, hiddenIds, hiddenNumericIds])

	const filteredLastThreads = useMemo(() => {
		return lastThreads.filter(thread => !isThreadUrlHidden(thread.url, hiddenIds, hiddenNumericIds))
	}, [lastThreads, hiddenIds, hiddenNumericIds])

	const filteredUserLastPosts = useMemo(() => {
		return userLastPosts.filter(
			thread =>
				(thread.responsesSinceLastVisit ?? 0) > 0 && !isThreadUrlHidden(thread.url, hiddenIds, hiddenNumericIds)
		)
	}, [userLastPosts, hiddenIds, hiddenNumericIds])

	const filteredFavorites = useMemo(() => {
		return favorites.filter(thread => !isThreadUrlHidden(thread.url, hiddenIds, hiddenNumericIds))
	}, [favorites, hiddenIds, hiddenNumericIds])
	const isThreadSavedInList = (url: string): boolean => {
		const threadId = normalizeThreadPath(url)
		return threadId ? savedThreadIds.has(threadId) : false
	}
	const recentForums = useMemo(() => {
		return lastVisitedForums
			.map(forumSlug => ({
				forumSlug,
				forumName: slugToName(forumSlug),
				iconId: getSubforumIconId(forumSlug),
			}))
			.filter(
				(
					item
				): item is {
					forumSlug: string
					forumName: string
					iconId: number
				} => item.iconId !== null && item.iconId !== undefined
			)
			.slice(0, 8)
	}, [lastVisitedForums])

	useLayoutEffect(() => {
		document.dispatchEvent(new CustomEvent(NEW_HOMEPAGE_READY_EVENT))
	}, [])

	// Load hidden threads
	useEffect(() => {
		let mounted = true
		getHiddenThreads().then(threads => {
			if (mounted) setHiddenThreads(threads)
		})
		return watchHiddenThreads(setHiddenThreads)
	}, [])

	// Load saved threads
	useEffect(() => {
		let mounted = true
		getSavedThreads().then(threads => {
			if (!mounted) return
			setSavedThreadIds(new Set(threads.map(thread => thread.id)))
		})

		const unwatch = watchSavedThreads(threads => {
			setSavedThreadIds(new Set(threads.map(thread => thread.id)))
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	// Sync URL bar with news page (pushState on change, popstate on back/forward)
	useEffect(() => {
		const targetPath = newsPageToPath(newsPage)
		if (window.location.pathname !== targetPath) {
			history.pushState(null, '', targetPath)
		}
	}, [newsPage])

	useEffect(() => {
		const handlePopState = () => {
			const targetPage = getNewsPageFromUrl()
			setNewsPage(currentPage => {
				if (targetPage !== currentPage) {
					setNewsSlideDirection(targetPage > currentPage ? 'next' : 'prev')
				}
				return targetPage
			})
		}

		window.addEventListener('popstate', handlePopState)
		return () => window.removeEventListener('popstate', handlePopState)
	}, [])

	useEffect(() => {
		let cancelled = false

		const loadVisitedForums = async () => {
			const visitedForums = await getLatestVisitedForums()
			if (!cancelled) {
				setLastVisitedForums(visitedForums)
			}
		}

		const loadThreads = async () => {
			try {
				const value = await getForumLastThreads()
				if (cancelled) return
				setLastThreads(value)
				writeHomepageCache({ lastThreads: value })
			} catch (error) {
				logger.warn('Homepage: could not fetch latest threads', error)
			} finally {
				if (!cancelled) setThreadsLoading(false)
			}
		}

		const loadUserPosts = async () => {
			try {
				const value = await getUserLastPosts(username)
				if (cancelled) return
				setUserLastPosts(value)
				writeHomepageCache({ userLastPosts: value })
			} catch (error) {
				logger.warn('Homepage: could not fetch user posts', error)
			} finally {
				if (!cancelled) setUserPostsLoading(false)
			}
		}

		const loadFavoritesData = async () => {
			try {
				const value = await getFavorites()
				if (cancelled) return
				setFavorites(value)
				writeHomepageCache({ favorites: value })
			} catch (error) {
				logger.warn('Homepage: could not fetch favorites', error)
			} finally {
				if (!cancelled) setFavoritesLoading(false)
			}
		}

		const loadForumBlocks = () => {
			void loadVisitedForums()
			void loadThreads()
			void loadUserPosts()
			void loadFavoritesData()
		}

		loadForumBlocks()
		const intervalId = window.setInterval(() => {
			loadForumBlocks()
		}, THREADS_REFETCH_INTERVAL)

		return () => {
			cancelled = true
			window.clearInterval(intervalId)
		}
	}, [username])

	useEffect(() => {
		let cancelled = false
		const directionForRequest = newsSlideDirection

		// Show loading immediately on every page navigation
		setNewsLoading(true)

		const loadNews = async () => {
			try {
				const latestNews = await getLastNews(newsPage)
				if (!cancelled) {
					const pageChanged = lastLoadedNewsPageRef.current !== newsPage
					if (pageChanged) {
						lastLoadedNewsPageRef.current = newsPage
						setNewsAppliedSlideDirection(directionForRequest)
					}
					setNewsView(previous => ({
						items: latestNews,
						slideNonce: pageChanged ? previous.slideNonce + 1 : previous.slideNonce,
					}))
					// Only persist page 1 in cache
					if (newsPage === 1) writeHomepageCache({ news: latestNews })
				}
			} catch (error) {
				logger.warn('Homepage: could not fetch news', error)
			} finally {
				if (!cancelled) setNewsLoading(false)
			}
		}

		void loadNews()
		const intervalId = window.setInterval(() => {
			void loadNews()
		}, NEWS_REFETCH_INTERVAL)

		return () => {
			cancelled = true
			window.clearInterval(intervalId)
		}
	}, [newsPage, newsSlideDirection])

	const handlePreviousNewsPage = () => {
		setNewsSlideDirection('prev')
		setNewsPage(p => Math.max(1, p - 1))
	}

	const handleNextNewsPage = () => {
		setNewsSlideDirection('next')
		setNewsPage(p => p + 1)
	}

	const showThreadActionToast = (type: 'success' | 'error', message: string) => {
		const now = Date.now()
		const key = `${type}:${message}`
		const last = lastThreadActionToastRef.current

		if (last && last.key === key && now - last.at < TOAST_TIMINGS.DEDUP_MS) {
			return
		}

		lastThreadActionToastRef.current = { key, at: now }

		if (type === 'success') {
			toast.success(message, { id: TOAST_IDS.HOMEPAGE_THREAD_ACTION })
			return
		}

		toast.error(message, { id: TOAST_IDS.HOMEPAGE_THREAD_ACTION })
	}

	const handleHideThread = async (url: string) => {
		try {
			const hidden = await hideThreadFromUrl(url)
			if (hidden) {
				showThreadActionToast('success', 'Hilo ocultado')
			} else {
				showThreadActionToast('error', 'No se pudo ocultar el hilo')
			}
		} catch (error) {
			logger.error('Homepage: failed to hide thread from url', error)
			showThreadActionToast('error', 'Error al ocultar el hilo')
		}
	}

	const handleSaveThread = async (url: string) => {
		try {
			const saved = await toggleSaveThreadFromUrl(url)
			if (saved === null) {
				showThreadActionToast('error', 'No se pudo guardar el hilo')
				return
			}

			showThreadActionToast('success', saved ? 'Hilo guardado' : 'Hilo eliminado de guardados')
		} catch (error) {
			logger.error('Homepage: failed to toggle saved thread from url', error)
			showThreadActionToast('error', 'Error al guardar el hilo')
		}
	}

	const newsSlideClass =
		newsView.slideNonce === 0
			? ''
			: newsAppliedSlideDirection === 'next'
				? 'animate-[mvp-news-slide-in-next_260ms_ease-out]'
				: 'animate-[mvp-news-slide-in-prev_260ms_ease-out]'

	return (
		<div className="mx-auto w-full max-w-[1280px] p-4 text-mv-text-primary">
			<section>
				<div className="flex items-end justify-between">
					<h1 className="text-lg font-semibold">Noticias</h1>
					<div className="flex items-center gap-3">
						{newsPage > 1 && (
							<button
								type="button"
								onClick={handlePreviousNewsPage}
								disabled={newsLoading}
								className="text-sm text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
							>
								&#8592; Anteriores
							</button>
						)}
						<button
							type="button"
							onClick={handleNextNewsPage}
							disabled={newsLoading}
							className="text-sm text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Siguientes &#8594;
						</button>
					</div>
				</div>
				<div key={`news-slide-${newsView.slideNonce}`} className={newsSlideClass}>
					<News.Root className="mt-3">
						<News.NewsItemList
							threads={filteredNews}
							loading={newsLoading}
							maxThreads={MAX_NEWS}
							onHide={hideThreadEnabled ? handleHideThread : undefined}
							onSave={saveThreadEnabled ? handleSaveThread : undefined}
							isSaved={isThreadSavedInList}
						/>
					</News.Root>
				</div>
			</section>

			<section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
				<div className="xl:col-span-2">
					<div className="flex items-end justify-between">
						<h2 className="text-lg font-semibold">Foro</h2>
						{recentForums.length > 0 && (
							<div className="flex items-center gap-2" title="Últimos foros visitados">
								<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
									<Clock3 className="h-3.5 w-3.5" />
									Recientes
								</span>
								<div className="flex items-center gap-1.5">
									{recentForums.map(({ forumSlug, forumName, iconId }) => (
										<a
											key={forumSlug}
											href={`/foro/${forumSlug}`}
											title={`Ir a ${forumName}`}
											className="transition hover:scale-110"
										>
											<NativeFidIcon iconId={iconId} className="rounded-sm" />
										</a>
									))}
								</div>
							</div>
						)}
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList
							threads={filteredLastThreads}
							loading={threadsLoading}
							maxThreads={MAX_THREADS}
							onHide={hideThreadEnabled ? handleHideThread : undefined}
							onSave={saveThreadEnabled ? handleSaveThread : undefined}
							isSaved={isThreadSavedInList}
						/>
					</Threads.Root>
				</div>

				<div>
					<div className="flex items-end justify-between">
						<h3 className="text-base font-semibold">Tus últimos posts</h3>
						{username && (
							<a href={`/id/${username}/posts`} className="text-sm text-primary transition-colors hover:text-primary/80">
								Todos
							</a>
						)}
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList
							threads={filteredUserLastPosts}
							loading={userPostsLoading}
							maxThreads={MAX_USER_LAST_POSTS}
							onHide={hideThreadEnabled ? handleHideThread : undefined}
							onSave={saveThreadEnabled ? handleSaveThread : undefined}
							isSaved={isThreadSavedInList}
						/>
					</Threads.Root>

					<div className="mt-5 flex items-end justify-between">
						<h3 className="text-base font-semibold">Favoritos</h3>
						<a href="/foro/favoritos" className="text-sm text-primary transition-colors hover:text-primary/80">
							Todos
						</a>
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList
							threads={filteredFavorites}
							loading={favoritesLoading}
							maxThreads={MAX_FAVORITES}
							onHide={hideThreadEnabled ? handleHideThread : undefined}
							onSave={saveThreadEnabled ? handleSaveThread : undefined}
							isSaved={isThreadSavedInList}
							compact
						/>
					</Threads.Root>
				</div>
			</section>
		</div>
	)
}
