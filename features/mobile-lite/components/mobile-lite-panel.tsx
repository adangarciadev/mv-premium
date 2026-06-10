import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import Bold from 'lucide-react/dist/esm/icons/bold'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert'
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
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
 * App-like token system: one neutral surface ramp + a single amber accent (#f0a020).
 * Flat grouped lists (no per-row gradients), bottom tab bar, 44px controls and a
 * 12/16/24 radius scale. Literal hex is used throughout so Tailwind's JIT reliably
 * generates each class. These constants are the single source of truth.
 *
 *   sheet #1c1f27 · group #242a36 · input #14171d · divider #2d3442 · pressed #2e3543
 *   text #eef1f6 · muted #9aa5b4 · faint #8b95a3 · accent #f0a020 · on-accent #221604
 */
// Bottom tab bar items: the active state fills the whole button as one pill (icon + label).
const TAB_BASE_CLASS =
	'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold uppercase tracking-[0.08em] transition-colors'
const TAB_ACTIVE_CLASS =
	'bg-gradient-to-b from-[#f0a020]/[0.22] to-[#f0a020]/[0.07] text-[#f0a020] ring-1 ring-inset ring-[#f0a020]/[0.25] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.3),0_3px_10px_rgba(0,0,0,0.45)]'
const TAB_IDLE_CLASS = 'text-[#8b95a3] active:bg-[#1d212b] active:text-[#c2cad6]'
// Filter chips: same beveled-pill language as the bottom tab bar.
const FILTER_BASE_CLASS =
	'inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-colors'
const FILTER_ACTIVE_CLASS =
	'bg-gradient-to-b from-[#f0a020]/[0.22] to-[#f0a020]/[0.07] text-[#f0a020] ring-1 ring-inset ring-[#f0a020]/[0.25] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-1px_0_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.35)]'
const FILTER_IDLE_CLASS = 'bg-[#242a36] text-[#9aa5b4] ring-1 ring-inset ring-white/[0.04] active:bg-[#2e3543]'
// Buttons: a single amber primary + one neutral secondary, both 44px.
const PRIMARY_BUTTON_CLASS =
	'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#f0a020] px-4 text-sm font-bold text-[#221604] transition-colors active:bg-[#d98e12] disabled:bg-[#2e3543] disabled:text-[#707b8e]'
const SECONDARY_BUTTON_CLASS =
	'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2e3543] px-4 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#3a4254] disabled:opacity-50'
// Row icon actions: ghost circles, accent tint only when active.
const ROW_ICON_BASE_CLASS =
	'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50'
const ROW_ICON_IDLE_CLASS = 'text-[#8b95a3] active:bg-[#2e3543]'
const ROW_ICON_ACTIVE_CLASS = 'bg-[#f0a020]/[0.16] text-[#f0a020]'
// Grouped list surfaces (iOS inset-list style) and section labels.
const GROUP_CLASS = 'overflow-hidden rounded-2xl bg-[#242a36]'
const SECTION_LABEL_CLASS = 'px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]'
// Inputs: 16px text always (prevents iOS auto-zoom), flat surface, accent focus ring.
const INPUT_CLASS =
	'h-11 w-full rounded-xl border border-transparent bg-[#14171d] text-base text-[#eef1f6] outline-none placeholder:text-[#707b8e] focus:border-[#f0a020]'
// Switch: 28x48 visual track inside a 44px touch target.
const SWITCH_WRAPPER_CLASS = 'inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-60'
const SWITCH_TRACK_BASE_CLASS = 'relative block h-7 w-12 rounded-full transition-colors'
const SWITCH_THUMB_BASE_CLASS =
	'pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform'
// Toasts: single feedback channel anchored above the tab bar. Saturated
// surfaces + status icon so the outcome reads at a glance.
const STATUS_SUCCESS_CLASS =
	'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-[#2e8a52] bg-[#0e3320]/95 px-4 py-3 text-sm font-semibold text-[#d3f9e0] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-200'
const STATUS_ERROR_CLASS =
	'pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border border-[#a84b53] bg-[#3c181c]/95 px-4 py-3 text-sm font-semibold text-[#ffd9d9] shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur animate-in fade-in-0 slide-in-from-bottom-2 duration-200'

function PanelToast({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
	const isSuccess = kind === 'success'
	const Icon = isSuccess ? CircleCheck : CircleAlert
	return (
		<div role={isSuccess ? 'status' : 'alert'} className={isSuccess ? STATUS_SUCCESS_CLASS : STATUS_ERROR_CLASS}>
			<Icon className={`h-5 w-5 shrink-0 ${isSuccess ? 'text-[#41d97e]' : 'text-[#ff8585]'}`} aria-hidden="true" />
			<span className="min-w-0 flex-1">{children}</span>
		</div>
	)
}

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
	const dragStartYRef = useRef<number | null>(null)
	const sheetRef = useRef<HTMLElement>(null)
	const [dragOffset, setDragOffset] = useState(0)
	const [isDragging, setIsDragging] = useState(false)

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
									MV<span className="italic text-[#f0a020]">Premium</span>
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

					{activeTab === 'users' ? (
						<>
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
							</div>

							{usernameValidationMessage && (
								<p id={USERNAME_VALIDATION_ID} className="mt-1 px-1 text-xs text-[#d8b36a]">
									{usernameValidationMessage}
								</p>
							)}

							{canAddQueryUser && (
								<div className="mt-2 rounded-2xl border border-dashed border-[#3a4254] bg-[#14171d] p-3">
									<div className="flex items-center gap-2 px-1 text-sm font-semibold">
										<UserX className="h-4 w-4 text-[#9aa5b4]" aria-hidden="true" />
										<span className="min-w-0 truncate">{exactQueryDisplayName}</span>
									</div>
									<div className="mt-3 grid grid-cols-2 gap-2">
										<button
											type="button"
											className={SECONDARY_BUTTON_CLASS}
											disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
											onClick={() => addQueryFilter('mute')}
										>
											<VolumeX className="h-4 w-4" aria-hidden="true" />
											Silenciar
										</button>
										<button
											type="button"
											className={SECONDARY_BUTTON_CLASS}
											disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
											onClick={() => addQueryFilter('hide')}
										>
											<EyeOff className="h-4 w-4" aria-hidden="true" />
											Ocultar
										</button>
									</div>
								</div>
							)}

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

											return (
												<article key={user.username} className="flex items-center gap-3 py-2 pl-3 pr-2">
													<div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#14171d] text-sm font-bold text-[#9aa5b4]">
														{user.customization.avatarUrl ? (
															<img src={user.customization.avatarUrl} alt="" className="h-full w-full object-cover" />
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
							className={`${TAB_BASE_CLASS} ${activeTab === 'users' ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS}`}
							onClick={() => setActiveTab('users')}
						>
							<UserX className="h-5 w-5" aria-hidden="true" />
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
							onClick={() => setActiveTab('settings')}
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
