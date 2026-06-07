import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import Check from 'lucide-react/dist/esm/icons/check'
import Clipboard from 'lucide-react/dist/esm/icons/clipboard'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Image from 'lucide-react/dist/esm/icons/image'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
import { browser } from 'wxt/browser'
import { sendMessage } from '@/lib/messaging'
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

interface FilteredUser {
	username: string
	customization: UserCustomization
}

type ActiveFilter = 'all' | MobileLiteIgnoreType
type PanelTab = 'users' | 'images'

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

function getVisualViewportBounds() {
	const viewport = window.visualViewport
	return {
		height: viewport?.height ?? window.innerHeight,
		offsetTop: viewport?.offsetTop ?? 0,
	}
}

function useVisualViewportBounds(enabled: boolean) {
	const [bounds, setBounds] = useState(DEFAULT_VIEWPORT_BOUNDS)

	useEffect(() => {
		if (!enabled) return

		const updateBounds = () => setBounds(getVisualViewportBounds())
		updateBounds()

		window.addEventListener('resize', updateBounds)
		window.visualViewport?.addEventListener('resize', updateBounds)
		window.visualViewport?.addEventListener('scroll', updateBounds)

		return () => {
			window.removeEventListener('resize', updateBounds)
			window.visualViewport?.removeEventListener('resize', updateBounds)
			window.visualViewport?.removeEventListener('scroll', updateBounds)
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
	const userLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.user-card[href^="/id/"]'))

	for (const link of userLinks) {
		const linkUsername = link.textContent?.trim() || link.querySelector('img')?.alt?.trim() || link.getAttribute('href')?.split('/').pop()?.trim() || ''
		if (linkUsername.toLowerCase() !== normalizedUsername) continue

		const avatarUrl = link.querySelector<HTMLImageElement>('img.avatar, img')?.src
		if (avatarUrl) return avatarUrl
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
	const [savingImgbbApiKey, setSavingImgbbApiKey] = useState(false)
	const [imgbbStatusMessage, setImgbbStatusMessage] = useState<string | null>(null)
	const [imgbbErrorMessage, setImgbbErrorMessage] = useState<string | null>(null)
	const viewportBounds = useVisualViewportBounds(open)

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

		const handleOpen = () => setOpen(true)
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}

		window.addEventListener(MOBILE_LITE_PANEL_OPEN_EVENT, handleOpen)
		window.addEventListener('keydown', handleKeyDown)

		return () => {
			mounted = false
			unwatch()
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

	const exactQueryUsername = normalizeUsername(query)
	const exactQueryEntry = exactQueryUsername ? getCustomizationEntryForUser(data, exactQueryUsername) : null
	const exactQueryCustomization = exactQueryEntry?.customization
	const exactQueryDisplayName = exactQueryEntry?.storageKey ?? exactQueryUsername
	const usernameValidationMessage = getUsernameValidationMessage(exactQueryUsername)
	const canAddQueryUser = Boolean(exactQueryUsername && !usernameValidationMessage && !exactQueryCustomization?.isIgnored)
	const hasAnyFilteredUsers = allFilteredUsers.length > 0
	const isImgbbConfigured = Boolean(imgbbApiKey.trim())
	const logoUrl = browser.runtime.getURL('/icon/48.png')

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

	if (!open) return null

	const overlayStyle: CSSProperties | undefined = viewportBounds.height
		? {
				height: `${viewportBounds.height}px`,
				top: `${viewportBounds.offsetTop}px`,
			}
		: undefined

	return (
		<div className="fixed inset-x-0 top-0 z-[99999] h-[100dvh] overflow-hidden bg-black/60" style={overlayStyle}>
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			<section
				className={`absolute left-[max(12px,env(safe-area-inset-left))] right-[max(12px,env(safe-area-inset-right))] flex max-h-[calc(100%_-_max(12px,env(safe-area-inset-top))_-_max(12px,env(safe-area-inset-bottom)))] flex-col overflow-hidden border border-[#4b545d] bg-[#343b41] text-[#e5e8eb] shadow-2xl ${
					hasAnyFilteredUsers
						? 'bottom-[max(0px,env(safe-area-inset-bottom))] top-[max(56px,calc(env(safe-area-inset-top)_+_12px))] rounded-t-lg'
						: 'bottom-auto top-[max(132px,calc(env(safe-area-inset-top)_+_18dvh))] rounded-lg'
				}`}
			>
				<header className="flex items-center justify-between border-b border-[#46505a] bg-[#30363d] px-4 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-md object-contain" aria-hidden="true" />
						<div className="min-w-0">
							<h2 className="truncate text-lg font-black uppercase leading-none tracking-tight">
								<span>MV</span>
								<span className="italic text-[#f0a020]">Premium</span>
							</h2>
							<p className="mt-1 text-[10px] font-bold uppercase tracking-[0.32em] text-[#b7bec6]">Dashboard</p>
						</div>
					</div>
					<button
						type="button"
						className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#56606a] bg-[#444b54] text-[#eef1f3]"
						aria-label="Cerrar"
						onClick={() => setOpen(false)}
					>
						<X className="h-5 w-5" aria-hidden="true" />
					</button>
				</header>

				<div className="min-h-0 flex-1 overflow-y-auto bg-[#384149] px-4 py-4 pb-[max(16px,calc(env(safe-area-inset-bottom)_+_16px))]">
					<div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Secciones del panel MVPremium">
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'users'}
							className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold ${
								activeTab === 'users' ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#56616b] bg-[#303840] text-[#d8dde2]'
							}`}
							onClick={() => setActiveTab('users')}
						>
							<UserX className="h-4 w-4" aria-hidden="true" />
							Usuarios
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={activeTab === 'images'}
							className={`inline-flex h-10 items-center justify-center gap-2 rounded-md border px-2 text-sm font-semibold ${
								activeTab === 'images' ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#56616b] bg-[#303840] text-[#d8dde2]'
							}`}
							onClick={() => setActiveTab('images')}
						>
							<Image className="h-4 w-4" aria-hidden="true" />
							ImgBB
						</button>
					</div>

					{activeTab === 'users' ? (
						<>
							{errorMessage && (
								<div role="alert" className="mb-3 rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]">
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
									className="h-11 w-full rounded-md border border-[#505963] bg-[#262d34] pl-10 pr-3 text-base text-[#eef1f3] outline-none placeholder:text-[#aeb6be] focus:border-[#d06d00]"
								/>
							</label>

							{usernameValidationMessage && (
								<p id={USERNAME_VALIDATION_ID} className="mt-2 text-xs text-[#d8b36a]">
									{usernameValidationMessage}
								</p>
							)}

							{statusMessage && (
								<div role="status" className="mt-3 rounded-md border border-[#556454] bg-[#2f3d34] px-3 py-2 text-sm text-[#d5ead5]">
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
												className={`inline-flex h-9 min-w-0 items-center justify-center rounded-md border px-1.5 text-xs font-semibold ${
													isActive ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#56616b] bg-[#303840] text-[#d8dde2]'
												}`}
												aria-pressed={isActive}
												onClick={() => setActiveFilter(option.id)}
											>
												<span className="truncate">{option.label}</span>
												<span className="ml-1 shrink-0 rounded bg-[#252b31] px-1.5 py-0.5 text-[11px] leading-none text-[#eef1f3]">
													({option.count})
												</span>
											</button>
										)
									})}
								</div>
							)}

							{canAddQueryUser && (
								<div className="mt-3 rounded-md border border-dashed border-[#56616b] bg-[#303840] p-3">
									<div className="flex items-center gap-2 text-sm font-medium">
										<UserX className="h-4 w-4 text-[#b7bec6]" aria-hidden="true" />
										<span className="min-w-0 truncate">{exactQueryDisplayName}</span>
									</div>
									<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(118px,1fr))] gap-2">
										<button
											type="button"
											className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#545d66] px-2 text-sm font-semibold"
											disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
											onClick={() => addQueryFilter('mute')}
										>
											<VolumeX className="h-4 w-4" aria-hidden="true" />
											Silenciar
										</button>
										<button
											type="button"
											className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#545d66] px-2 text-sm font-semibold"
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
									<div className="rounded-md border border-[#4b545d] bg-[#303840] px-4 py-8 text-center text-sm text-[#b7bec6]">
										{hasAnyFilteredUsers ? 'No hay resultados para este filtro.' : 'No hay usuarios filtrados.'}
									</div>
								) : (
									filteredUsers.map(user => {
										const ignoreType = getIgnoreTypeFromCustomization(user.customization) ?? 'hide'
										const isSaving = savingUser?.toLowerCase() === user.username.toLowerCase()

										return (
											<article key={user.username} className="rounded-md border border-[#4b545d] bg-[#3e4750] p-3">
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
														className={`inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-md border px-2 text-sm font-semibold ${
															ignoreType === 'mute' ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#626b74] bg-[#545d66]'
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'mute')}
													>
														<VolumeX className="h-4 w-4" aria-hidden="true" />
														<span>{ignoreType === 'mute' ? 'Silenciado' : 'Silenciar'}</span>
													</button>
													<button
														type="button"
														className={`inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-md border px-2 text-sm font-semibold ${
															ignoreType === 'hide' ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#626b74] bg-[#545d66]'
														}`}
														disabled={isSaving}
														onClick={() => updateFilter(user.username, 'hide')}
													>
														<EyeOff className="h-4 w-4" aria-hidden="true" />
														<span>{ignoreType === 'hide' ? 'Ocultado' : 'Ocultar'}</span>
													</button>
													<button
														type="button"
														className="col-span-full inline-flex h-10 min-w-0 items-center justify-center gap-1 rounded-md border border-[#626b74] bg-[#545d66] px-2 text-sm font-semibold"
														disabled={isSaving}
														onClick={() => updateFilter(user.username, null)}
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
					) : (
						<div className="space-y-3">
							<div className="rounded-md border border-[#4b545d] bg-[#303840] p-3">
								<div className="flex items-start gap-3">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#252b31] text-[#f0a020]">
										<KeyRound className="h-5 w-5" aria-hidden="true" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<div className="text-base font-semibold">ImgBB</div>
											<span
												className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${
													isImgbbConfigured ? 'bg-[#274532] text-[#bdf2c7]' : 'bg-[#4b3b25] text-[#f6d28b]'
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
									className="mt-2 h-11 w-full rounded-md border border-[#505963] bg-[#262d34] px-3 font-mono text-sm text-[#eef1f3] outline-none placeholder:text-[#aeb6be] focus:border-[#d06d00]"
								/>

								<div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(116px,1fr))] gap-2">
									<button
										type="button"
										className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#545d66] px-2 text-sm font-semibold"
										onClick={pasteImgbbApiKey}
									>
										<Clipboard className="h-4 w-4" aria-hidden="true" />
										Pegar
									</button>
									<button
										type="button"
										className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d06d00] bg-[#9a6500] px-2 text-sm font-semibold text-white disabled:opacity-60"
										disabled={savingImgbbApiKey || imgbbApiKeyDraft.trim() === imgbbApiKey}
										onClick={saveImgbbApiKey}
									>
										<Check className="h-4 w-4" aria-hidden="true" />
										{savingImgbbApiKey ? 'Guardando' : 'Guardar'}
									</button>
								</div>
							</div>

							{imgbbStatusMessage && (
								<div role="status" className="rounded-md border border-[#556454] bg-[#2f3d34] px-3 py-2 text-sm text-[#d5ead5]">
									{imgbbStatusMessage}
								</div>
							)}

							{imgbbErrorMessage && (
								<div role="alert" className="rounded-md border border-[#8f3f3f] bg-[#4a2528] px-3 py-2 text-sm text-[#ffd7d7]">
									{imgbbErrorMessage}
								</div>
							)}

							<a
								href="https://api.imgbb.com/"
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#56616b] bg-[#303840] px-3 text-sm font-semibold text-[#eef1f3]"
							>
								<ExternalLink className="h-4 w-4" aria-hidden="true" />
								Obtener API key
							</a>
						</div>
					)}
				</div>
			</section>
		</div>
	)
}
