import { useEffect, useMemo, useState } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import X from 'lucide-react/dist/esm/icons/x'
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

interface FilteredUser {
	username: string
	customization: UserCustomization
}

type ActiveFilter = 'all' | MobileLiteIgnoreType

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

function getUsernameValidationMessage(username: string): string | null {
	if (!username) return null
	if (username.length < USERNAME_MIN_LENGTH) return 'Escribe al menos 3 caracteres para añadir un usuario.'
	if (username.length > USERNAME_MAX_LENGTH) return 'El nick no puede tener más de 13 caracteres.'
	if (!USERNAME_PATTERN.test(username)) return 'Usa solo letras, números, guiones y guiones bajos.'
	return null
}

async function updateUserIgnore(username: string, ignoreType: MobileLiteIgnoreType | null): Promise<UserCustomizationsData> {
	const data = await getUserCustomizations()
	const { storageKey } = setUserIgnoreInData(data, username, ignoreType)
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
	const [data, setData] = useState<UserCustomizationsData>(getEmptyData)
	const [query, setQuery] = useState('')
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all')
	const [savingUser, setSavingUser] = useState<string | null>(null)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)

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
	const hasFilteredUsers = filteredUsers.length > 0

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

	if (!open) return null

	return (
		<div className="fixed inset-0 z-[99999] bg-black/60">
			<button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Cerrar panel MVP" onClick={() => setOpen(false)} />

			<section
				className={`absolute inset-x-3 overflow-hidden border border-[#4b545d] bg-[#343b41] text-[#e5e8eb] shadow-2xl ${
					hasAnyFilteredUsers ? 'bottom-0 top-[14dvh] flex flex-col rounded-t-lg' : 'top-[24dvh] rounded-lg'
				}`}
			>
				<header className="flex items-center justify-between border-b border-[#46505a] bg-[#30363d] px-4 py-3">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold leading-tight">
							<span>Panel MV</span>
							<span className="text-[#f0a020]">Premium</span>
						</h2>
						<p className="mt-0.5 text-xs text-[#b7bec6]">Usuarios filtrados</p>
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

				<div className={`${hasAnyFilteredUsers ? 'flex-1 overflow-y-auto' : ''} bg-[#384149] px-4 py-4`}>
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
										className={`inline-flex h-9 min-w-0 items-center justify-center rounded-md border px-2 text-xs font-semibold ${
											isActive ? 'border-[#d06d00] bg-[#7b4b08] text-white' : 'border-[#56616b] bg-[#303840] text-[#d8dde2]'
										}`}
										aria-pressed={isActive}
										onClick={() => setActiveFilter(option.id)}
									>
										<span className="truncate">{option.label}</span>
										<span className="ml-1 rounded bg-[#252b31] px-1.5 py-0.5 text-[11px] leading-none text-[#eef1f3]">
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
							<div className="mt-3 grid grid-cols-2 gap-2">
								<button
									type="button"
									className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#545d66] px-3 text-sm font-semibold"
									disabled={savingUser === exactQueryUsername || savingUser === exactQueryDisplayName}
									onClick={() => addQueryFilter('mute')}
								>
									<VolumeX className="h-4 w-4" aria-hidden="true" />
									Silenciar
								</button>
								<button
									type="button"
									className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#626b74] bg-[#545d66] px-3 text-sm font-semibold"
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

										<div className="mt-3 grid grid-cols-2 gap-2">
											<button
												type="button"
												className={`inline-flex h-10 items-center justify-center gap-1 rounded-md border px-2 text-sm font-semibold ${
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
												className={`inline-flex h-10 items-center justify-center gap-1 rounded-md border px-2 text-sm font-semibold ${
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
												className="col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-md border border-[#626b74] bg-[#545d66] px-2 text-sm font-semibold"
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
				</div>
			</section>
		</div>
	)
}
