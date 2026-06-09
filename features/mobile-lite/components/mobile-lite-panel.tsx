import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Bold from 'lucide-react/dist/esm/icons/bold'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Clipboard from 'lucide-react/dist/esm/icons/clipboard'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import Palette from 'lucide-react/dist/esm/icons/palette'
import Radio from 'lucide-react/dist/esm/icons/radio'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import Search from 'lucide-react/dist/esm/icons/search'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { sendMessage } from '@/lib/messaging'
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
import {
	getMobileLiteBoldColorSettings,
	normalizeMobileLiteBoldColor,
	saveMobileLiteBoldColorSettings,
} from '../logic/bold-color'
import { applyMobileLiteHiddenThreads } from '../logic/hidden-threads'
import { getMobileLiteImgbbApiKey, saveMobileLiteImgbbApiKey } from '../logic/imgbb-api-key-storage'
import { syncMobileLiteLiveThreadButton } from '../logic/live-thread'

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
const DEFAULT_BOLD_COLOR = '#ffffff'
/**
 * Calm token palette: one neutral surface ramp + a single amber accent (#f0a020),
 * applied sparingly (active tab, primary action, active toggle) instead of the
 * previous stacked yellow/gray noise. Literal hex is used throughout so Tailwind's
 * JIT reliably generates each class. These constants are the single source of truth.
 *
 *   base #1c1f27 · raised #363d4d · input #14171d · hover #464e62 · border #4b5468
 *   text #eef1f6 · muted #aab4c0 · accent #f0a020
 */
// Segmented control (pill). Idle = transparent/muted, active = raised pill + accent text.
const TAB_BASE_CLASS =
	'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[7px] px-2 text-[13px] font-semibold transition-colors'
const TAB_ACTIVE_CLASS = 'bg-[#363d4d] text-[#f0a020] shadow-[0_1px_2px_rgba(0,0,0,0.25)]'
const TAB_IDLE_CLASS = 'bg-transparent text-[#aab4c0] active:bg-[#464e62]'
// Filter chips: compact, low-noise.
const FILTER_BASE_CLASS =
	'inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors'
const FILTER_ACTIVE_CLASS = 'border-[#f0a020]/[0.5] bg-[#f0a020]/[0.18] text-[#f0a020]'
const FILTER_IDLE_CLASS = 'border-[#4b5468] bg-transparent text-[#aab4c0]'
// Row actions: neutral by default, subtle accent tint when active (not full yellow fill).
const ACTION_BUTTON_BASE_CLASS =
	'inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 text-[13px] font-semibold transition-colors disabled:opacity-60'
const ACTION_IDLE_CLASS = 'border-[#4b5468] bg-[#363d4d] text-[#eef1f6] active:bg-[#464e62]'
const ACTION_MUTE_ACTIVE_CLASS = 'border-[#f0a020]/[0.5] bg-[#f0a020]/[0.18] text-[#f0a020]'
const ACTION_HIDE_ACTIVE_CLASS = 'border-[#f0a020]/[0.5] bg-[#f0a020]/[0.18] text-[#f0a020]'
const STATUS_SUCCESS_CLASS =
	'rounded-xl border border-[#3e6e54] bg-gradient-to-br from-[#23402f] to-[#1b3325] px-3.5 py-2.5 text-sm font-medium text-[#caf0d6] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_5px_rgba(0,0,0,0.35)]'
const STATUS_ERROR_CLASS =
	'rounded-xl border border-[#7c3c43] bg-gradient-to-br from-[#3a2227] to-[#2b1a1d] px-3.5 py-2.5 text-sm font-medium text-[#f4c6c6] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_5px_rgba(0,0,0,0.35)]'

interface FilteredUser {
	username: string
	customization: UserCustomization
}

type ActiveFilter = 'all' | MobileLiteIgnoreType
type PanelTab = 'users' | 'threads' | 'settings'

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
	const [boldColor, setBoldColor] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorDraft, setBoldColorDraft] = useState(DEFAULT_BOLD_COLOR)
	const [boldColorEnabled, setBoldColorEnabled] = useState(false)
	const [boldColorExpanded, setBoldColorExpanded] = useState(false)
	const [liveThreadEnabled, setLiveThreadEnabled] = useState(false)
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
	const [savingMobileLiteSetting, setSavingMobileLiteSetting] = useState<'liveThreadEnabled' | 'hideThreadEnabled' | null>(null)
	const [mobileLiteSettingsStatusMessage, setMobileLiteSettingsStatusMessage] = useState<string | null>(null)
	const [mobileLiteSettingsErrorMessage, setMobileLiteSettingsErrorMessage] = useState<string | null>(null)
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
	const missingAvatarCount = allFilteredUsers.filter(user => !user.customization.avatarUrl).length
	const isImgbbConfigured = Boolean(imgbbApiKey.trim())
	const isImgbbDirty = imgbbApiKeyDraft.trim() !== imgbbApiKey
	const normalizedBoldColorDraft = normalizeMobileLiteBoldColor(boldColorDraft)
	const isBoldColorDirty = normalizedBoldColorDraft !== boldColor
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

	return (
		<div className="fixed inset-0 z-[99999] flex h-[100dvh] items-end justify-center overflow-hidden overscroll-none bg-black/60 animate-in fade-in-0 duration-200">
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			<section className="relative flex h-[88%] w-full max-w-[34rem] flex-col overflow-hidden rounded-t-[20px] border-x border-t border-[#4b5468] bg-[#1c1f27] text-[#eef1f6] shadow-[0_-10px_40px_rgba(0,0,0,0.55)] animate-in slide-in-from-bottom-8 duration-300 ease-out">
				<header className="shrink-0 bg-[#1c1f27] pt-[max(8px,env(safe-area-inset-top))]">
					{/* Grab handle */}
					<div className="flex justify-center pb-1 pt-1.5">
						<span className="h-1 w-9 rounded-full bg-[#4a5160]" aria-hidden="true" />
					</div>
					<div className="flex items-center justify-between px-3 pb-3 pt-1">
						<div className="flex min-w-0 items-center gap-2.5">
							<img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" aria-hidden="true" />
							<div className="flex min-w-0 flex-col">
								<h2 className="truncate text-[15px] font-black uppercase leading-none tracking-tight">
									MV<span className="text-[#f0a020]">PREMIUM</span>
								</h2>
								<span className="mt-1 text-[9px] font-bold uppercase leading-none tracking-[0.22em] text-[#8b95a3]">Dashboard</span>
							</div>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#aab4c0] transition-colors active:bg-[#464e62]"
							aria-label="Cerrar"
							onClick={() => setOpen(false)}
						>
							<X className="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				</header>

				<div ref={panelBodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#1c1f27] px-3 pb-[max(16px,calc(env(safe-area-inset-bottom)_+_16px))]">
					<div className="sticky top-0 z-20 -mx-3 mb-3 bg-[#1c1f27] px-3 pb-2 pt-3">
						<div className="flex gap-1 rounded-[10px] border border-[#4b5468] bg-[#14171d] p-1" role="tablist" aria-label="Secciones del panel MVPremium">
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
										activeTab === 'threads' ? 'bg-[#f0a020]/[0.18] text-[#f0a020]' : 'bg-[#464e62] text-[#aab4c0]'
									}`}
								>
									{hiddenThreads.length}
								</span>
							)}
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'settings'}
							className={`${TAB_BASE_CLASS} ${activeTab === 'settings' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => setActiveTab('settings')}
						>
							<Settings className="h-4 w-4" aria-hidden="true" />
							Ajustes
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
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95a3]" aria-hidden="true" />
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
									className="h-11 w-full rounded-md border border-[#4b5468] bg-[#14171d] pl-10 pr-3 text-base text-[#eef1f3] outline-none placeholder:text-[#8b95a3] focus:border-[#f0a020] focus:shadow-[0_0_0_1px_rgba(240,160,32,0.35)]"
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
												<span className="ml-1 shrink-0 rounded bg-black/25 px-1.5 py-0.5 text-[11px] leading-none">
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
									className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-[#4b5468] bg-[#363d4d] px-3 text-[13px] font-semibold text-[#aab4c0] transition-colors active:bg-[#464e62] disabled:opacity-60"
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
								<div className="mt-3 rounded-lg border border-dashed border-[#4a5160] bg-[#14171d] p-3">
									<div className="flex items-center gap-2 text-sm font-medium">
										<UserX className="h-4 w-4 text-[#aab4c0]" aria-hidden="true" />
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
									<div className="rounded-lg border border-[#4b5468] bg-[#363d4d] px-4 py-7 text-center text-sm text-[#aab4c0]">
										<UserX className="mx-auto mb-3 h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
										<p className="font-semibold text-[#eef1f6]">
											{hasAnyFilteredUsers ? 'No hay resultados para este filtro.' : 'No hay usuarios filtrados.'}
										</p>
										{!hasAnyFilteredUsers && (
											<p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-[#8b95a3]">
												Escribe un nick exacto para silenciarlo u ocultarlo desde este panel.
											</p>
										)}
									</div>
								) : (
									filteredUsers.map(user => {
										const ignoreType = getIgnoreTypeFromCustomization(user.customization) ?? 'hide'
										const isSaving = savingUser?.toLowerCase() === user.username.toLowerCase()

										return (
											<article key={user.username} className="flex items-center gap-2.5 rounded-xl border border-[#535f80] bg-gradient-to-br from-[#3c4559] to-[#323b4d] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_5px_rgba(0,0,0,0.35)]">
												<div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#14171d] text-sm font-bold">
													{user.customization.avatarUrl ? (
														<img src={user.customization.avatarUrl} alt="" className="h-full w-full object-cover" />
													) : (
														user.username.slice(0, 1).toUpperCase()
													)}
												</div>
												<div className="min-w-0 flex-1">
													<div className="truncate text-sm font-semibold leading-tight">{user.username}</div>
													<div className="text-[11px] leading-tight text-[#8b95a3]">{ignoreType === 'mute' ? 'Silenciado' : 'Oculto'}</div>
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<button
														type="button"
														aria-label={ignoreType === 'mute' ? 'Silenciado' : 'Silenciar'}
														aria-pressed={ignoreType === 'mute'}
														className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
															ignoreType === 'mute'
																? 'border-[#f0a020]/[0.5] bg-[#f0a020]/[0.18] text-[#f0a020]'
																: 'border-[#4b5468] bg-[#1c1f27] text-[#aab4c0] active:bg-[#464e62]'
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'mute')}
													>
														<VolumeX className="h-4 w-4" aria-hidden="true" />
													</button>
													<button
														type="button"
														aria-label={ignoreType === 'hide' ? 'Ocultado' : 'Ocultar'}
														aria-pressed={ignoreType === 'hide'}
														className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-60 ${
															ignoreType === 'hide'
																? 'border-[#f0a020]/[0.5] bg-[#f0a020]/[0.18] text-[#f0a020]'
																: 'border-[#4b5468] bg-[#1c1f27] text-[#aab4c0] active:bg-[#464e62]'
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'hide')}
													>
														<EyeOff className="h-4 w-4" aria-hidden="true" />
													</button>
													<button
														type="button"
														aria-label="Quitar"
														className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#5a3236]/70 bg-[#2c1d1f] text-[#e08a8a] transition-colors active:bg-[#3a2427] active:text-[#f2c2c2] disabled:opacity-60"
														disabled={isSaving}
														onClick={() => removeUserFilter(user.username)}
													>
														<Trash2 className="h-4 w-4" aria-hidden="true" />
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
								<div className="rounded-lg border border-[#4b5468] bg-[#363d4d] px-4 py-7 text-center text-sm text-[#aab4c0]">
									<EyeOff className="mx-auto mb-3 h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
									<p className="font-semibold text-[#eef1f6]">No hay hilos ocultos.</p>
									<p className="mx-auto mt-1 max-w-[22rem] text-xs leading-relaxed text-[#8b95a3]">
										Los hilos que ocultes desde los listados aparecerán aquí.
									</p>
								</div>
							) : (
								<>
									<div className="sticky top-[64px] z-10 -mx-3 space-y-2 bg-[#1c1f27] px-3 pb-2 pt-1">
										<label className="relative block min-w-0">
											<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b95a3]" aria-hidden="true" />
											<input
												type="search"
												value={hiddenThreadQuery}
												autoCapitalize="none"
												spellCheck={false}
												onChange={event => setHiddenThreadQuery(event.target.value)}
												placeholder="Buscar hilo o subforo"
												className="h-11 w-full rounded-md border border-[#4b5468] bg-[#14171d] pl-10 pr-3 text-sm text-[#eef1f3] outline-none placeholder:text-[#8b95a3] focus:border-[#f0a020] focus:shadow-[0_0_0_1px_rgba(240,160,32,0.35)]"
											/>
										</label>
										<button
											type="button"
											aria-label="Mostrar todos"
											className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#4b5468] bg-[#363d4d] px-3 text-[13px] font-semibold text-[#f0a020] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.3)] transition-colors active:bg-[#3c4559] disabled:opacity-60"
											disabled={clearingHiddenThreads}
											onClick={() => setConfirmClearHiddenThreads(true)}
										>
											<RotateCcw className="h-4 w-4" aria-hidden="true" />
											<span>Mostrar todos los hilos</span>
										</button>
									</div>

									{filteredHiddenThreads.length === 0 ? (
										<div className="rounded-lg border border-[#4b5468] bg-[#363d4d] px-4 py-7 text-center text-sm text-[#aab4c0]">
											<EyeOff className="mx-auto mb-3 h-5 w-5 text-[#8b95a3]" aria-hidden="true" />
											<p className="font-semibold text-[#eef1f6]">No hay resultados.</p>
										</div>
									) : (
										<div className="space-y-2.5">
											{filteredHiddenThreads.map(thread => {
												const isRestoring = restoringThread === thread.id
												const subforumSlug = getSubforumSlugFromId(thread.subforumId)
												const subforumIconId = getSubforumIconId(subforumSlug)
												const hiddenAtLabel = formatHiddenThreadDate(thread.hiddenAt)

												return (
													<article key={thread.id} className="grid grid-cols-[minmax(0,1fr)_48px] overflow-hidden rounded-xl border border-[#535f80] bg-gradient-to-br from-[#3c4559] to-[#323b4d] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_5px_rgba(0,0,0,0.35)]">
														<div className="min-w-0 px-3 py-2.5">
															<div className="flex min-w-0 items-start gap-2.5">
																{subforumIconId !== null && (
																	<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#4a5269] bg-[#232834]">
																		<NativeFidIcon iconId={subforumIconId} className="h-5 w-5 shrink-0" />
																	</div>
																)}
																<div className="min-w-0 flex-1">
																	<div className="line-clamp-2 text-sm font-semibold leading-snug text-[#eef1f6]">{thread.title}</div>
																	<div className="mt-0.5 flex min-w-0 items-center justify-between gap-3 text-[11px] font-semibold text-[#aab4c0]">
																		<span className="min-w-0 truncate">{thread.subforum}</span>
																		{hiddenAtLabel && <span className="shrink-0 tabular-nums font-medium text-[#8b95a3]">{hiddenAtLabel}</span>}
																	</div>
																</div>
															</div>
														</div>
														<div className="flex items-center justify-center pl-1 pr-2">
															<button
																type="button"
																className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#f0a020] transition-colors active:bg-[#f0a020]/15 disabled:opacity-60"
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
							<div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b95a3]">Imágenes</div>
							<div className="rounded-xl border border-[#535f80] bg-gradient-to-br from-[#3c4559] to-[#323b4d] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_5px_rgba(0,0,0,0.35)]">
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f0a020]/15 text-[#f0a020]">
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
										<p className="mt-1 text-sm text-[#aab4c0]">
											{isImgbbConfigured
												? 'Tus subidas de imágenes usarán ImgBB con tu API key.'
												: 'Sin API key se usará Freeimage, el servicio gratuito por defecto.'}
										</p>
									</div>
								</div>

								<label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#8b95a3]" htmlFor="mvp-mobile-lite-imgbb-key">
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
									className="mt-2 h-11 w-full rounded-md border border-[#4b5468] bg-[#14171d] px-3 font-mono text-sm text-[#eef1f3] outline-none placeholder:text-[#8b95a3] focus:border-[#f0a020] focus:shadow-[0_0_0_1px_rgba(240,160,32,0.35)]"
								/>

								<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(116px,1fr))] gap-2">
									<button
										type="button"
										className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#4a5160] bg-[#464e62] px-2 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#343b45]"
										onClick={pasteImgbbApiKey}
									>
										<Clipboard className="h-4 w-4" aria-hidden="true" />
										Pegar
									</button>
									<button
										type="button"
										aria-label="Guardar API key de ImgBB"
										className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#d06d00] bg-[#8a5b00] px-2 text-sm font-semibold text-white transition-colors disabled:border-[#4b5468] disabled:bg-[#363d4d] disabled:text-[#8b95a3]"
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
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#4b5468] bg-[#363d4d] px-3 text-sm font-semibold text-[#eef1f3] transition-colors active:bg-[#3d4651]"
							>
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
								Obtener API key
							</a>

							<div className="mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b95a3]">Apariencia</div>

							<section className="overflow-hidden rounded-xl border border-[#535f80] bg-gradient-to-br from-[#3c4559] to-[#323b4d] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_5px_rgba(0,0,0,0.35)]">
								<div
									className={`grid min-h-[68px] grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-3 ${
										boldColorEnabled ? 'bg-transparent' : 'bg-transparent'
									}`}
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#4a5160] bg-[#14171d]">
										<span
											className="h-6 w-6 rounded border border-[#4a5160] shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
											style={{ backgroundColor: normalizedBoldColorDraft }}
											aria-hidden="true"
										/>
									</div>
									<div className="min-w-0">
										<div className="flex min-w-0 items-center gap-2">
											<Palette className="h-4 w-4 shrink-0 text-[#f0a020]" aria-hidden="true" />
											<div className="truncate text-sm font-semibold text-[#eef1f3]">Color de negrita</div>
										</div>
										<div className="mt-0.5 truncate text-xs text-[#8b95a3]">
											{boldColorEnabled ? 'Activo en Mediavida' : 'Se usa el color nativo'}
										</div>
									</div>
									<button
										type="button"
										role="switch"
										aria-label="Color personalizado"
										aria-checked={boldColorEnabled}
										className={`relative h-11 w-16 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
											boldColorEnabled ? 'border-[#f0a020] bg-[#f0a020]' : 'border-[#4a5160] bg-[#464e62]'
										}`}
										disabled={savingBoldColor}
										onClick={toggleBoldColor}
									>
										<span
											className={`pointer-events-none absolute left-2 top-2 h-7 w-7 rounded-full bg-white shadow transition-transform ${
												boldColorEnabled ? 'translate-x-5' : 'translate-x-0'
											}`}
										/>
									</button>
									<button
										type="button"
										aria-expanded={boldColorExpanded}
										aria-label={boldColorExpanded ? 'Ocultar ajustes de color' : 'Editar color de negrita'}
										className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#4a5160] bg-[#464e62] text-[#eef1f6] transition-colors active:bg-[#343b45]"
										onClick={() => setBoldColorExpanded(value => !value)}
									>
										<ChevronDown
											className={`h-4 w-4 transition-transform ${boldColorExpanded ? 'rotate-180' : ''}`}
											aria-hidden="true"
										/>
									</button>
								</div>

								{boldColorExpanded && (
									<div className="border-t border-[#4b5468] bg-[#1c1f27] p-3">
										<label className="block text-xs font-semibold uppercase tracking-wide text-[#8b95a3]" htmlFor="mvp-mobile-lite-bold-color">
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
												className="h-11 w-full rounded-md border border-[#4a5160] bg-[#14171d] p-1"
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
												className="h-11 w-full rounded-md border border-[#4a5160] bg-[#14171d] px-3 font-mono text-sm text-[#eef1f6] outline-none placeholder:text-[#8b95a3] focus:border-[#f0a020] focus:shadow-[0_0_0_1px_rgba(240,160,32,0.35)]"
											/>
										</div>

										<div className="mt-3 rounded-md border border-[#4b5468] bg-[#14171d] px-3 py-3 text-sm leading-relaxed text-[#cfd5db]">
											Texto normal y{' '}
											<strong style={{ color: boldColorEnabled ? normalizedBoldColorDraft : 'inherit' }}>
												texto en negrita
											</strong>
										</div>

										<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(116px,1fr))] gap-2">
											<button
												type="button"
												className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#4a5160] bg-[#464e62] px-2 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#343b45] disabled:border-[#4b5468] disabled:bg-[#363d4d] disabled:text-[#8b95a3]"
												disabled={savingBoldColor || (boldColor === DEFAULT_BOLD_COLOR && normalizedBoldColorDraft === DEFAULT_BOLD_COLOR)}
												onClick={resetBoldColor}
											>
												<RotateCcw className="h-4 w-4" aria-hidden="true" />
												Restaurar
											</button>
											<button
												type="button"
												aria-label="Guardar color de negrita"
												className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#f0a020] bg-[#8a5b00] px-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors active:bg-[#9c6900] disabled:border-[#4b5468] disabled:bg-[#454d59] disabled:text-[#8b95a3] disabled:shadow-none"
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

							<div className="mt-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#8b95a3]">Hilos</div>

							<section className="overflow-hidden rounded-xl border border-[#535f80] bg-gradient-to-br from-[#3c4559] to-[#323b4d] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_2px_5px_rgba(0,0,0,0.35)]">
								<div
									className={`flex min-h-[68px] items-center justify-between gap-3 px-3 py-3 ${
										liveThreadEnabled ? 'bg-transparent' : 'bg-transparent'
									}`}
								>
									<div className="flex min-w-0 items-start gap-3">
										<Radio className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a020]" aria-hidden="true" />
										<div className="min-w-0">
											<div className="text-sm font-semibold text-[#eef1f3]">Modo Live</div>
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
										className={`relative h-11 w-16 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
											liveThreadEnabled ? 'border-[#f0a020] bg-[#f0a020]' : 'border-[#4a5160] bg-[#464e62]'
										}`}
										disabled={savingMobileLiteSetting === 'liveThreadEnabled'}
										onClick={toggleLiveThreadSetting}
									>
										<span
											className={`pointer-events-none absolute left-2 top-2 h-7 w-7 rounded-full bg-white shadow transition-transform ${
												liveThreadEnabled ? 'translate-x-5' : 'translate-x-0'
											}`}
										/>
									</button>
								</div>

								<div
									className={`flex min-h-[68px] items-center justify-between gap-3 border-t border-[#4b5468] px-3 py-3 ${
										hideThreadButtonEnabled ? 'bg-transparent' : 'bg-transparent'
									}`}
								>
									<div className="flex min-w-0 items-start gap-3">
										<EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-[#f0a020]" aria-hidden="true" />
										<div className="min-w-0">
											<div className="text-sm font-semibold text-[#eef1f3]">Botón ocultar hilos</div>
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
										className={`relative h-11 w-16 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
											hideThreadButtonEnabled ? 'border-[#f0a020] bg-[#f0a020]' : 'border-[#4a5160] bg-[#464e62]'
										}`}
										disabled={savingMobileLiteSetting === 'hideThreadEnabled'}
										onClick={toggleHideThreadButtonSetting}
									>
										<span
											className={`pointer-events-none absolute left-2 top-2 h-7 w-7 rounded-full bg-white shadow transition-transform ${
												hideThreadButtonEnabled ? 'translate-x-5' : 'translate-x-0'
											}`}
										/>
									</button>
								</div>
							</section>

							{boldColorStatusMessage && (
								<div role="status" className={STATUS_SUCCESS_CLASS}>
									{boldColorStatusMessage}
								</div>
							)}

							{boldColorErrorMessage && (
								<div role="alert" className={STATUS_ERROR_CLASS}>
									{boldColorErrorMessage}
								</div>
							)}

							{mobileLiteSettingsStatusMessage && (
								<div role="status" className={STATUS_SUCCESS_CLASS}>
									{mobileLiteSettingsStatusMessage}
								</div>
							)}

							{mobileLiteSettingsErrorMessage && (
								<div role="alert" className={STATUS_ERROR_CLASS}>
									{mobileLiteSettingsErrorMessage}
								</div>
							)}
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
						className="relative w-full max-w-[32rem] rounded-lg border border-[#4b5468] bg-[#363d4d] p-4 text-sm text-[#e5e8eb] shadow-2xl"
					>
						<p id="mvp-mobile-lite-clear-hidden-threads-title" className="text-base font-semibold text-[#f2f4f7]">
							Se mostrarán todos los hilos ocultos.
						</p>
						<p id="mvp-mobile-lite-clear-hidden-threads-description" className="mt-1 text-sm leading-relaxed text-[#aab4c0]">
							Esto vaciará tu lista de hilos ocultos en este dispositivo.
						</p>
						<div className="mt-4 grid grid-cols-2 gap-2">
							<button
								type="button"
								className="inline-flex h-11 items-center justify-center rounded-md border border-[#626b74] bg-[#363d4d] px-2 text-sm font-semibold text-[#eef1f3] transition-colors active:bg-[#59636e]"
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
