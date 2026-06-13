import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import UserX from 'lucide-react/dist/esm/icons/user-x'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import type { MvUserSearchUser } from '@/lib/messaging'
import { sanitizeAvatarUrl } from '../../logic/avatar-utils'
import { getIgnoreTypeFromCustomization, type MobileLiteIgnoreType } from '../../logic/ignore-helpers'
import type { MobileLiteChangelogEntry } from '../../logic/whats-new'
import {
	USERNAME_VALIDATION_ID,
	type ActiveFilter,
	type FilteredUser,
	type UserFilterOption,
} from '../panel-helpers'
import {
	FILTER_ACTIVE_CLASS,
	FILTER_BASE_CLASS,
	FILTER_IDLE_CLASS,
	GROUP_CLASS,
	INPUT_CLASS,
	ROW_ICON_ACTIVE_CLASS,
	ROW_ICON_BASE_CLASS,
	ROW_ICON_IDLE_CLASS,
} from '../panel-tokens'
import { MobileLiteWhatsNewPrompt } from '../whats-new-prompt'

export function UsersTab({
	hasUnseenWhatsNew,
	latestMobileLiteEntry,
	latestMobileLiteChangeCount,
	onOpenWhatsNew,
	onDismissWhatsNew,
	query,
	onQueryChange,
	usernameValidationMessage,
	hasAnyFilteredUsers,
	filterOptions,
	activeFilter,
	onActiveFilterChange,
	canAddQueryUser,
	addUserSuggestions,
	exactQuerySuggestion,
	exactQueryDisplayName,
	exactQueryUsername,
	savingUser,
	onAddQueryFilter,
	onAddSuggestionFilter,
	missingAvatarCount,
	refreshingAvatars,
	onRefreshAvatars,
	filteredUsers,
	onUpdateFilter,
	onRemoveUserFilter,
}: {
	hasUnseenWhatsNew: boolean
	latestMobileLiteEntry: MobileLiteChangelogEntry | null
	latestMobileLiteChangeCount: number
	onOpenWhatsNew: () => void
	onDismissWhatsNew: () => void
	query: string
	onQueryChange: (value: string) => void
	usernameValidationMessage: string | null
	hasAnyFilteredUsers: boolean
	filterOptions: UserFilterOption[]
	activeFilter: ActiveFilter
	onActiveFilterChange: (id: ActiveFilter) => void
	canAddQueryUser: boolean
	addUserSuggestions: MvUserSearchUser[]
	exactQuerySuggestion: MvUserSearchUser | null
	exactQueryDisplayName: string
	exactQueryUsername: string
	savingUser: string | null
	onAddQueryFilter: (ignoreType: MobileLiteIgnoreType) => void
	onAddSuggestionFilter: (suggestion: MvUserSearchUser, ignoreType: MobileLiteIgnoreType) => void
	missingAvatarCount: number
	refreshingAvatars: boolean
	onRefreshAvatars: () => void
	filteredUsers: FilteredUser[]
	onUpdateFilter: (username: string, ignoreType: MobileLiteIgnoreType) => void
	onRemoveUserFilter: (username: string) => void
}) {
	return (
		<>
			{hasUnseenWhatsNew && latestMobileLiteEntry && (
				<MobileLiteWhatsNewPrompt
					entry={latestMobileLiteEntry}
					changeCount={latestMobileLiteChangeCount}
					onOpen={onOpenWhatsNew}
					onDismiss={onDismissWhatsNew}
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
						onChange={event => onQueryChange(event.target.value)}
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
									onClick={() => onActiveFilterChange(option.id)}
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
										onClick={() => onAddQueryFilter('mute')}
									>
										<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
									</button>
									<button
										type="button"
										aria-label="Ocultar"
										className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
										disabled={savingUser?.toLowerCase() === exactQueryUsername.toLowerCase()}
										onClick={() => onAddQueryFilter('hide')}
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
											onClick={() => onAddSuggestionFilter(suggestion, 'mute')}
										>
											<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
										</button>
										<button
											type="button"
											aria-label={`Ocultar ${suggestion.username}`}
											className={`${ROW_ICON_BASE_CLASS} ${ROW_ICON_IDLE_CLASS}`}
											disabled={isSavingSuggestion}
											onClick={() => onAddSuggestionFilter(suggestion, 'hide')}
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
					onClick={onRefreshAvatars}
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
											onClick={() => onUpdateFilter(user.username, 'mute')}
										>
											<VolumeX className="h-[18px] w-[18px]" aria-hidden="true" />
										</button>
										<button
											type="button"
											aria-label={ignoreType === 'hide' ? 'Ocultado' : 'Ocultar'}
											aria-pressed={ignoreType === 'hide'}
											className={`${ROW_ICON_BASE_CLASS} ${ignoreType === 'hide' ? ROW_ICON_ACTIVE_CLASS : ROW_ICON_IDLE_CLASS}`}
											disabled={isSaving}
											onClick={() => onUpdateFilter(user.username, 'hide')}
										>
											<EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
										</button>
										<button
											type="button"
											aria-label="Quitar"
											className={`${ROW_ICON_BASE_CLASS} text-[#e08a8a] active:bg-[#3a2427] active:text-[#f2c2c2]`}
											disabled={isSaving}
											onClick={() => onRemoveUserFilter(user.username)}
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
	)
}
