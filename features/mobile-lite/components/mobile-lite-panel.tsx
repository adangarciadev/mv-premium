import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Settings from 'lucide-react/dist/esm/icons/settings'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { sendMessage, type MvUserSearchUser } from '@/lib/messaging'
import { getSettings, useSettingsStore } from '@/store/settings-store'
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
	type UserCustomizationsData,
} from '@/features/user-customizations/storage'
import {
	getCustomizationEntryForUser,
	getIgnoreTypeFromCustomization,
	setUserIgnoreInData,
	type MobileLiteIgnoreType,
} from '../logic/ignore-helpers'
import { dispatchMobileLiteIgnoredUsersSync } from '../logic/ignored-users-sync-event'
import { getAvatarUrlFromImage, sanitizeAvatarUrl } from '../logic/avatar-utils'
import { getOwnUsername } from '../logic/own-username'
import {
	getMobileLiteBoldColorSettings,
	normalizeMobileLiteBoldColor,
	saveMobileLiteBoldColorSettings,
} from '../logic/bold-color'
import { applyMobileLiteHiddenThreads } from '../logic/hidden-threads'
import { getMobileLiteImgbbApiKey, saveMobileLiteImgbbApiKey } from '../logic/imgbb-api-key-storage'
import { syncMobileLiteGalleryButton } from '../logic/gallery'
import { syncMobileLiteLiveThreadButton } from '../logic/live-thread'
import { syncMobileLiteQuoteSelection } from '../logic/quote-selection'
import {
	getLatestMobileLiteEntry,
	getMobileLiteChangelog,
	hasUnseenMobileLiteChanges,
	markCurrentMobileLiteVersionAsSeen,
} from '../logic/whats-new'
import {
	DEFAULT_BOLD_COLOR,
	getEmptyData,
	getFilteredUsers,
	getSubforumSlugFromId,
	getUsernameValidationMessage,
	normalizeUsername,
	safeDecodeURIComponent,
	SELF_IGNORE_MESSAGE,
	USER_SUGGESTIONS_DEBOUNCE_MS,
	USER_SUGGESTIONS_MAX,
	type ActiveFilter,
	type FilteredUser,
	type PanelTab,
	type PanelView,
} from './panel-helpers'
import { TAB_ACTIVE_CLASS, TAB_BASE_CLASS, TAB_IDLE_CLASS } from './panel-tokens'
import { PanelToast } from './panel-toast'
import { MobileLiteWhatsNewView } from './whats-new-view'
import { ConfirmClearHiddenThreadsDialog } from './confirm-clear-dialog'
import { SettingsTab } from './tabs/settings-tab'
import { ThreadsTab } from './tabs/threads-tab'
import { UsersTab } from './tabs/users-tab'

export const MOBILE_LITE_PANEL_OPEN_EVENT = 'mvp-mobile-lite-panel:open'

function findVisibleUserAvatar(username: string): string | undefined {
	const normalizedUsername = username.toLowerCase()
	const userLinks = Array.from(
		document.querySelectorAll<HTMLAnchorElement>('a.user-card[href^="/id/"], a.autor[href^="/id/"], a[href^="/id/"]')
	)

	for (const link of userLinks) {
		const hrefUsername = link.getAttribute('href')?.match(/\/id\/([^/?#]+)/)?.[1] || ''
		const linkUsername = safeDecodeURIComponent(hrefUsername || link.querySelector('img')?.alt?.trim() || link.textContent?.trim() || '')
		if (linkUsername.toLowerCase() !== normalizedUsername) continue

		const avatarUrl = getAvatarUrlFromImage(link.querySelector<HTMLImageElement>('img.avatar, img'))
		if (avatarUrl) return avatarUrl

		const postContainer = link.closest('.post, .respuesta, .msg, article, li, div[id^="post"], div[id^="respuesta"]')
		const postAvatarUrl = getAvatarUrlFromImage(
			postContainer?.querySelector<HTMLImageElement>(
				'img.avatar, .avatar img, .post-avatar img, .user-avatar img, img[src*="/img/users/avatar/"]'
			)
		)
		if (postAvatarUrl) return postAvatarUrl
	}

	return undefined
}

async function resolveUserAvatar(username: string): Promise<string | undefined> {
	const visibleAvatar = findVisibleUserAvatar(username)
	if (visibleAvatar) return visibleAvatar

	const result = await sendMessage('resolveMvUserAvatar', { username })
	return result.success ? sanitizeAvatarUrl(result.avatarUrl) : undefined
}

async function updateUserIgnore(
	username: string,
	ignoreType: MobileLiteIgnoreType | null,
	knownAvatarUrl?: string
): Promise<UserCustomizationsData> {
	const data = await getUserCustomizations()
	const { storageKey } = setUserIgnoreInData(data, username, ignoreType)
	const storedAvatarUrl = sanitizeAvatarUrl(data.users[storageKey]?.avatarUrl)
	const avatarUrl =
		ignoreType && !storedAvatarUrl
			? (sanitizeAvatarUrl(knownAvatarUrl) ?? (await resolveUserAvatar(storageKey)))
			: undefined
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
	const [panelView, setPanelView] = useState<PanelView>('main')
	const [activeTab, setActiveTab] = useState<PanelTab>('users')
	const [data, setData] = useState<UserCustomizationsData>(getEmptyData)
	const [query, setQuery] = useState('')
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
	const [savingUser, setSavingUser] = useState<string | null>(null)
	const [userSuggestions, setUserSuggestions] = useState<MvUserSearchUser[]>([])
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [imgbbApiKey, setImgbbApiKey] = useState('')
	const [imgbbApiKeyDraft, setImgbbApiKeyDraft] = useState('')
	const [boldColor, setBoldColor] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorDraft, setBoldColorDraft] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorEnabled, setBoldColorEnabled] = useState(false)
	const [boldColorExpanded, setBoldColorExpanded] = useState(false)
	const [liveThreadEnabled, setLiveThreadEnabled] = useState(false)
	const [galleryButtonEnabled, setGalleryButtonEnabled] = useState(true)
	const [quoteSelectionEnabled, setQuoteSelectionEnabled] = useState(true)
	const [hideThreadButtonEnabled, setHideThreadButtonEnabled] = useState(true)
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
	const [savingBoldColor, setSavingBoldColor] = useState(false)
	const [boldColorStatusMessage, setBoldColorStatusMessage] = useState<string | null>(null)
	const [boldColorErrorMessage, setBoldColorErrorMessage] = useState<string | null>(null)
	const [savingMobileLiteSetting, setSavingMobileLiteSetting] = useState<
		'liveThreadEnabled' | 'galleryButtonEnabled' | 'quoteSelectionEnabled' | 'hideThreadEnabled' | null
	>(null)
	const [mobileLiteSettingsStatusMessage, setMobileLiteSettingsStatusMessage] = useState<string | null>(null)
	const [mobileLiteSettingsErrorMessage, setMobileLiteSettingsErrorMessage] = useState<string | null>(null)
	const [hasUnseenWhatsNew, setHasUnseenWhatsNew] = useState(false)
	const avatarHydrationInFlight = useRef<Set<string>>(new Set())
	const panelBodyRef = useRef<HTMLDivElement>(null)
	const dragStartYRef = useRef<number | null>(null)
	const sheetRef = useRef<HTMLElement>(null)
	const [dragOffset, setDragOffset] = useState(0)
	const [isDragging, setIsDragging] = useState(false)

	useEffect(() => {
		let mounted = true

		const handleOpen = () => {
			setPanelView('main')
			setOpen(true)
		}
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
		hasUnseenMobileLiteChanges()
			.then(hasUnseen => {
				if (mounted) setHasUnseenWhatsNew(hasUnseen)
			})
			.catch(() => {
				if (mounted) setHasUnseenWhatsNew(false)
			})

		return () => {
			mounted = false
		}
	}, [open])

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
		getMobileLiteBoldColorSettings()
			.then(settings => {
				if (!mounted) return
				setBoldColor(settings.color)
				setBoldColorDraft(settings.color)
				setBoldColorEnabled(settings.enabled)
				setBoldColorStatusMessage(null)
				setBoldColorErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setBoldColorErrorMessage('No se pudo cargar el color de negrita.')
			})
		getSettings()
			.then(settings => {
				if (!mounted) return
				setLiveThreadEnabled(settings.liveThreadEnabled === true)
				setGalleryButtonEnabled(settings.galleryButtonEnabled !== false)
				setQuoteSelectionEnabled(settings.quoteSelectionEnabled !== false)
				setHideThreadButtonEnabled(settings.hideThreadEnabled !== false)
				setMobileLiteSettingsStatusMessage(null)
				setMobileLiteSettingsErrorMessage(null)
			})
			.catch(() => {
				if (mounted) setMobileLiteSettingsErrorMessage('No se pudieron cargar los ajustes de Mobile Lite.')
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

	// Success feedback is transient (toast above the tab bar); errors persist until the next action.
	useEffect(() => {
		if (
			!statusMessage &&
			!hiddenThreadsStatusMessage &&
			!imgbbStatusMessage &&
			!boldColorStatusMessage &&
			!mobileLiteSettingsStatusMessage
		) {
			return
		}

		const timeout = window.setTimeout(() => {
			setStatusMessage(null)
			setHiddenThreadsStatusMessage(null)
			setImgbbStatusMessage(null)
			setBoldColorStatusMessage(null)
			setMobileLiteSettingsStatusMessage(null)
		}, 3500)

		return () => window.clearTimeout(timeout)
	}, [statusMessage, hiddenThreadsStatusMessage, imgbbStatusMessage, boldColorStatusMessage, mobileLiteSettingsStatusMessage])

	const handleSheetTouchStart = (event: ReactTouchEvent) => {
		dragStartYRef.current = event.touches[0]?.clientY ?? null
		setIsDragging(true)
	}

	const handleSheetTouchMove = (event: ReactTouchEvent) => {
		if (dragStartYRef.current === null) return
		const currentY = event.touches[0]?.clientY ?? dragStartYRef.current
		setDragOffset(Math.max(0, currentY - dragStartYRef.current))
	}

	const handleSheetTouchEnd = () => {
		const sheetHeight = sheetRef.current?.offsetHeight ?? 0
		// Dismiss only after a deliberate pull: ~1/4 of the sheet height (140px minimum on any screen).
		const dismissThreshold = Math.max(140, sheetHeight * 0.25)
		const shouldClose = dragOffset > dismissThreshold
		dragStartYRef.current = null
		setIsDragging(false)

		if (shouldClose && sheetHeight > 0) {
			// Animated exit: slide the sheet fully down, then unmount.
			setDragOffset(sheetHeight)
			window.setTimeout(() => {
				setOpen(false)
				setDragOffset(0)
			}, 220)
			return
		}

		// Below the threshold: snap back (animated by the transform transition).
		setDragOffset(0)
	}

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
	const ownUsername = getOwnUsername()
	const isOwnQueryUser = Boolean(exactQueryUsername) && exactQueryUsername.toLowerCase() === ownUsername
	const exactQueryEntry = exactQueryUsername ? getCustomizationEntryForUser(data, exactQueryUsername) : null
	const exactQueryCustomization = exactQueryEntry?.customization
	const usernameValidationMessage = isOwnQueryUser
		? SELF_IGNORE_MESSAGE
		: getUsernameValidationMessage(exactQueryUsername)
	const canAddQueryUser = Boolean(exactQueryUsername && !usernameValidationMessage && !exactQueryCustomization?.isIgnored)
	const canSearchUserSuggestions = Boolean(exactQueryUsername) && !usernameValidationMessage
	const exactQuerySuggestion =
		userSuggestions.find(user => user.username.toLowerCase() === exactQueryUsername.toLowerCase()) ?? null
	const exactQueryDisplayName = exactQueryEntry?.storageKey ?? exactQuerySuggestion?.username ?? exactQueryUsername
	const addUserSuggestions = useMemo(() => {
		if (!canSearchUserSuggestions) return []

		// Suggestions may be one keystroke behind the query (debounce), so they are
		// re-filtered here; self and already-filtered users never show up.
		const queryKey = exactQueryUsername.toLowerCase()
		return userSuggestions
			.filter(user => {
				const usernameKey = user.username.toLowerCase()
				if (usernameKey === queryKey || usernameKey === ownUsername) return false
				if (getCustomizationEntryForUser(data, user.username)?.customization.isIgnored) return false
				return usernameKey.includes(queryKey)
			})
			.slice(0, USER_SUGGESTIONS_MAX)
	}, [canSearchUserSuggestions, data, exactQueryUsername, ownUsername, userSuggestions])
	const hasAnyFilteredUsers = allFilteredUsers.length > 0
	const latestMobileLiteEntry = useMemo(() => getLatestMobileLiteEntry(), [])
	const mobileLiteChangelog = useMemo(() => getMobileLiteChangelog(), [])
	const latestMobileLiteChangeCount = latestMobileLiteEntry?.changes.length ?? 0
	// Placeholder URLs (lazy-load pixels) count as missing so the refresh button
	// can replace them with the real avatar.
	const missingAvatarCount = allFilteredUsers.filter(user => !sanitizeAvatarUrl(user.customization.avatarUrl)).length
	const isImgbbConfigured = Boolean(imgbbApiKey.trim())
	const isImgbbDirty = imgbbApiKeyDraft.trim() !== imgbbApiKey
	const normalizedBoldColorDraft = normalizeMobileLiteBoldColor(boldColorDraft)
	const isBoldColorDirty = normalizedBoldColorDraft !== boldColor
	const logoUrl = browser.runtime.getURL('/icon/48.png')

	const markWhatsNewAsSeen = useCallback(async () => {
		await markCurrentMobileLiteVersionAsSeen()
		setHasUnseenWhatsNew(false)
	}, [])

	const openWhatsNewView = useCallback(() => {
		setPanelView('whats-new')
		void markWhatsNewAsSeen()
		panelBodyRef.current?.scrollTo?.({ top: 0 })
	}, [markWhatsNewAsSeen])

	const hydrateMissingAvatars = useCallback(
		async (users: FilteredUser[], options: { cancelled?: () => boolean; showStatus?: boolean } = {}) => {
			const missingAvatarUsers = users.filter(user => {
				if (sanitizeAvatarUrl(user.customization.avatarUrl)) return false
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
					if (!entry?.customization.isIgnored || sanitizeAvatarUrl(entry.customization.avatarUrl)) continue

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
		// While a save is in flight the list reflects optimistic data; wait for the
		// final data before hydrating so primed avatars are not resolved again.
		if (!open || savingUser !== null || allFilteredUsers.length === 0) return

		let cancelled = false
		void hydrateMissingAvatars(allFilteredUsers, { cancelled: () => cancelled }).catch(() => {
			// Avatar hydration is opportunistic; failing should not block panel usage.
		})

		return () => {
			cancelled = true
		}
	}, [allFilteredUsers, hydrateMissingAvatars, open, savingUser])

	useEffect(() => {
		if (!open || activeTab !== 'users' || !canSearchUserSuggestions) {
			setUserSuggestions([])
			return
		}

		let cancelled = false
		const timeout = window.setTimeout(() => {
			void sendMessage('searchMvUsers', { query: exactQueryUsername })
				.then(result => {
					if (cancelled || !result.success) return
					setUserSuggestions(result.users ?? [])
				})
				.catch(() => {
					// Autocomplete is opportunistic; adding by exact nick still works.
				})
		}, USER_SUGGESTIONS_DEBOUNCE_MS)

		return () => {
			cancelled = true
			window.clearTimeout(timeout)
		}
	}, [activeTab, canSearchUserSuggestions, exactQueryUsername, open])

	// Input handlers grouped here so the tab subcomponents stay presentational:
	// each clears its own transient feedback alongside the value update.
	const handleQueryChange = (value: string) => {
		setQuery(value)
		setStatusMessage(null)
	}

	const handleImgbbDraftChange = (value: string) => {
		setImgbbApiKeyDraft(value)
		setImgbbStatusMessage(null)
		setImgbbErrorMessage(null)
	}

	const handleBoldColorDraftChange = (value: string) => {
		setBoldColorDraft(value)
		setBoldColorStatusMessage(null)
		setBoldColorErrorMessage(null)
	}

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

	const updateFilter = async (
		username: string,
		ignoreType: MobileLiteIgnoreType | null,
		options: { avatarUrl?: string } = {}
	) => {
		const normalizedUsername = normalizeUsername(username)
		if (!normalizedUsername) return false
		if (ignoreType && normalizedUsername.toLowerCase() === getOwnUsername()) {
			setErrorMessage(SELF_IGNORE_MESSAGE)
			return false
		}

		const previousData = data
		const optimisticData: UserCustomizationsData = {
			...data,
			users: { ...data.users },
		}
		const { storageKey: optimisticKey } = setUserIgnoreInData(optimisticData, normalizedUsername, ignoreType)
		// Prime the known avatar optimistically too; otherwise the avatar hydration
		// effect sees the new row without avatar and fires a redundant resolve.
		const knownAvatarUrl = sanitizeAvatarUrl(options.avatarUrl)
		if (ignoreType && knownAvatarUrl && !sanitizeAvatarUrl(optimisticData.users[optimisticKey]?.avatarUrl)) {
			optimisticData.users[optimisticKey] = { ...optimisticData.users[optimisticKey], avatarUrl: knownAvatarUrl }
		}

		setSavingUser(normalizedUsername)
		setErrorMessage(null)
		setStatusMessage(null)
		setData(optimisticData)
		try {
			const nextData = await updateUserIgnore(normalizedUsername, ignoreType, options.avatarUrl)
			setData(nextData)
			return true
		} catch {
			setData(previousData)
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
		// Prefer the remote suggestion match: real casing + avatar with no extra request.
		const username = exactQuerySuggestion?.username ?? exactQueryUsername
		const displayName = exactQueryDisplayName
		const saved = await updateFilter(username, ignoreType, { avatarUrl: exactQuerySuggestion?.avatarUrl })
		if (!saved) return

		setQuery('')
		setStatusMessage(ignoreType === 'mute' ? `${displayName} silenciado.` : `${displayName} ocultado.`)
	}

	const addSuggestionFilter = async (suggestion: MvUserSearchUser, ignoreType: MobileLiteIgnoreType) => {
		const saved = await updateFilter(suggestion.username, ignoreType, { avatarUrl: suggestion.avatarUrl })
		if (!saved) return

		setQuery('')
		setStatusMessage(ignoreType === 'mute' ? `${suggestion.username} silenciado.` : `${suggestion.username} ocultado.`)
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

	const saveBoldColor = async () => {
		setSavingBoldColor(true)
		setBoldColorErrorMessage(null)
		setBoldColorStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				color: normalizedBoldColorDraft,
				enabled: boldColorEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setBoldColorStatusMessage('Color de negrita guardado.')
		} catch {
			setBoldColorErrorMessage('No se pudo guardar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	const toggleBoldColor = async () => {
		const nextEnabled = !boldColorEnabled
		setSavingBoldColor(true)
		setBoldColorErrorMessage(null)
		setBoldColorStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				enabled: nextEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setBoldColorStatusMessage(nextSettings.enabled ? 'Color personalizado activado.' : 'Color personalizado desactivado.')
		} catch {
			setBoldColorErrorMessage('No se pudo cambiar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	const resetBoldColor = async () => {
		setSavingBoldColor(true)
		setBoldColorErrorMessage(null)
		setBoldColorStatusMessage(null)
		try {
			const nextSettings = await saveMobileLiteBoldColorSettings({
				color: DEFAULT_BOLD_COLOR,
				enabled: boldColorEnabled,
			})
			setBoldColor(nextSettings.color)
			setBoldColorDraft(nextSettings.color)
			setBoldColorEnabled(nextSettings.enabled)
			setBoldColorStatusMessage('Color de negrita restaurado.')
		} catch {
			setBoldColorErrorMessage('No se pudo restaurar el color de negrita.')
		} finally {
			setSavingBoldColor(false)
		}
	}

	const toggleLiveThreadSetting = async () => {
		const nextEnabled = !liveThreadEnabled
		setSavingMobileLiteSetting('liveThreadEnabled')
		setMobileLiteSettingsErrorMessage(null)
		setMobileLiteSettingsStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('liveThreadEnabled', nextEnabled)
			setLiveThreadEnabled(nextEnabled)
			await syncMobileLiteLiveThreadButton(nextEnabled)
			setMobileLiteSettingsStatusMessage(nextEnabled ? 'Modo Live activado.' : 'Modo Live desactivado.')
		} catch {
			setLiveThreadEnabled(!nextEnabled)
			setMobileLiteSettingsErrorMessage('No se pudo cambiar el Modo Live.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleGalleryButtonSetting = async () => {
		const nextEnabled = !galleryButtonEnabled
		setSavingMobileLiteSetting('galleryButtonEnabled')
		setMobileLiteSettingsErrorMessage(null)
		setMobileLiteSettingsStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('galleryButtonEnabled', nextEnabled)
			setGalleryButtonEnabled(nextEnabled)
			await syncMobileLiteGalleryButton(nextEnabled)
			setMobileLiteSettingsStatusMessage(nextEnabled ? 'Botón de galería activado.' : 'Botón de galería desactivado.')
		} catch {
			setGalleryButtonEnabled(!nextEnabled)
			setMobileLiteSettingsErrorMessage('No se pudo cambiar el botón de galería.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleQuoteSelectionSetting = async () => {
		const nextEnabled = !quoteSelectionEnabled
		setSavingMobileLiteSetting('quoteSelectionEnabled')
		setMobileLiteSettingsErrorMessage(null)
		setMobileLiteSettingsStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('quoteSelectionEnabled', nextEnabled)
			setQuoteSelectionEnabled(nextEnabled)
			await syncMobileLiteQuoteSelection(nextEnabled)
			setMobileLiteSettingsStatusMessage(nextEnabled ? 'Citar selección activado.' : 'Citar selección desactivado.')
		} catch {
			setQuoteSelectionEnabled(!nextEnabled)
			setMobileLiteSettingsErrorMessage('No se pudo cambiar Citar selección.')
		} finally {
			setSavingMobileLiteSetting(null)
		}
	}

	const toggleHideThreadButtonSetting = () => {
		const nextEnabled = !hideThreadButtonEnabled
		setSavingMobileLiteSetting('hideThreadEnabled')
		setMobileLiteSettingsErrorMessage(null)
		setMobileLiteSettingsStatusMessage(null)
		try {
			useSettingsStore.getState().setSetting('hideThreadEnabled', nextEnabled)
			setHideThreadButtonEnabled(nextEnabled)
			applyMobileLiteHiddenThreads()
			setMobileLiteSettingsStatusMessage(nextEnabled ? 'Botón de ocultar hilos activado.' : 'Botón de ocultar hilos desactivado.')
		} catch {
			setHideThreadButtonEnabled(!nextEnabled)
			setMobileLiteSettingsErrorMessage('No se pudo cambiar el botón de ocultar hilos.')
		} finally {
			setSavingMobileLiteSetting(null)
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

	// The overlay anchors with inset-0 (layout viewport) — correct on every
	// well-behaved device. On Firefox Android the dynamic toolbar makes that
	// viewport end ABOVE the real screen bottom while the toolbar is visible,
	// and no CSS unit (100vh overshoots, 100dvh undershoots) nor the
	// VisualViewport API reports the difference. Instead of guessing, a bleed
	// strip below the sheet fills any potential gap with the tab bar color;
	// when the viewport is accurate the bleed simply sits off-screen.
	return (
		<div className="fixed inset-0 z-[99999] flex items-end justify-center overscroll-none bg-black/60 animate-in fade-in-0 duration-200">
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			{/* Bleed: fills the Firefox Android dynamic-toolbar gap below the sheet */}
			<div aria-hidden="true" className="absolute inset-x-0 top-full mx-auto h-28 w-full max-w-[34rem] bg-[#14171d]" />

			<section
				ref={sheetRef}
				className="relative flex h-[90%] w-full max-w-[34rem] flex-col overflow-hidden rounded-t-[24px] bg-[#1c1f27] text-[#eef1f6] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-8 duration-300 ease-out"
				style={{
					transform: `translateY(${dragOffset}px)`,
					transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
				}}
			>
				<header
					className="shrink-0 touch-none select-none pt-[max(4px,env(safe-area-inset-top))]"
					onTouchStart={handleSheetTouchStart}
					onTouchMove={handleSheetTouchMove}
					onTouchEnd={handleSheetTouchEnd}
				>
					{/* Grab handle (drag down to dismiss) */}
					<div className="flex justify-center pb-1 pt-2">
						<span className="h-1 w-10 rounded-full bg-[#3a4254]" aria-hidden="true" />
					</div>
					<div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-1">
						<div className="flex min-w-0 items-center gap-2.5">
							<img src={logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" aria-hidden="true" />
							<h2 className="flex min-w-0 items-baseline gap-2 truncate">
								<span className="shrink-0 text-base font-black uppercase leading-none tracking-tighter">
									<span className="italic">MV</span>
									<span className="text-[#f0a020]">Premium</span>
								</span>
								<span className="truncate text-[9px] font-bold uppercase leading-none tracking-[0.25em] text-[#8b95a3]/80">
									Dashboard
								</span>
							</h2>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2e3543] text-[#aab4c0] transition-colors active:bg-[#3a4254]"
							aria-label="Cerrar"
							onClick={() => setOpen(false)}
						>
							<X className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				</header>

				<div ref={panelBodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
					{panelView === 'whats-new' ? (
						<MobileLiteWhatsNewView
							entries={mobileLiteChangelog}
							onBack={() => setPanelView('main')}
							onDone={() => {
								void markWhatsNewAsSeen()
								setPanelView('main')
							}}
						/>
					) : activeTab === 'users' ? (
						<UsersTab
							hasUnseenWhatsNew={hasUnseenWhatsNew}
							latestMobileLiteEntry={latestMobileLiteEntry}
							latestMobileLiteChangeCount={latestMobileLiteChangeCount}
							onOpenWhatsNew={openWhatsNewView}
							onDismissWhatsNew={() => void markWhatsNewAsSeen()}
							query={query}
							onQueryChange={handleQueryChange}
							usernameValidationMessage={usernameValidationMessage}
							hasAnyFilteredUsers={hasAnyFilteredUsers}
							filterOptions={filterOptions}
							activeFilter={activeFilter}
							onActiveFilterChange={setActiveFilter}
							canAddQueryUser={canAddQueryUser}
							addUserSuggestions={addUserSuggestions}
							exactQuerySuggestion={exactQuerySuggestion}
							exactQueryDisplayName={exactQueryDisplayName}
							exactQueryUsername={exactQueryUsername}
							savingUser={savingUser}
							onAddQueryFilter={addQueryFilter}
							onAddSuggestionFilter={addSuggestionFilter}
							missingAvatarCount={missingAvatarCount}
							refreshingAvatars={refreshingAvatars}
							onRefreshAvatars={refreshMissingAvatars}
							filteredUsers={filteredUsers}
							onUpdateFilter={updateFilter}
							onRemoveUserFilter={removeUserFilter}
						/>
					) : activeTab === 'threads' ? (
						<ThreadsTab
							hiddenThreads={hiddenThreads}
							hiddenThreadQuery={hiddenThreadQuery}
							filteredHiddenThreads={filteredHiddenThreads}
							restoringThread={restoringThread}
							clearingHiddenThreads={clearingHiddenThreads}
							onHiddenThreadQueryChange={setHiddenThreadQuery}
							onRequestClearAll={() => setConfirmClearHiddenThreads(true)}
							onRestoreThread={restoreHiddenThread}
						/>
					) : (
						<SettingsTab
							latestMobileLiteEntry={latestMobileLiteEntry}
							latestMobileLiteChangeCount={latestMobileLiteChangeCount}
							hasUnseenWhatsNew={hasUnseenWhatsNew}
							onOpenWhatsNew={openWhatsNewView}
							imgbbApiKeyDraft={imgbbApiKeyDraft}
							isImgbbConfigured={isImgbbConfigured}
							isImgbbDirty={isImgbbDirty}
							savingImgbbApiKey={savingImgbbApiKey}
							onImgbbDraftChange={handleImgbbDraftChange}
							onSaveImgbbApiKey={saveImgbbApiKey}
							boldColor={boldColor}
							boldColorDraft={boldColorDraft}
							normalizedBoldColorDraft={normalizedBoldColorDraft}
							boldColorEnabled={boldColorEnabled}
							boldColorExpanded={boldColorExpanded}
							isBoldColorDirty={isBoldColorDirty}
							savingBoldColor={savingBoldColor}
							onToggleBoldColor={toggleBoldColor}
							onToggleBoldColorExpanded={() => setBoldColorExpanded(value => !value)}
							onBoldColorDraftChange={handleBoldColorDraftChange}
							onResetBoldColor={resetBoldColor}
							onSaveBoldColor={saveBoldColor}
							liveThreadEnabled={liveThreadEnabled}
							galleryButtonEnabled={galleryButtonEnabled}
							quoteSelectionEnabled={quoteSelectionEnabled}
							hideThreadButtonEnabled={hideThreadButtonEnabled}
							savingMobileLiteSetting={savingMobileLiteSetting}
							onToggleLiveThread={toggleLiveThreadSetting}
							onToggleGallery={toggleGalleryButtonSetting}
							onToggleQuoteSelection={toggleQuoteSelectionSetting}
							onToggleHideThread={toggleHideThreadButtonSetting}
						/>
					)}
				</div>

				{/* Single feedback channel: transient toasts floating above the tab bar */}
				<div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 px-4">
					{statusMessage && <PanelToast kind="success">{statusMessage}</PanelToast>}
					{hiddenThreadsStatusMessage && <PanelToast kind="success">{hiddenThreadsStatusMessage}</PanelToast>}
					{imgbbStatusMessage && <PanelToast kind="success">{imgbbStatusMessage}</PanelToast>}
					{boldColorStatusMessage && <PanelToast kind="success">{boldColorStatusMessage}</PanelToast>}
					{mobileLiteSettingsStatusMessage && <PanelToast kind="success">{mobileLiteSettingsStatusMessage}</PanelToast>}
					{errorMessage && <PanelToast kind="error">{errorMessage}</PanelToast>}
					{hiddenThreadsErrorMessage && <PanelToast kind="error">{hiddenThreadsErrorMessage}</PanelToast>}
					{imgbbErrorMessage && <PanelToast kind="error">{imgbbErrorMessage}</PanelToast>}
					{boldColorErrorMessage && <PanelToast kind="error">{boldColorErrorMessage}</PanelToast>}
					{mobileLiteSettingsErrorMessage && <PanelToast kind="error">{mobileLiteSettingsErrorMessage}</PanelToast>}
				</div>

				{/* Bottom tab bar: thumb-reachable primary navigation */}
				<nav className="relative shrink-0 border-t border-[#2c3340] bg-[#14171d] px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
					<div className="flex h-[52px] items-stretch gap-1.5" role="tablist" aria-label="Secciones del panel MVPremium">
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'users'}
							aria-label="Usuarios"
							className={`${TAB_BASE_CLASS} ${activeTab === 'users' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('users')
							}}
						>
							<span className="relative">
								<UserX className="h-5 w-5" aria-hidden="true" />
								{allFilteredUsers.length > 0 && (
									<span
										aria-hidden="true"
										className="absolute -right-2.5 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f0a020] px-1 text-[10px] font-black leading-[18px] text-[#221604] ring-2 ring-[#14171d]"
									>
										{allFilteredUsers.length}
									</span>
								)}
							</span>
							Usuarios
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'threads'}
							aria-label="Hilos"
							className={`${TAB_BASE_CLASS} ${activeTab === 'threads' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('threads')
							}}
						>
							<span className="relative">
								<EyeOff className="h-5 w-5" aria-hidden="true" />
								{hiddenThreads.length > 0 && (
									<span
										aria-hidden="true"
										className="absolute -right-2.5 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#f0a020] px-1 text-[10px] font-black leading-[18px] text-[#221604] ring-2 ring-[#14171d]"
									>
										{hiddenThreads.length}
									</span>
								)}
							</span>
							Hilos
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'settings'}
							className={`${TAB_BASE_CLASS} ${activeTab === 'settings' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => {
								setPanelView('main')
								setActiveTab('settings')
							}}
						>
							<Settings className="h-5 w-5" aria-hidden="true" />
							Ajustes
						</button>
					</div>
				</nav>
			</section>

			{confirmClearHiddenThreads && (
				<ConfirmClearHiddenThreadsDialog
					clearing={clearingHiddenThreads}
					onCancel={() => setConfirmClearHiddenThreads(false)}
					onConfirm={restoreAllHiddenThreads}
				/>
			)}
		</div>
	)
}
