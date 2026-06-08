import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import Clipboard from 'lucide-react/dist/esm/icons/clipboard'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Image from 'lucide-react/dist/esm/icons/image'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { sendMessage } from '@/lib/messaging'
import { getSubforumIconId } from '@/lib/subforums'
import {
	clearHiddenThreads,
	getHiddenThreads,
	unhideThread,
	watchHiddenThreads,
	type HiddenThread,
} from '@/features/hidden-threads/logic/storage'
import {
	getUserCustomizations,
	saveUserCustomizations,
	watchUserCustomizations,
	type UserCustomization,
	type UserCustomizationsData,
} from '@/features/user-customizations/storage'
import {
	getCustomizationEntryForUser,
	getIgnoreTypeFromCustomization,
	setUserIgnoreInData,
	type MobileLiteIgnoreType,
} from '../logic/ignore-helpers'
import { dispatchMobileLiteIgnoredUsersSync } from '../logic/ignored-users-sync-event'
import { getMobileLiteImgbbApiKey, saveMobileLiteImgbbApiKey } from '../logic/imgbb-api-key-storage'

export const MOBILE_LITE_PANEL_OPEN_EVENT = 'mvp-mobile-lite-panel:open'

const EMPTY_GLOBAL_SETTINGS = {
	adminColor: '',
	subadminColor: '',
	modColor: '',
	userColor: '',
}
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 13
const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/
const USERNAME_VALIDATION_ID = 'mvp-mobile-lite-username-validation'
const DEFAULT_VIEWPORT_BOUNDS = {
	height: 0,
	offsetTop: 0,
}
const TAB_BASE_CLASS =
	'inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border px-1.5 text-sm font-semibold transition-colors'
const TAB_ACTIVE_CLASS = 'border-[#d89016] bg-[#856100] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
const TAB_IDLE_CLASS = 'border-[#4f5965] bg-[#333a45] text-[#eef1f3]'
const FILTER_BASE_CLASS =
	'inline-flex h-10 min-w-0 items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition-colors'
const FILTER_ACTIVE_CLASS = 'border-[#d06d00] bg-[#805604] text-white'
const FILTER_IDLE_CLASS = 'border-[#4c5560] bg-[#333a45] text-[#d8dde2]'
const ACTION_BUTTON_BASE_CLASS =
	'inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-sm font-semibold transition-colors disabled:opacity-60'
const ACTION_IDLE_CLASS = 'border-[#626b74] bg-[#5b646e] text-[#eef1f3]'
const ACTION_MUTE_ACTIVE_CLASS = 'border-[#c69422] bg-[#73570b] text-white'
const ACTION_HIDE_ACTIVE_CLASS = 'border-[#d06d00] bg-[#8a5b00] text-white'
const STATUS_SUCCESS_CLASS = 'rounded-md border border-[#556454] bg-[#2f3d34] px-3 py-2 text-sm text-[#d5ead5]'
const STATUS_ERROR_CLASS = 'rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]'

interface FilteredUser {
	username: string
	customization: UserCustomization
}

type ActiveFilter = 'all' | MobileLiteIgnoreType
type PanelTab = 'users' | 'threads' | 'images'

function getEmptyData(): UserCustomizationsData {
	return {
		users: {},
		globalSettings: EMPTY_GLOBAL_SETTINGS,
	}
}

function getFilteredUsers(data: UserCustomizationsData): FilteredUser[] {
	return Object.entries(data.users)
		.filter(([, customization]) => customization.isIgnored)
		.map(([username, customization]) => ({ username, customization }))
		.sort((a, b) => a.username.localeCompare(b.username, 'es', { sensitivity: 'base' }))
}

function normalizeUsername(username: string): string {
	return username.trim()
}

function getSubforumSlugFromId(subforumId: string): string {
	return subforumId.replace(/^\/foro\//, '').replace(/^foro\//, '').trim()
}

function formatHiddenThreadDate(hiddenAt: number): string {
	if (!Number.isFinite(hiddenAt) || hiddenAt <= 0) return ''

	return new Intl.DateTimeFormat('es-ES', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
	}).format(new Date(hiddenAt))
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

function getVisualViewportBounds() {
	const viewport = window.visualViewport
	return {
		height: viewport?.height ?? window.innerHeight,
		offsetTop: viewport?.offsetTop ?? 0,
	}
}

function useVisualViewportBounds(enabled: boolean) {
	const [bounds, setBounds] = useState(DEFAULT_VIEWPORT_BOUNDS)
	const initialBoundsRef = useRef<typeof DEFAULT_VIEWPORT_BOUNDS | null>(null)

	useEffect(() => {
		if (!enabled) {
			initialBoundsRef.current = null
			setBounds(DEFAULT_VIEWPORT_BOUNDS)
			return
		}

		const initialBounds = getVisualViewportBounds()
		initialBoundsRef.current = initialBounds
		setBounds(initialBounds)

		const updateBounds = () => {
			const nextBounds = getVisualViewportBounds()
			const lockedBounds = initialBoundsRef.current
			setBounds({
				height: lockedBounds ? Math.min(nextBounds.height, lockedBounds.height) : nextBounds.height,
				offsetTop: nextBounds.offsetTop,
			})
		}

		window.addEventListener('resize', updateBounds)
		window.visualViewport?.addEventListener('resize', updateBounds)
		window.visualViewport?.addEventListener('scroll', updateBounds)

		return () => {
			window.removeEventListener('resize', updateBounds)
			window.visualViewport?.removeEventListener('resize', updateBounds)
			window.visualViewport?.removeEventListener('scroll', updateBounds)
			initialBoundsRef.current = null
		}
	}, [enabled])

	return bounds
}

function getUsernameValidationMessage(username: string): string | null {
	if (!username) return null
	if (username.length < USERNAME_MIN_LENGTH) return 'Escribe al menos 3 caracteres para añadir un usuario.'
	if (username.length > USERNAME_MAX_LENGTH) return 'El nick no puede tener más de 13 caracteres.'
	if (!USERNAME_PATTERN.test(username)) return 'Usa solo letras, números, guiones y guiones bajos.'
	return null
}

function findVisibleUserAvatar(username: string): string | undefined {
	const normalizedUsername = username.toLowerCase()
	const userLinks = Array.from(
		document.querySelectorAll<HTMLAnchorElement>('a.user-card[href^="/id/"], a.autor[href^="/id/"], a[href^="/id/"]')
	)

	for (const link of userLinks) {
		const hrefUsername = link.getAttribute('href')?.match(/\/id\/([^/?#]+)/)?.[1] || ''
		const linkUsername = safeDecodeURIComponent(hrefUsername || link.querySelector('img')?.alt?.trim() || link.textContent?.trim() || '')
		if (linkUsername.toLowerCase() !== normalizedUsername) continue

		const avatarUrl = link.querySelector<HTMLImageElement>('img.avatar, img')?.src
		if (avatarUrl) return avatarUrl

		const postContainer = link.closest('.post, .respuesta, .msg, article, li, div[id^="post"], div[id^="respuesta"]')
		const postAvatarUrl = postContainer
			?.querySelector<HTMLImageElement>('img.avatar, .avatar img, .post-avatar img, .user-avatar img, img[src*="/img/users/avatar/"]')
			?.src
		if (postAvatarUrl) return postAvatarUrl
	}

	return undefined
}

async function resolveUserAvatar(username: string): Promise<string | undefined> {
	const visibleAvatar = findVisibleUserAvatar(username)
	if (visibleAvatar) return visibleAvatar

	const result = await sendMessage('resolveMvUserAvatar', { username })
	return result.success ? result.avatarUrl : undefined
}

async function updateUserIgnore(username: string, ignoreType: MobileLiteIgnoreType | null): Promise<UserCustomizationsData> {
	const data = await getUserCustomizations()
	const { storageKey } = setUserIgnoreInData(data, username, ignoreType)
	const avatarUrl = ignoreType ? await resolveUserAvatar(storageKey) : undefined
	if (avatarUrl) {
		data.users[storageKey] = { ...data.users[storageKey], avatarUrl }
	}

	await saveUserCustomizations(data)
	dispatchMobileLiteIgnoredUsersSync({
		data,
		manualChange: {
			storageKey,
			ignoreType,
		},
	})
	return data
}

export function MobileLitePanel() {
	const [open, setOpen] = useState(false)
	const [activeTab, setActiveTab] = useState<PanelTab>('users')
	const [data, setData] = useState<UserCustomizationsData>(getEmptyData)
	const [query, setQuery] = useState('')
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
	const [savingUser, setSavingUser] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [imgbbApiKey, setImgbbApiKey] = useState('')
	const [imgbbApiKeyDraft, setImgbbApiKeyDraft] = useState('')
	const [hiddenThreads, setHiddenThreads] = useState<HiddenThread[]>([])
	const [hiddenThreadQuery, setHiddenThreadQuery] = useState('')
	const [restoringThread, setRestoringThread] = useState<string | null>(null)
	const [clearingHiddenThreads, setClearingHiddenThreads] = useState(false)
	const [confirmClearHiddenThreads, setConfirmClearHiddenThreads] = useState(false)
	const [savingImgbbApiKey, setSavingImgbbApiKey] = useState(false)
	const [refreshingAvatars, setRefreshingAvatars] = useState(false)
	const [hiddenThreadsStatusMessage, setHiddenThreadsStatusMessage] = useState<string | null>(null)
	const [hiddenThreadsErrorMessage, setHiddenThreadsErrorMessage] = useState<string | null>(null)
	const [imgbbStatusMessage, setImgbbStatusMessage] = useState<string | null>(null)
	const [imgbbErrorMessage, setImgbbErrorMessage] = useState<string | null>(null)
	const viewportBounds = useVisualViewportBounds(open)
	const avatarHydrationInFlight = useRef<Set<string>>(new Set())
	const panelBodyRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let mounted = true

		const handleOpen = () => setOpen(true)
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}

		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, handleOpen)
		window.addEventListener('keydown', handleKeyDown)

		getUserCustomizations()
			.then(nextData => {
				if (mounted) setData(nextData)
			})
			.catch(() => {
				if (mounted) setData(getEmptyData())
			})

		const unwatch = watchUserCustomizations(nextData => {
			setData(nextData)
		})
		let unwatchHiddenThreads: (() => void) | null = null
		try {
			unwatchHiddenThreads = watchHiddenThreads(nextThreads => {
				setHiddenThreads(nextThreads)
			})
		} catch {
			// Hidden-thread management should not prevent the panel from opening.
		}

		return () => {
			mounted = false
			unwatch()
			unwatchHiddenThreads?.()
			window.removeEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, handleOpen)
			window.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

	useEffect(() => {
		if (!open) return

		let mounted = true
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'

		getUserCustomizations()
			.then(nextData => {
				if (mounted) setData(nextData)
			})
			.catch(() => {
				if (mounted) setData(getEmptyData())
			})
		getMobileLiteImgbbApiKey()
			.then(apiKey => {
				if (!mounted) return
				setImgbbApiKey(apiKey)
				setImgbbApiKeyDraft(apiKey)
				setImgbbStatusMessage(null)
				setImgbbErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setImgbbErrorMessage('No se pudo cargar la API key de ImgBB.')
			})
		getHiddenThreads()
			.then(nextThreads => {
				if (mounted) setHiddenThreads(nextThreads)
			})
			.catch(() => {
				if (mounted) setHiddenThreadsErrorMessage('No se pudieron cargar los hilos ocultos.')
			})

		return () => {
			mounted = false
			document.body.style.overflow = previousOverflow
		}
	}, [open])

	const allFilteredUsers = useMemo(() => getFilteredUsers(data), [data])
	const mutedUsers = useMemo(
		() => allFilteredUsers.filter(user => getIgnoreTypeFromCustomization(user.customization) === 'mute'),
		[allFilteredUsers]
	)
	const hiddenUsers = useMemo(
		() => allFilteredUsers.filter(user => getIgnoreTypeFromCustomization(user.customization) === 'hide'),
		[allFilteredUsers]
	)
	const usersForActiveFilter = activeFilter === 'mute' ? mutedUsers : activeFilter === 'hide' ? hiddenUsers : allFilteredUsers
	const filteredUsers = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		if (!normalizedQuery) return usersForActiveFilter

		return usersForActiveFilter.filter(user => user.username.toLowerCase().includes(normalizedQuery))
	}, [query, usersForActiveFilter])
	const filterOptions = [
		{ id: 'all', label: 'Todos', count: allFilteredUsers.length },
		{ id: 'mute', label: 'Silenciados', count: mutedUsers.length },
		{ id: 'hide', label: 'Ocultos', count: hiddenUsers.length },
	] satisfies Array<{ id: ActiveFilter; label: string; count: number }>
	const filteredHiddenThreads = useMemo(() => {
		const normalizedQuery = hiddenThreadQuery.trim().toLowerCase()
		if (!normalizedQuery) return hiddenThreads

		return hiddenThreads.filter(thread => {
			return (
				thread.title.toLowerCase().includes(normalizedQuery) ||
				thread.subforum.toLowerCase().includes(normalizedQuery) ||
				getSubforumSlugFromId(thread.subforumId).toLowerCase().includes(normalizedQuery)
			)
		})
	}, [hiddenThreadQuery, hiddenThreads])
	const exactQueryUsername = normalizeUsername(query)
	const exactQueryEntry = exactQueryUsername ? getCustomizationEntryForUser(data, exactQueryUsername) : null
	const exactQueryCustomization = exactQueryEntry?.customization
	const exactQueryDisplayName = exactQueryEntry?.storageKey ?? exactQueryUsername
	const usernameValidationMessage = getUsernameValidationMessage(exactQueryUsername)
	const canAddQueryUser = Boolean(exactQueryUsername && !usernameValidationMessage && !exactQueryCustomization?.isIgnored)
	const hasAnyFilteredUsers = allFilteredUsers.length > 0
	const hasScrollablePanelContent = activeTab === 'users' ? hasAnyFilteredUsers : activeTab === 'threads' ? hiddenThreads.length > 0 : false
	const missingAvatarCount = allFilteredUsers.filter(user => !user.customization.avatarUrl).length
	const isImgbbConfigured = Boolean(imgbbApiKey.trim())
	const isImgbbDirty = imgbbApiKeyDraft.trim() !== imgbbApiKey
	const logoUrl = browser.runtime.getURL('/icon/48.png')

	const hydrateMissingAvatars = useCallback(
		async (users: FilteredUser[], options: { cancelled?: () => boolean; showStatus?: boolean } = {}) => {
			const missingAvatarUsers = users.filter(user => {
				if (user.customization.avatarUrl) return false
				const key = user.username.toLowerCase()
				if (avatarHydrationInFlight.current.has(key)) return false
				avatarHydrationInFlight.current.add(key)
				return true
			})
			if (missingAvatarUsers.length === 0) {
				if (options.showStatus) setStatusMessage('No hay avatares pendientes de actualizar.')
				return
			}

			const resolvedAvatars: Array<{ username: string; avatarUrl: string }> = []

			try {
				for (const user of missingAvatarUsers) {
					if (options.cancelled?.()) break

					try {
						const avatarUrl = await resolveUserAvatar(user.username)
						if (avatarUrl) {
							resolvedAvatars.push({ username: user.username, avatarUrl })
						}
					} catch {
						// Avatar hydration is opportunistic; failing should not block panel usage.
					} finally {
						avatarHydrationInFlight.current.delete(user.username.toLowerCase())
					}
				}

				if (options.cancelled?.() || resolvedAvatars.length === 0) {
					if (options.showStatus && !options.cancelled?.()) setStatusMessage('No se encontraron avatares nuevos.')
					return
				}

				const nextData = await getUserCustomizations()
				let changed = false
				for (const { username, avatarUrl } of resolvedAvatars) {
					const entry = getCustomizationEntryForUser(nextData, username)
					if (!entry?.customization.isIgnored || entry.customization.avatarUrl) continue

					nextData.users[entry.storageKey] = { ...entry.customization, avatarUrl }
					changed = true
				}

				if (!changed || options.cancelled?.()) {
					if (options.showStatus && !options.cancelled?.()) setStatusMessage('No se encontraron avatares nuevos.')
					return
				}

				await saveUserCustomizations(nextData)
				setData(nextData)
				dispatchMobileLiteIgnoredUsersSync({ data: nextData })
				if (options.showStatus) {
					setStatusMessage(
						resolvedAvatars.length === 1
							? 'Avatar actualizado.'
							: `${resolvedAvatars.length} avatares actualizados.`
					)
				}
			} finally {
				for (const user of missingAvatarUsers) {
					avatarHydrationInFlight.current.delete(user.username.toLowerCase())
				}
			}
		},
		[]
	)

	useEffect(() => {
		if (!open || allFilteredUsers.length === 0) return

		let cancelled = false
		void hydrateMissingAvatars(allFilteredUsers, { cancelled: () => cancelled }).catch(() => {
			// Avatar hydration is opportunistic; failing should not block panel usage.
		})

		return () => {
			cancelled = true
		}
	}, [allFilteredUsers, hydrateMissingAvatars, open])

	const refreshMissingAvatars = async () => {
		setRefreshingAvatars(true)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			await hydrateMissingAvatars(allFilteredUsers, { showStatus: true })
		} catch {
			setErrorMessage('No se pudieron actualizar los avatares. Inténtalo de nuevo.')
		} finally {
			setRefreshingAvatars(false)
		}
	}

	const updateFilter = async (username: string, ignoreType: MobileLiteIgnoreType | null) => {
		const normalizedUsername = normalizeUsername(username)
		if (!normalizedUsername) return false

		setSavingUser(normalizedUsername)
		setErrorMessage(null)
		setStatusMessage(null)
		try {
			const nextData = await updateUserIgnore(normalizedUsername, ignoreType)
			setData(nextData)
			return true
		} catch {
			setErrorMessage('No se pudo guardar el filtro. Inténtalo de nuevo.')
			return false
		} finally {
			setSavingUser(null)
		}
	}

	const removeUserFilter = async (username: string) => {
		const previousData = data
		const previousScrollTop = panelBodyRef.current?.scrollTop
		const optimisticData: UserCustomizationsData = {
			...data,
			users: { ...data.users },
		}
		setUserIgnoreInData(optimisticData, username, null)

		setSavingUser(username)
		setErrorMessage(null)
		setStatusMessage(null)
		setData(optimisticData)
		try {
			const nextData = await updateUserIgnore(username, null)
			setData(nextData)
			if (previousScrollTop !== undefined) {
				window.requestAnimationFrame(() => {
					if (panelBodyRef.current) panelBodyRef.current.scrollTop = previousScrollTop
				})
			}
			return true
		} catch {
			setData(previousData)
			setErrorMessage('No se pudo guardar el filtro. Inténtalo de nuevo.')
			return false
		} finally {
			setSavingUser(null)
		}
	}

	const addQueryFilter = async (ignoreType: MobileLiteIgnoreType) => {
		const username = exactQueryUsername
		const saved = await updateFilter(username, ignoreType)
		if (!saved) return

		setQuery('')
		setStatusMessage(ignoreType === 'mute' ? `${exactQueryDisplayName} silenciado.` : `${exactQueryDisplayName} ocultado.`)
	}

	const saveImgbbApiKey = async () => {
		setSavingImgbbApiKey(true)
		setImgbbErrorMessage(null)
		setImgbbStatusMessage(null)
		try {
			const nextApiKey = imgbbApiKeyDraft.trim()
			await saveMobileLiteImgbbApiKey(nextApiKey)
			setImgbbApiKey(nextApiKey)
			setImgbbApiKeyDraft(nextApiKey)
			setImgbbStatusMessage(nextApiKey ? 'API key de ImgBB guardada.' : 'API key de ImgBB eliminada.')
		} catch {
			setImgbbErrorMessage('No se pudo guardar la API key de ImgBB.')
		} finally {
			setSavingImgbbApiKey(false)
		}
	}

	const pasteImgbbApiKey = async () => {
		setImgbbErrorMessage(null)
		setImgbbStatusMessage(null)
		try {
			const text = await navigator.clipboard.readText()
			setImgbbApiKeyDraft(text.trim())
			setImgbbStatusMessage('Clave pegada. Pulsa Guardar para activarla.')
		} catch {
			setImgbbErrorMessage('No se pudo leer el portapapeles. Pega la clave manualmente.')
		}
	}

	const restoreHiddenThread = async (thread: HiddenThread) => {
		const previousThreads = hiddenThreads
		const previousScrollTop = panelBodyRef.current?.scrollTop
		setRestoringThread(thread.id)
		setHiddenThreadsStatusMessage(null)
		setHiddenThreadsErrorMessage(null)
		setHiddenThreads(currentThreads => currentThreads.filter(currentThread => currentThread.id !== thread.id))
		try {
			await unhideThread(thread.id)
			const nextThreads = await getHiddenThreads()
			setHiddenThreads(nextThreads)
			if (previousScrollTop !== undefined) {
				window.requestAnimationFrame(() => {
					if (panelBodyRef.current) panelBodyRef.current.scrollTop = previousScrollTop
				})
			}
		} catch {
			setHiddenThreads(previousThreads)
			setHiddenThreadsErrorMessage('No se pudo restaurar el hilo. Inténtalo de nuevo.')
		} finally {
			setRestoringThread(null)
		}
	}

	const restoreAllHiddenThreads = async () => {
		setClearingHiddenThreads(true)
		setHiddenThreadsStatusMessage(null)
		setHiddenThreadsErrorMessage(null)
		try {
			await clearHiddenThreads()
			setHiddenThreads([])
			setHiddenThreadQuery('')
			setConfirmClearHiddenThreads(false)
		} catch {
			setHiddenThreadsErrorMessage('No se pudieron restaurar todos los hilos. Inténtalo de nuevo.')
		} finally {
			setClearingHiddenThreads(false)
		}
	}

	if (!open) return null

	const overlayStyle: CSSProperties | undefined = viewportBounds.height
		? {
				height: `${viewportBounds.height}px`,
				top: `${viewportBounds.offsetTop}px`,
			}
		: undefined
	const panelShellClass = `absolute inset-x-0 top-0 mx-auto flex w-full max-w-[34rem] flex-col overflow-hidden border-y border-[#4b545d] bg-[#343b41] text-[#e5e8eb] shadow-2xl sm:left-1/2 sm:right-auto sm:w-[calc(100%_-_24px)] sm:-translate-x-1/2 sm:border ${
		hasScrollablePanelContent
			? 'bottom-0 max-h-full sm:bottom-[max(12px,env(safe-area-inset-bottom))] sm:top-[max(12px,env(safe-area-inset-top))] sm:rounded-lg'
			: 'max-h-[calc(100%_-_max(12px,env(safe-area-inset-bottom)))] rounded-b-lg sm:top-[max(12px,env(safe-area-inset-top))] sm:rounded-lg'
	}`
	const panelBodyClass = `overflow-y-auto overscroll-contain bg-[#384149] px-3 pb-[max(16px,calc(env(safe-area-inset-bottom)_+_16px))] ${
		hasScrollablePanelContent ? 'min-h-0 flex-1' : ''
	}`

	return (
		<div className="fixed inset-x-0 top-0 z-[99999] h-[100dvh] overflow-hidden overscroll-none bg-black/65" style={overlayStyle}>
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			<section className={panelShellClass}>
				<header className="flex items-center justify-between border-b border-[#46505a] bg-[#30363d] px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
					<div className="flex min-w-0 items-center gap-2.5">
						<img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" aria-hidden="true" />
						<div className="flex min-w-0 items-baseline gap-2">
							<h2 className="truncate text-[17px] font-black uppercase leading-none tracking-tight">
								<span>MV</span>
								<span className="italic text-[#f0a020]">Premium</span>
							</h2>
							<p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c5cbd2]">Dashboard</p>
						</div>
					</div>
					<button
						type="button"
						className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#56606a] bg-[#4a525d] text-[#eef1f3] transition-colors active:bg-[#59626d]"
						aria-label="Cerrar"
						onClick={() => setOpen(false)}
					>
						<X className="h-5 w-5" aria-hidden="true" />
					</button>
				</header>

				<div ref={panelBodyRef} className={panelBodyClass}>
					<div className="sticky top-0 z-20 -mx-3 mb-3 bg-[#384149] px-3 pb-2 pt-3 shadow-[0_10px_18px_rgba(24,28,34,0.22)]">
						<div className="grid grid-cols-3 gap-1 rounded-lg border border-[#3f4853] bg-[#323942] p-1" role="tablist" aria-label="Secciones del panel MVPremium">
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'users'}
							className={`${TAB_BASE_CLASS} ${activeTab === 'users' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => setActiveTab('users')}
						>
							<UserX className="h-4 w-4" aria-hidden="true" />
							Usuarios
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'threads'}
							aria-label="Hilos"
							className={`${TAB_BASE_CLASS} ${activeTab === 'threads' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => setActiveTab('threads')}
						>
							<EyeOff className="h-4 w-4" aria-hidden="true" />
							<span>Hilos</span>
							{hiddenThreads.length > 0 && (
								<span
									aria-hidden="true"
									className={`ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5 ${
										activeTab === 'threads' ? 'bg-[#252b31]/85 text-white' : 'bg-[#252b31] text-[#d8dde2]'
									}`}
								>
									{hiddenThreads.length}
								</span>
							)}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'images'}
							className={`${TAB_BASE_CLASS} ${activeTab === 'images' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => setActiveTab('images')}
						>
							<Image className="h-4 w-4" aria-hidden="true" />
							ImgBB
						</button>
						</div>
					</div>

					{activeTab === 'users' ? (
						<>
							{errorMessage && (
								<div role="alert" className={`mb-3 ${STATUS_ERROR_CLASS}`}>
									{errorMessage}
								</div>
							)}

							<label className="relative block">
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aeb6be]" aria-hidden="true" />
								<input
									type="search"
									value={query}
									autoCapitalize="none"
									spellCheck={false}
									aria-describedby={usernameValidationMessage ? USERNAME_VALIDATION_ID : undefined}
									onChange={event => {
										setQuery(event.target.value)
										setStatusMessage(null)
									}}
									placeholder="Buscar o añadir nick (3-13)"
									className="h-11 w-full rounded-md border border-[#505963] bg-[#282f38] pl-10 pr-3 text-base text-[#eef1f3] outline-none placeholder:text-[#aeb6be] focus:border-[#d06d00] focus:shadow-[0_0_0_1px_rgba(208,109,0,0.35)]"
								/>
							</label>

							{usernameValidationMessage && (
								<p id={USERNAME_VALIDATION_ID} className="mt-2 text-xs text-[#d8b36a]">
									{usernameValidationMessage}
								</p>
							)}

							{statusMessage && (
								<div role="status" className={`mt-3 ${STATUS_SUCCESS_CLASS}`}>
									{statusMessage}
								</div>
							)}

							{hasAnyFilteredUsers && (
								<div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Filtrar usuarios">
									{filterOptions.map(option => {
										const isActive = activeFilter === option.id

										return (
											<button
												key={option.id}
												type="button"
												className={`${FILTER_BASE_CLASS} ${isActive ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}`}
												aria-pressed={isActive}
												onClick={() => setActiveFilter(option.id)}
											>
												<span className="truncate">{option.label}</span>
												<span className="ml-1 shrink-0 rounded bg-[#252b31]/80 px-1.5 py-0.5 text-[11px] leading-none text-[#eef1f3]">
													({option.count})
												</span>
											</button>
										)
									})}
								</div>
							)}

							{hasAnyFilteredUsers && (
								<button
									type="button"
									className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#5a646f] bg-[#4b535d] px-3 text-sm font-semibold text-[#e3e7eb] transition-colors disabled:opacity-60"
									disabled={refreshingAvatars || missingAvatarCount === 0}
									onClick={refreshMissingAvatars}
								>
									<RefreshCw className={`h-4 w-4 ${refreshingAvatars ? 'animate-spin' : ''}`} aria-hidden="true" />
									<span>
										{refreshingAvatars
											? 'Actualizando avatares'
											: missingAvatarCount > 0
												? `Actualizar avatares (${missingAvatarCount})`
												: 'Avatares actualizados'}
									</span>
								</button>
							)}

							{canAddQueryUser && (
								<div className="mt-3 rounded-md border border-dashed border-[#65707b] bg-[#323b45] p-3">
									<div className="flex items-center gap-2 text-sm font-medium">
										<UserX className="h-4 w-4 text-[#b7bec6]" aria-hidden="true" />
										<span className="min-w-0 truncate">{exactQueryDisplayName}</span>
									</div>
									<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2">
										<button
											type="button"
											className={`${ACTION_BUTTON_BASE_CLASS} ${ACTION_IDLE_CLASS}`}
											disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
											onClick={() => addQueryFilter('mute')}
										>
											<VolumeX className="h-4 w-4" aria-hidden="true" />
											Silenciar
										</button>
										<button
											type="button"
											className={`${ACTION_BUTTON_BASE_CLASS} ${ACTION_IDLE_CLASS}`}
											disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
											onClick={() => addQueryFilter('hide')}
										>
											<EyeOff className="h-4 w-4" aria-hidden="true" />
											Ocultar
										</button>
									</div>
								</div>
							)}

							<div className="mt-4 space-y-2">
								{filteredUsers.length === 0 ? (
									<div className="rounded-md border border-[#4b545d] bg-[#333b46] px-4 py-7 text-center text-sm text-[#c5cbd2]">
										<UserX className="mx-auto mb-3 h-5 w-5 text-[#9fa8b2]" aria-hidden="true" />
										<p className="font-semibold text-[#d8dde2]">
											{hasAnyFilteredUsers ? 'No hay resultados para este filtro.' : 'No hay usuarios filtrados.'}
										</p>
										{!hasAnyFilteredUsers && (
											<p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-[#aeb6be]">
												Escribe un nick exacto para silenciarlo u ocultarlo desde este panel.
											</p>
										)}
									</div>
								) : (
									filteredUsers.map(user => {
										const ignoreType = getIgnoreTypeFromCustomization(user.customization) ?? 'hide'
										const isSaving = savingUser?.toLowerCase() === user.username.toLowerCase()

										return (
											<article key={user.username} className="rounded-md border border-[#4b545d] bg-[#3f4853] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#252b31] text-sm font-bold">
														{user.customization.avatarUrl ? (
															<img src={user.customization.avatarUrl} alt="" className="h-full w-full object-cover" />
														) : (
															user.username.slice(0, 1).toUpperCase()
														)}
													</div>
													<div className="min-w-0 flex-1">
														<div className="truncate text-base font-semibold">{user.username}</div>
													</div>
												</div>

												<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2">
													<button
														type="button"
														className={`${ACTION_BUTTON_BASE_CLASS} ${
															ignoreType === 'mute' ? ACTION_MUTE_ACTIVE_CLASS : ACTION_IDLE_CLASS
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'mute')}
													>
														<VolumeX className="h-4 w-4" aria-hidden="true" />
														<span>{ignoreType === 'mute' ? 'Silenciado' : 'Silenciar'}</span>
													</button>
													<button
														type="button"
														className={`${ACTION_BUTTON_BASE_CLASS} ${
															ignoreType === 'hide' ? ACTION_HIDE_ACTIVE_CLASS : ACTION_IDLE_CLASS
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'hide')}
													>
														<EyeOff className="h-4 w-4" aria-hidden="true" />
														<span>{ignoreType === 'hide' ? 'Ocultado' : 'Ocultar'}</span>
													</button>
													<button
														type="button"
														className="col-span-full inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-md border border-[#5a646f] bg-[#4b535d] px-2 text-sm font-semibold text-[#e3e7eb] transition-colors disabled:opacity-60"
														disabled={isSaving}
														onClick={() => removeUserFilter(user.username)}
													>
														<Trash2 className="h-4 w-4" aria-hidden="true" />
														<span>Quitar</span>
													</button>
												</div>
											</article>
										)
									})
								)}
							</div>
						</>
					) : activeTab === 'threads' ? (
						<div className="space-y-3">
							{hiddenThreadsStatusMessage && (
								<div role="status" className={STATUS_SUCCESS_CLASS}>
									{hiddenThreadsStatusMessage}
								</div>
							)}

							{hiddenThreadsErrorMessage && (
								<div role="alert" className={STATUS_ERROR_CLASS}>
									{hiddenThreadsErrorMessage}
								</div>
							)}

							{hiddenThreads.length === 0 ? (
								<div className="rounded-md border border-[#4b545d] bg-[#333b46] px-4 py-7 text-center text-sm text-[#c5cbd2]">
									<EyeOff className="mx-auto mb-3 h-5 w-5 text-[#9fa8b2]" aria-hidden="true" />
									<p className="font-semibold text-[#d8dde2]">No hay hilos ocultos.</p>
									<p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-[#aeb6be]">
										Los hilos que ocultes desde los listados aparecerán aquí.
									</p>
								</div>
							) : (
								<>
									<div className="sticky top-[70px] z-10 -mx-3 space-y-2 bg-[#384149] px-3 pb-2 pt-1 shadow-[0_10px_18px_rgba(24,28,34,0.18)]">
										<label className="relative block min-w-0">
											<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aeb6be]" aria-hidden="true" />
											<input
												type="search"
												value={hiddenThreadQuery}
												autoCapitalize="none"
												spellCheck={false}
												onChange={event => setHiddenThreadQuery(event.target.value)}
												placeholder="Buscar hilo o subforo"
												className="h-11 w-full rounded-md border border-[#505963] bg-[#282f38] pl-10 pr-3 text-sm text-[#eef1f3] outline-none placeholder:text-[#aeb6be] focus:border-[#d06d00] focus:shadow-[0_0_0_1px_rgba(208,109,0,0.35)]"
											/>
										</label>
										<button
											type="button"
											aria-label="Mostrar todos"
											className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#66736a] bg-[#405347] px-3 text-sm font-semibold text-[#e8f6eb] transition-colors active:bg-[#4a6252] disabled:opacity-60"
											disabled={clearingHiddenThreads}
											onClick={() => setConfirmClearHiddenThreads(true)}
										>
											<RotateCcw className="h-4 w-4" aria-hidden="true" />
											<span>Mostrar todos los hilos</span>
										</button>
									</div>

									{filteredHiddenThreads.length === 0 ? (
										<div className="rounded-md border border-[#4b545d] bg-[#333b46] px-4 py-7 text-center text-sm text-[#c5cbd2]">
											<EyeOff className="mx-auto mb-3 h-5 w-5 text-[#9fa8b2]" aria-hidden="true" />
											<p className="font-semibold text-[#d8dde2]">No hay resultados.</p>
										</div>
									) : (
										<div className="space-y-2.5">
											{filteredHiddenThreads.map(thread => {
												const isRestoring = restoringThread === thread.id
												const subforumSlug = getSubforumSlugFromId(thread.subforumId)
												const subforumIconId = getSubforumIconId(subforumSlug)
												const hiddenAtLabel = formatHiddenThreadDate(thread.hiddenAt)

												return (
													<article key={thread.id} className="grid grid-cols-[minmax(0,1fr)_52px] overflow-hidden rounded-md border border-[#596272] bg-[#424b5b] shadow-[0_1px_0_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)]">
														<div className="min-w-0 px-3 py-3">
															<div className="flex min-w-0 items-start gap-3">
																{subforumIconId !== null && (
																	<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#687383] bg-[#343c49] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
																		<NativeFidIcon iconId={subforumIconId} className="h-6 w-6 shrink-0" />
																	</div>
																)}
																<div className="min-w-0 flex-1">
																	<div className="line-clamp-2 text-base font-bold leading-snug text-[#f2f4f7]">{thread.title}</div>
																	<div className="mt-1 flex min-w-0 items-center justify-between gap-3 text-xs font-semibold text-[#c4ccd5]">
																		<span className="min-w-0 truncate">{thread.subforum}</span>
																		{hiddenAtLabel && <span className="shrink-0 tabular-nums font-medium text-[#aeb6be]">{hiddenAtLabel}</span>}
																	</div>
																</div>
															</div>
														</div>
														<div className="flex items-center justify-center border-l border-[#596272] bg-[#394353] p-1">
															<button
																type="button"
																className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#607666] bg-[#465f4e] text-[#e8f6eb] transition-colors active:bg-[#52705b] disabled:opacity-60"
																aria-label="Mostrar"
																title="Mostrar"
																disabled={isRestoring}
																onClick={() => restoreHiddenThread(thread)}
															>
																<RotateCcw className="h-5 w-5" aria-hidden="true" />
															</button>
														</div>
													</article>
												)
											})}
										</div>
									)}
								</>
							)}
						</div>
					) : (
						<div className="space-y-3">
							<div className="rounded-md border border-[#4b545d] bg-[#333b46] p-3">
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#252b31] text-[#f0a020]">
										<KeyRound className="h-5 w-5" aria-hidden="true" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<div className="text-base font-semibold">ImgBB</div>
											<span
												className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
													isImgbbConfigured ? 'bg-[#274532] text-[#bdf2c7]' : 'bg-[#403a2c] text-[#e7c77f]'
												}`}
											>
												{isImgbbConfigured && <Check className="h-3 w-3" aria-hidden="true" />}
												{isImgbbConfigured ? 'ImgBB activo' : 'Freeimage gratis'}
											</span>
										</div>
										<p className="mt-1 text-sm text-[#c4cad0]">
											{isImgbbConfigured
												? 'Tus subidas de imágenes usarán ImgBB con tu API key.'
												: 'Sin API key se usará Freeimage, el servicio gratuito por defecto.'}
										</p>
									</div>
								</div>

								<label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#b7bec6]" htmlFor="mvp-mobile-lite-imgbb-key">
									API key
								</label>
								<input
									id="mvp-mobile-lite-imgbb-key"
									type="password"
									value={imgbbApiKeyDraft}
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									onChange={event => {
										setImgbbApiKeyDraft(event.target.value)
										setImgbbStatusMessage(null)
										setImgbbErrorMessage(null)
									}}
									placeholder="Pega tu API key de ImgBB"
									className="mt-2 h-11 w-full rounded-md border border-[#505963] bg-[#282f38] px-3 font-mono text-sm text-[#eef1f3] outline-none placeholder:text-[#aeb6be] focus:border-[#d06d00] focus:shadow-[0_0_0_1px_rgba(208,109,0,0.35)]"
								/>

								<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(116px,1fr))] gap-2">
									<button
										type="button"
										className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#5b646e] px-2 text-sm font-semibold transition-colors active:bg-[#66717c]"
										onClick={pasteImgbbApiKey}
									>
										<Clipboard className="h-4 w-4" aria-hidden="true" />
										Pegar
									</button>
									<button
										type="button"
										className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d06d00] bg-[#8a5b00] px-2 text-sm font-semibold text-white transition-colors disabled:border-[#5a646f] disabled:bg-[#4b535d] disabled:text-[#b7bec6]"
										disabled={savingImgbbApiKey || !isImgbbDirty}
										onClick={saveImgbbApiKey}
									>
										<Check className="h-4 w-4" aria-hidden="true" />
										{savingImgbbApiKey ? 'Guardando' : 'Guardar'}
									</button>
								</div>
							</div>

							{imgbbStatusMessage && (
								<div role="status" className={STATUS_SUCCESS_CLASS}>
									{imgbbStatusMessage}
								</div>
							)}

							{imgbbErrorMessage && (
								<div role="alert" className={STATUS_ERROR_CLASS}>
									{imgbbErrorMessage}
								</div>
							)}

							<a
								href="https://api.imgbb.com/"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#56616b] bg-[#333a45] px-3 text-sm font-semibold text-[#eef1f3] transition-colors active:bg-[#3d4651]"
							>
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
								Obtener API key
							</a>
						</div>
					)}
				</div>
			</section>

			{confirmClearHiddenThreads && (
				<div className="absolute inset-0 z-30 flex items-end justify-center bg-black/50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
					<button
						type="button"
						className="absolute inset-0 h-full w-full cursor-default"
						aria-label="Cancelar restauración de hilos"
						onClick={() => setConfirmClearHiddenThreads(false)}
					/>
					<div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="mvp-mobile-lite-clear-hidden-threads-title"
						aria-describedby="mvp-mobile-lite-clear-hidden-threads-description"
						className="relative w-full max-w-[32rem] rounded-lg border border-[#4b545d] bg-[#333b46] p-4 text-sm text-[#e5e8eb] shadow-2xl"
					>
						<p id="mvp-mobile-lite-clear-hidden-threads-title" className="text-base font-semibold text-[#f2f4f7]">
							Se mostrarán todos los hilos ocultos.
						</p>
						<p id="mvp-mobile-lite-clear-hidden-threads-description" className="mt-1 text-sm leading-relaxed text-[#c4cad0]">
							Esto vaciará tu lista de hilos ocultos en este dispositivo.
						</p>
						<div className="mt-4 grid grid-cols-2 gap-2">
							<button
								type="button"
								className="inline-flex h-11 items-center justify-center rounded-md border border-[#626b74] bg-[#4b535d] px-2 text-sm font-semibold text-[#eef1f3] transition-colors active:bg-[#59636e]"
								onClick={() => setConfirmClearHiddenThreads(false)}
							>
								Cancelar
							</button>
							<button
								type="button"
								className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#ff7a1f] bg-[#b7470d] px-2 text-sm font-semibold text-white transition-colors active:bg-[#d0500f] disabled:opacity-60"
								disabled={clearingHiddenThreads}
								onClick={restoreAllHiddenThreads}
							>
								<RotateCcw className="h-4 w-4" aria-hidden="true" />
								{clearingHiddenThreads ? 'Restaurando' : 'Continuar'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
