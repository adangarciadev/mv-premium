import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import Bold from 'lucide-react/dist/esm/icons/bold'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Gift from 'lucide-react/dist/esm/icons/gift'
import Images from 'lucide-react/dist/esm/icons/images'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import Radio from 'lucide-react/dist/esm/icons/radio'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Search from 'lucide-react/dist/esm/icons/search'
import Settings from 'lucide-react/dist/esm/icons/settings'
import TextQuote from 'lucide-react/dist/esm/icons/text-quote'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { sendMessage, type MvUserSearchUser } from '@/lib/messaging'
import { getSubforumIconId } from '@/lib/subforums'
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
	formatHiddenThreadDate,
	normalizeUsername,
	safeDecodeURIComponent,
	SELF_IGNORE_MESSAGE,
	USER_SUGGESTIONS_DEBOUNCE_MS,
	USER_SUGGESTIONS_MAX,
	USERNAME_VALIDATION_ID,
	type ActiveFilter,
	type FilteredUser,
	type PanelTab,
	type PanelView,
} from './panel-helpers'
import {
	FILTER_ACTIVE_CLASS,
	FILTER_BASE_CLASS,
	FILTER_IDLE_CLASS,
	GROUP_CLASS,
	INPUT_CLASS,
	PRIMARY_BUTTON_CLASS,
	ROW_ICON_ACTIVE_CLASS,
	ROW_ICON_BASE_CLASS,
	ROW_ICON_IDLE_CLASS,
	SECONDARY_BUTTON_CLASS,
	SECTION_LABEL_CLASS,
	SWITCH_THUMB_BASE_CLASS,
	SWITCH_TRACK_BASE_CLASS,
	SWITCH_WRAPPER_CLASS,
	TAB_ACTIVE_CLASS,
	TAB_BASE_CLASS,
	TAB_IDLE_CLASS,
} from './panel-tokens'
import { PanelToast } from './panel-toast'
import { MobileLiteWhatsNewPrompt } from './whats-new-prompt'
import { MobileLiteWhatsNewView } from './whats-new-view'

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
						<>
							{hasUnseenWhatsNew && latestMobileLiteEntry && (
								<MobileLiteWhatsNewPrompt
									entry={latestMobileLiteEntry}
									changeCount={latestMobileLiteChangeCount}
									onOpen={openWhatsNewView}
									onDismiss={() => {
										void markWhatsNewAsSeen()
									}}
								/>
							)}
							<div className="sticky top-0 z-20 -mx-4 bg-[#1c1f27] px-4 pb-2 pt-1">
								<label className="relative block">
									<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707b8e]" aria-hidden="true" />
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
										className={`${INPUT_CLASS} pl-10 pr-3`}
									/>
								</label>

								{/* Filter chips stick together with the search so they stay
								    reachable while scrolling a long user list */}
								{hasAnyFilteredUsers && (
									<div className="mt-2 flex gap-1.5" role="group" aria-label="Filtrar usuarios">
										{filterOptions.map(option => {
											const isActive = activeFilter === option.id

											return (
												<button
													key={option.id}
													type="button"
													className={`${FILTER_BASE_CLASS} flex-1 ${isActive ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS}`}
													aria-pressed={isActive}
													onClick={() => setActiveFilter(option.id)}
												>
													<span className="truncate">{option.label}</span>
													<span className="shrink-0 opacity-80">({option.count})</span>
												</button>
											)
										})}
									</div>
								)}
							</div>

							{usernameValidationMessage && (
								<p id={USERNAME_VALIDATION_ID} className="mt-1 px-1 text-xs text-[#d8b36a]">
									{usernameValidationMessage}
								</p>
							)}

							{(canAddQueryUser || addUserSuggestions.length > 0) && (
								<div className="mt-2 overflow-hidden rounded-2xl border border-dashed border-[#3a4254] bg-[#14171d]">
									<div className="flex items-center gap-2 px-3 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">
										<UserX className="h-3.5 w-3.5" aria-hidden="true" />
										Añadir usuario
									</div>
									<div className="divide-y divide-[#2d3442]">
										{canAddQueryUser && (
											<div className="flex items-center gap-3 py-2 pl-3 pr-2">
												<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#242a36] text-sm font-bold text-[#9aa5b4]">
													{exactQuerySuggestion?.avatarUrl ? (
														<img src={exactQuerySuggestion.avatarUrl} alt="" className="h-full w-full object-cover" />
													) : (
														exactQueryDisplayName.slice(0, 1).toUpperCase()
													)}
												</div>
												<div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{exactQueryDisplayName}</div>
												<div className="flex shrink-0 items-center">
													<button
														type="button"
														aria-label="Silenciar"
														className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
														disabled={savingUser?.toLowerCase() === exactQueryUsername.toLowerCase()}
														onClick={() => addQueryFilter('mute')}
													>
														<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
													</button>
													<button
														type="button"
														aria-label="Ocultar"
														className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
														disabled={savingUser?.toLowerCase() === exactQueryUsername.toLowerCase()}
														onClick={() => addQueryFilter('hide')}
													>
														<EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
													</button>
												</div>
											</div>
										)}
										{addUserSuggestions.map(suggestion => {
											const isSavingSuggestion = savingUser?.toLowerCase() === suggestion.username.toLowerCase()

											return (
												<div key={suggestion.username} className="flex items-center gap-3 py-2 pl-3 pr-2">
													<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#242a36] text-sm font-bold text-[#9aa5b4]">
														{suggestion.avatarUrl ? (
															<img src={suggestion.avatarUrl} alt="" className="h-full w-full object-cover" />
														) : (
															suggestion.username.slice(0, 1).toUpperCase()
														)}
													</div>
													<div className="min-w-0 flex-1 truncate text-[15px] font-semibold">{suggestion.username}</div>
													<div className="flex shrink-0 items-center">
														<button
															type="button"
															aria-label={`Silenciar ${suggestion.username}`}
															className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
															disabled={isSavingSuggestion}
															onClick={() => addSuggestionFilter(suggestion, 'mute')}
														>
															<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
														</button>
														<button
															type="button"
															aria-label={`Ocultar ${suggestion.username}`}
															className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
															disabled={isSavingSuggestion}
															onClick={() => addSuggestionFilter(suggestion, 'hide')}
														>
															<EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
														</button>
													</div>
												</div>
											)
										})}
									</div>
								</div>
							)}

							{hasAnyFilteredUsers && (missingAvatarCount > 0 || refreshingAvatars) && (
								<button
									type="button"
									className="mt-1.5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[#9aa5b4] transition-colors active:bg-[#242a36] disabled:opacity-50"
									disabled={refreshingAvatars}
									onClick={refreshMissingAvatars}
								>
									<RefreshCw className={`h-3.5 w-3.5 ${refreshingAvatars ? 'animate-spin' : ''}`} aria-hidden="true" />
									<span>{refreshingAvatars ? 'Actualizando avatares' : `Actualizar avatares (${missingAvatarCount})`}</span>
								</button>
							)}

							<div className="mt-3">
								{filteredUsers.length === 0 ? (
									<div className="px-6 py-12 text-center">
										<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
											<UserX className="h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
										</div>
										<p className="text-sm font-semibold text-[#eef1f6]">
											{hasAnyFilteredUsers ? 'No hay resultados para este filtro.' : 'No hay usuarios filtrados.'}
										</p>
										{!hasAnyFilteredUsers && (
											<p className="mx-auto mt-1.5 max-w-[20rem] text-xs leading-relaxed text-[#8b95a3]">
												Escribe un nick exacto para silenciarlo u ocultarlo desde este panel.
											</p>
										)}
									</div>
								) : (
									<div className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
										{filteredUsers.map(user => {
											const ignoreType = getIgnoreTypeFromCustomization(user.customization) ?? 'hide'
											const isSaving = savingUser?.toLowerCase() === user.username.toLowerCase()
											const avatarUrl = sanitizeAvatarUrl(user.customization.avatarUrl)

											return (
												<article key={user.username} className="flex items-center gap-3 py-2 pl-3 pr-2">
													<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#14171d] text-sm font-bold text-[#9aa5b4]">
														{avatarUrl ? (
															<img src={avatarUrl} alt="" className="h-full w-full object-cover" />
														) : (
															user.username.slice(0, 1).toUpperCase()
														)}
													</div>
													<div className="min-w-0 flex-1">
														<div className="truncate text-[15px] font-semibold leading-tight">{user.username}</div>
														<div className="mt-0.5 text-xs leading-tight text-[#8b95a3]">{ignoreType === 'mute' ? 'Silenciado' : 'Oculto'}</div>
													</div>
													<div className="flex shrink-0 items-center">
														<button
															type="button"
															aria-label={ignoreType === 'mute' ? 'Silenciado' : 'Silenciar'}
															aria-pressed={ignoreType === 'mute'}
															className={`${ROW_ICON_BASE_CLASS} ${ignoreType === 'mute' ? ROW_ICON_ACTIVE_CLASS : ROW_ICON_IDLE_CLASS}`}
															disabled={isSaving}
															onClick={() => updateFilter(user.username, 'mute')}
														>
															<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
														</button>
														<button
															type="button"
															aria-label={ignoreType === 'hide' ? 'Ocultado' : 'Ocultar'}
															aria-pressed={ignoreType === 'hide'}
															className={`${ROW_ICON_BASE_CLASS} ${ignoreType === 'hide' ? ROW_ICON_ACTIVE_CLASS : ROW_ICON_IDLE_CLASS}`}
															disabled={isSaving}
															onClick={() => updateFilter(user.username, 'hide')}
														>
															<EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
														</button>
														<button
															type="button"
															aria-label="Quitar"
															className={`${ROW_ICON_BASE_CLASS} text-[#e08a8a] active:bg-[#3a2427] active:text-[#f2c2c2]`}
															disabled={isSaving}
															onClick={() => removeUserFilter(user.username)}
														>
															<Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
														</button>
													</div>
												</article>
											)
										})}
									</div>
								)}
							</div>
						</>
					) : activeTab === 'threads' ? (
						<>
							{hiddenThreads.length === 0 ? (
								<div className="px-6 py-12 text-center">
									<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
										<EyeOff className="h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
									</div>
									<p className="text-sm font-semibold text-[#eef1f6]">No hay hilos ocultos.</p>
									<p className="mx-auto mt-1.5 max-w-[20rem] text-xs leading-relaxed text-[#8b95a3]">
										Los hilos que ocultes desde los listados aparecerán aquí.
									</p>
								</div>
							) : (
								<>
									<div className="sticky top-0 z-20 -mx-4 bg-[#1c1f27] px-4 pb-2 pt-1">
										<label className="relative block min-w-0">
											<Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707b8e]" aria-hidden="true" />
											<input
												type="search"
												value={hiddenThreadQuery}
												autoCapitalize="none"
												spellCheck={false}
												onChange={event => setHiddenThreadQuery(event.target.value)}
												placeholder="Buscar hilo o subforo"
												className={`${INPUT_CLASS} pl-10 pr-3`}
											/>
										</label>
									</div>

									<div className="mt-1 flex items-center justify-between gap-3 pl-2">
										<span className="text-xs font-semibold text-[#8b95a3]">
											{hiddenThreads.length === 1 ? '1 hilo oculto' : `${hiddenThreads.length} hilos ocultos`}
										</span>
										<button
											type="button"
											aria-label="Mostrar todos"
											className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-[#f0a020] transition-colors active:bg-[#f0a020]/10 disabled:opacity-50"
											disabled={clearingHiddenThreads}
											onClick={() => setConfirmClearHiddenThreads(true)}
										>
											<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
											<span>Mostrar todos</span>
										</button>
									</div>

									{filteredHiddenThreads.length === 0 ? (
										<div className="px-6 py-12 text-center">
											<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#242a36]">
												<Search className="h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
											</div>
											<p className="text-sm font-semibold text-[#eef1f6]">No hay resultados.</p>
										</div>
									) : (
										<div className={`mt-2 ${GROUP_CLASS} divide-y divide-[#2d3442]`}>
											{filteredHiddenThreads.map(thread => {
												const isRestoring = restoringThread === thread.id
												const subforumSlug = getSubforumSlugFromId(thread.subforumId)
												const subforumIconId = getSubforumIconId(subforumSlug)
												const hiddenAtLabel = formatHiddenThreadDate(thread.hiddenAt)

												return (
													<article key={thread.id} className="flex items-center gap-3 py-2.5 pl-3 pr-2">
														{subforumIconId !== null && (
															<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d]">
																<NativeFidIcon iconId={subforumIconId} className="h-5 w-5 shrink-0" />
															</div>
														)}
														<div className="min-w-0 flex-1">
															<div className="line-clamp-2 text-sm font-semibold leading-snug text-[#eef1f6]">{thread.title}</div>
															<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[#8b95a3]">
																<span className="min-w-0 truncate">{thread.subforum}</span>
																{hiddenAtLabel && (
																	<>
																		<span aria-hidden="true">·</span>
																		<span className="shrink-0 tabular-nums">{hiddenAtLabel}</span>
																	</>
																)}
															</div>
														</div>
														<button
															type="button"
															className={`${ROW_ICON_BASE_CLASS} text-[#f0a020] active:bg-[#f0a020]/15`}
															aria-label="Mostrar"
															title="Mostrar"
															disabled={isRestoring}
															onClick={() => restoreHiddenThread(thread)}
														>
															<RotateCcw className="h-5 w-5" aria-hidden="true" />
														</button>
													</article>
												)
											})}
										</div>
									)}
								</>
							)}
						</>
					) : (
						<div className="pb-1">
							{latestMobileLiteEntry && (
								<>
									<div className={SECTION_LABEL_CLASS}>MVPremium</div>
									<section className={GROUP_CLASS}>
										<button
											type="button"
											className="flex min-h-[60px] w-full items-center gap-3 py-2 pl-4 pr-2 text-left transition-colors active:bg-[#2e3543]"
											onClick={openWhatsNewView}
										>
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14171d] text-[#f0a020]">
												<Gift className="h-5 w-5" aria-hidden="true" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex min-w-0 items-center gap-2">
													<div className="truncate text-[15px] font-semibold text-[#eef1f6]">Novedades</div>
													{hasUnseenWhatsNew && (
														<span
															aria-hidden="true"
															className="inline-flex shrink-0 items-center rounded-full bg-[#f0a020] px-2 py-0.5 text-[10px] font-black leading-none text-[#221604]"
														>
															NEW
														</span>
													)}
												</div>
												<div className="mt-0.5 truncate text-xs text-[#8b95a3]">
													v{latestMobileLiteEntry.version} - {latestMobileLiteChangeCount} cambios
												</div>
											</div>
											<ChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#707b8e]" aria-hidden="true" />
										</button>
									</section>
								</>
							)}
							<div className={SECTION_LABEL_CLASS}>Imágenes</div>
							<div className={GROUP_CLASS}>
								<div className="p-4">
									<div className="flex items-start gap-3">
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0a020]/[0.16] text-[#f0a020]">
											<KeyRound className="h-5 w-5" aria-hidden="true" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<div className="text-[15px] font-semibold">ImgBB</div>
												<span
													className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
														isImgbbConfigured ? 'bg-[#274532] text-[#bdf2c7]' : 'bg-[#3b3526] text-[#e7c77f]'
													}`}
												>
													{isImgbbConfigured && <Check className="h-3 w-3" aria-hidden="true" />}
													{isImgbbConfigured ? 'ImgBB activo' : 'Freeimage gratis'}
												</span>
											</div>
											<p className="mt-1 text-xs leading-relaxed text-[#9aa5b4]">
												{isImgbbConfigured
													? 'Tus subidas de imágenes usarán ImgBB con tu API key.'
													: 'Sin API key se usará Freeimage, el servicio gratuito por defecto.'}
											</p>
										</div>
									</div>

									<label className="mt-4 block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]" htmlFor="mvp-mobile-lite-imgbb-key">
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
										className={`${INPUT_CLASS} mt-2 px-3 font-mono`}
									/>

									{/* No "Pegar" button on purpose: clipboard reads on Android always
									    trigger the browser's paste-authorization bubble and there is no
									    API to know beforehand whether the clipboard has content. The
									    native long-press paste on the input avoids both problems. */}
									<button
										type="button"
										aria-label="Guardar API key de ImgBB"
										className={`${PRIMARY_BUTTON_CLASS} mt-3 w-full`}
										disabled={savingImgbbApiKey || !isImgbbDirty}
										onClick={saveImgbbApiKey}
									>
										<Check className="h-4 w-4" aria-hidden="true" />
										{savingImgbbApiKey ? 'Guardando' : 'Guardar'}
									</button>
								</div>

								<a
									href="https://api.imgbb.com/"
									target="_blank"
									rel="noopener noreferrer"
									className="flex h-12 items-center justify-between gap-2 border-t border-[#2d3442] px-4 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#2e3543]"
								>
									<span>Obtener API key</span>
									<ExternalLink className="h-4 w-4 shrink-0 text-[#707b8e]" aria-hidden="true" />
								</a>
							</div>

							<div className={SECTION_LABEL_CLASS}>Apariencia</div>

							<section className={GROUP_CLASS}>
								<div className="flex min-h-[60px] items-center gap-3 py-2 pl-4 pr-2">
									<span
										className="h-7 w-7 shrink-0 rounded-lg border border-[#3a4254]"
										style={{ backgroundColor: normalizedBoldColorDraft }}
										aria-hidden="true"
									/>
									<div className="min-w-0 flex-1">
										<div className="truncate text-[15px] font-semibold text-[#eef1f6]">Color de negrita</div>
										<div className="mt-0.5 truncate text-xs text-[#8b95a3]">
											{boldColorEnabled ? 'Activo en Mediavida' : 'Se usa el color nativo'}
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Color personalizado"
										aria-checked={boldColorEnabled}
										className={SWITCH_WRAPPER_CLASS}
										disabled={savingBoldColor}
										onClick={toggleBoldColor}
									>
										<span className={`${SWITCH_TRACK_BASE_CLASS} ${boldColorEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
											<span className={`${SWITCH_THUMB_BASE_CLASS} ${boldColorEnabled ? 'translate-x-5' : ''}`} />
										</span>
									</button>
									<button
										type="button"
										aria-expanded={boldColorExpanded}
										aria-label={boldColorExpanded ? 'Ocultar ajustes de color' : 'Editar color de negrita'}
										className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8b95a3] transition-colors active:bg-[#2e3543]"
										onClick={() => setBoldColorExpanded(value => !value)}
									>
										<ChevronDown
											className={`h-5 w-5 transition-transform ${boldColorExpanded ? 'rotate-180' : ''}`}
											aria-hidden="true"
										/>
									</button>
								</div>

								{boldColorExpanded && (
									<div className="border-t border-[#2d3442] bg-[#1c1f27] p-4">
										<label className="block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]" htmlFor="mvp-mobile-lite-bold-color">
											Color
										</label>
										<div className="mt-2 grid grid-cols-[56px_minmax(0,1fr)] gap-2">
											<input
												id="mvp-mobile-lite-bold-color"
												type="color"
												value={normalizedBoldColorDraft}
												disabled={savingBoldColor}
												onChange={event => {
													setBoldColorDraft(event.target.value)
													setBoldColorStatusMessage(null)
													setBoldColorErrorMessage(null)
												}}
												className="h-11 w-full rounded-xl border border-transparent bg-[#14171d] p-1.5"
											/>
											<input
												type="text"
												value={boldColorDraft}
												autoCapitalize="none"
												autoCorrect="off"
												spellCheck={false}
												disabled={savingBoldColor}
												onChange={event => {
													setBoldColorDraft(event.target.value)
													setBoldColorStatusMessage(null)
													setBoldColorErrorMessage(null)
												}}
												className={`${INPUT_CLASS} px-3 font-mono`}
											/>
										</div>

										<div className="mt-3 rounded-xl bg-[#14171d] px-3 py-3 text-sm leading-relaxed text-[#cfd5db]">
											Texto normal y{' '}
											<strong style={{ color: boldColorEnabled ? normalizedBoldColorDraft : 'inherit' }}>
												texto en negrita
											</strong>
										</div>

										<div className="mt-3 grid grid-cols-2 gap-2">
											<button
												type="button"
												className={SECONDARY_BUTTON_CLASS}
												disabled={savingBoldColor || (boldColor === DEFAULT_BOLD_COLOR && normalizedBoldColorDraft === DEFAULT_BOLD_COLOR)}
												onClick={resetBoldColor}
											>
												<RotateCcw className="h-4 w-4" aria-hidden="true" />
												Restaurar
											</button>
											<button
												type="button"
												aria-label="Guardar color de negrita"
												className={PRIMARY_BUTTON_CLASS}
												disabled={savingBoldColor || !isBoldColorDirty}
												onClick={saveBoldColor}
											>
												<Bold className="h-4 w-4" aria-hidden="true" />
												{savingBoldColor ? 'Guardando' : 'Guardar'}
											</button>
										</div>
									</div>
								)}
							</section>

							<div className={SECTION_LABEL_CLASS}>Hilos</div>

							<section className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
								<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
											<Radio className="h-4 w-4" aria-hidden="true" />
										</div>
										<div className="min-w-0">
											<div className="text-[15px] font-semibold text-[#eef1f6]">Modo Live</div>
											<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
												{liveThreadEnabled ? 'Muestra el botón Live en los hilos' : 'No muestra el botón Live'}
											</div>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Modo Live"
										aria-checked={liveThreadEnabled}
										className={SWITCH_WRAPPER_CLASS}
										disabled={savingMobileLiteSetting === 'liveThreadEnabled'}
										onClick={toggleLiveThreadSetting}
									>
										<span className={`${SWITCH_TRACK_BASE_CLASS} ${liveThreadEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
											<span className={`${SWITCH_THUMB_BASE_CLASS} ${liveThreadEnabled ? 'translate-x-5' : ''}`} />
										</span>
									</button>
								</div>

								<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
											<Images className="h-4 w-4" aria-hidden="true" />
										</div>
										<div className="min-w-0">
											<div className="text-[15px] font-semibold text-[#eef1f6]">Botón galería</div>
											<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
												{galleryButtonEnabled ? 'Muestra el botón Galería en los hilos' : 'No muestra el botón Galería'}
											</div>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Botón galería"
										aria-checked={galleryButtonEnabled}
										className={SWITCH_WRAPPER_CLASS}
										disabled={savingMobileLiteSetting === 'galleryButtonEnabled'}
										onClick={toggleGalleryButtonSetting}
									>
										<span className={`${SWITCH_TRACK_BASE_CLASS} ${galleryButtonEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
											<span className={`${SWITCH_THUMB_BASE_CLASS} ${galleryButtonEnabled ? 'translate-x-5' : ''}`} />
										</span>
									</button>
								</div>

								<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
											<TextQuote className="h-4 w-4" aria-hidden="true" />
										</div>
										<div className="min-w-0">
											<div className="text-[15px] font-semibold text-[#eef1f6]">Citar selección</div>
											<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
												{quoteSelectionEnabled
													? 'Recoloca el botón citar bajo la selección'
													: 'Usa el botón citar nativo (lo tapa el menú de Android)'}
											</div>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Citar selección"
										aria-checked={quoteSelectionEnabled}
										className={SWITCH_WRAPPER_CLASS}
										disabled={savingMobileLiteSetting === 'quoteSelectionEnabled'}
										onClick={toggleQuoteSelectionSetting}
									>
										<span className={`${SWITCH_TRACK_BASE_CLASS} ${quoteSelectionEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
											<span className={`${SWITCH_THUMB_BASE_CLASS} ${quoteSelectionEnabled ? 'translate-x-5' : ''}`} />
										</span>
									</button>
								</div>

								<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
											<EyeOff className="h-4 w-4" aria-hidden="true" />
										</div>
										<div className="min-w-0">
											<div className="text-[15px] font-semibold text-[#eef1f6]">Botón ocultar hilos</div>
											<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
												{hideThreadButtonEnabled ? 'Muestra el botón en los listados' : 'Oculta el botón de los listados'}
											</div>
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Botón ocultar hilos"
										aria-checked={hideThreadButtonEnabled}
										className={SWITCH_WRAPPER_CLASS}
										disabled={savingMobileLiteSetting === 'hideThreadEnabled'}
										onClick={toggleHideThreadButtonSetting}
									>
										<span className={`${SWITCH_TRACK_BASE_CLASS} ${hideThreadButtonEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
											<span className={`${SWITCH_THUMB_BASE_CLASS} ${hideThreadButtonEnabled ? 'translate-x-5' : ''}`} />
										</span>
									</button>
								</div>
							</section>
						</div>
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
				<div className="absolute inset-0 z-30 flex items-end justify-center bg-black/60 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] animate-in fade-in-0 duration-150">
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
						className="relative w-full max-w-[32rem] rounded-3xl bg-[#242a36] p-5 text-sm text-[#e5e8eb] shadow-[0_12px_48px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 duration-200"
					>
						<p id="mvp-mobile-lite-clear-hidden-threads-title" className="text-base font-bold text-[#f2f4f7]">
							Se mostrarán todos los hilos ocultos.
						</p>
						<p id="mvp-mobile-lite-clear-hidden-threads-description" className="mt-1 text-sm leading-relaxed text-[#9aa5b4]">
							Esto vaciará tu lista de hilos ocultos en este dispositivo.
						</p>
						<div className="mt-5 grid grid-cols-2 gap-2">
							<button
								type="button"
								className={SECONDARY_BUTTON_CLASS}
								onClick={() => setConfirmClearHiddenThreads(false)}
							>
								Cancelar
							</button>
							<button
								type="button"
								className={PRIMARY_BUTTON_CLASS}
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
