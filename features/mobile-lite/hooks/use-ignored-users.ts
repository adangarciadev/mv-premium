import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { sendMessage, type MvUserSearchUser } from '@/lib/messaging'
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
	getEmptyData,
	getFilteredUsers,
	getUsernameValidationMessage,
	normalizeUsername,
	safeDecodeURIComponent,
	SELF_IGNORE_MESSAGE,
	USER_SUGGESTIONS_DEBOUNCE_MS,
	USER_SUGGESTIONS_MAX,
	type ActiveFilter,
	type FilteredUser,
	type PanelTab,
	type UserFilterOption,
} from '../components/panel-helpers'
import { useAutoDismiss } from './use-auto-dismiss'

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

/**
 * Ignored-users management: the customizations data, search/filter state, the
 * add/mute/hide/remove flows (all optimistic) and opportunistic avatar
 * hydration. Suggestions are fetched (debounced) only while the users tab is
 * active.
 */
export function useIgnoredUsers({
	open,
	activeTab,
	panelBodyRef,
}: {
	open: boolean
	activeTab: PanelTab
	panelBodyRef: RefObject<HTMLDivElement | null>
}) {
	const [data, setData] = useState<UserCustomizationsData>(getEmptyData)
	const [query, setQuery] = useState('')
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
	const [savingUser, setSavingUser] = useState<string | null>(null)
	const [userSuggestions, setUserSuggestions] = useState<MvUserSearchUser[]>([])
	const [refreshingAvatars, setRefreshingAvatars] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const avatarHydrationInFlight = useRef<Set<string>>(new Set())

	useAutoDismiss(statusMessage, setStatusMessage)

	useEffect(() => {
		let mounted = true

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

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	useEffect(() => {
		if (!open) return

		let mounted = true
		getUserCustomizations()
			.then(nextData => {
				if (mounted) setData(nextData)
			})
			.catch(() => {
				if (mounted) setData(getEmptyData())
			})

		return () => {
			mounted = false
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
	] satisfies UserFilterOption[]
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
	// Placeholder URLs (lazy-load pixels) count as missing so the refresh button
	// can replace them with the real avatar.
	const missingAvatarCount = allFilteredUsers.filter(user => !sanitizeAvatarUrl(user.customization.avatarUrl)).length

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

	const handleQueryChange = (value: string) => {
		setQuery(value)
		setStatusMessage(null)
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

	return {
		query,
		handleQueryChange,
		activeFilter,
		setActiveFilter,
		usernameValidationMessage,
		hasAnyFilteredUsers,
		filterOptions,
		allFilteredUsers,
		canAddQueryUser,
		addUserSuggestions,
		exactQuerySuggestion,
		exactQueryDisplayName,
		exactQueryUsername,
		savingUser,
		missingAvatarCount,
		refreshingAvatars,
		filteredUsers,
		statusMessage,
		errorMessage,
		refreshMissingAvatars,
		updateFilter,
		removeUserFilter,
		addQueryFilter,
		addSuggestionFilter,
	}
}
