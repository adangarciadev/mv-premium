/**
 * Command Menu (Cmd+K)
 * Global quick navigation and action palette.
 * Comprehensive search across subforums, saved threads, drafts, and user content.
 *
 * OPTIMIZATION: Storage modules are lazy-loaded when menu opens to reduce initial bundle.
 */

import Search from 'lucide-react/dist/esm/icons/search'
import { logger } from '@/lib/logger'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Star from 'lucide-react/dist/esm/icons/star'
import Home from 'lucide-react/dist/esm/icons/home'
import Eye from 'lucide-react/dist/esm/icons/eye'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import Pin from 'lucide-react/dist/esm/icons/pin'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Layout from 'lucide-react/dist/esm/icons/layout'
import SunMoon from 'lucide-react/dist/esm/icons/sun-moon'
import Bookmark from 'lucide-react/dist/esm/icons/bookmark'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import SettingsIcon from 'lucide-react/dist/esm/icons/settings'
import User from 'lucide-react/dist/esm/icons/user'

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants'

// Local imports
import type { CommandMenuProps, QuickAction } from '../types'
import { useCommandMenu } from '../hooks/use-command-menu'
import { getIconId, openDashboard } from '../utils'
import { HighlightMatch } from './highlight-match'
import { CommandHeader } from './command-header'
import { ShortcutKeys } from './shortcut-keys'

/**
 * CommandMenu component - Global navigation and action palette.
 * Orchestrates cross-feature search and rapid command execution.
 */
export function CommandMenu({ open: controlledOpen, onOpenChange: setControlledOpen }: CommandMenuProps) {
	const {
		open,
		setOpen,
		search,
		setSearch,
		loading,
		username,
		contextLabel,
		isDashboard,
		isSearching,
		filteredData,
		runCommand,
		goTo,
		searchMV,
		getShortcut,
	} = useCommandMenu({ open: controlledOpen, onOpenChange: setControlledOpen })

	const hasResults = Object.values(filteredData).some(arr => arr.length > 0) || !search

	// Quick actions for non-search mode
	const quickActions: QuickAction[] = [
		{
			key: 'home',
			label: 'Ir a portada',
			action: () => goTo('/'),
			icon: <Home className="h-4 w-4 text-muted-foreground" />,
			shortcut: getShortcut('home'),
		},
		{
			key: 'spy',
			label: 'Spy (Lo último)',
			action: () => goTo('/foro/spy'),
			icon: <Eye className="h-4 w-4 text-muted-foreground" />,
			shortcut: getShortcut('spy'),
		},
		{
			key: 'subforums',
			label: 'Subforos',
			action: () => goTo('/foro'),
			icon: <BookOpen className="h-4 w-4 text-muted-foreground" />,
			shortcut: getShortcut('subforums'),
		},
		{
			key: 'mp',
			label: 'Mensajes privados',
			action: () => goTo('/mensajes'),
			icon: (
				<MessageSquare className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
			),
			shortcut: getShortcut('messages'),
		},
		...(username
			? [
					{
						key: 'saved',
						label: 'Mis hilos guardados',
						action: () => goTo(`/id/${username}/temas#guardados`),
						icon: <Bookmark className="h-4 w-4 text-muted-foreground" />,
						shortcut: getShortcut('saved'),
					},
			  ]
			: []),
		{
			key: 'drafts',
			label: 'Abrir borradores',
			action: () => openDashboard('drafts'),
			icon: <FileText className="h-4 w-4 text-muted-foreground" />,
			shortcut: getShortcut('drafts'),
		},
		{
			key: 'theme-toggle',
			label: 'Alternar Tema',
			action: () => {
				const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
				browser.storage.local
					.set({
						[STORAGE_KEYS.THEME]: next,
						[STORAGE_KEYS.THEME_RAW]: next,
					})
					.catch(err => logger.error('Theme toggle storage error:', err))
			},
			icon: <SunMoon className="h-4 w-4 text-muted-foreground" />,
			shortcut: getShortcut('theme-toggle'),
		},
	]

	return (
		<CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false} className="max-w-2xl">
			<CommandHeader contextLabel={contextLabel} />
			<CommandInput
				placeholder="Escribe un comando o busca..."
				value={search}
				onValueChange={setSearch}
				className="border-none"
			/>
			<CommandList className="max-h-[450px]">
				{/* Loading skeleton */}
				{loading && (
					<div className="px-3 py-3 space-y-2">
						{[1, 2, 3].map(i => (
							<div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />
						))}
					</div>
				)}

				{/* Empty state */}
				<CommandEmpty>
					<div className="flex flex-col items-center gap-4 py-12">
						<div className="relative">
							<div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
							<Search className="relative h-8 w-8 text-muted-foreground/40" />
						</div>
						<div className="text-center space-y-1">
							<p className="text-sm font-semibold text-foreground/80">No se encontraron resultados</p>
							<p className="text-xs text-muted-foreground/50">Intenta buscar algo más específico</p>
						</div>
						{search && (
							<button
								className="mt-4 text-[13px] font-medium text-primary hover:text-primary/80 transition-all flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 hover:bg-primary/10 border border-primary/10"
								onClick={() => runCommand(searchMV)}
							>
								Buscar <span className="font-bold underline decoration-primary/30">"{search}"</span> en Mediavida
								<ExternalLink className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				</CommandEmpty>

				{/* Loading spinner (initial) */}
				{loading && !hasResults && (
					<div className="py-12 flex justify-center">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
					</div>
				)}

				{/* Quick Actions (no search) */}
				{!isSearching && quickActions.length > 0 && (
					<CommandGroup heading={isDashboard ? 'ACCIONES RÁPIDAS (PANEL)' : 'SUGERENCIAS'}>
						{quickActions.map(item => (
							<CommandItem key={item.key} onSelect={() => runCommand(item.action)}>
								<div className="flex shrink-0 items-center justify-center">{item.icon}</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									<HighlightMatch text={item.label} query={search} />
								</span>
								<ShortcutKeys shortcut={item.shortcut} />
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Saved Threads */}
				{filteredData.threads.length > 0 && (
					<CommandGroup heading="HILOS GUARDADOS">
						{filteredData.threads.map(thread => (
							<CommandItem key={thread.id} onSelect={() => runCommand(() => goTo(thread.id))}>
								<div className="flex shrink-0 items-center justify-center">
									<Bookmark className="h-4 w-4 text-orange-400/60 fill-orange-400/5 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<div className="flex flex-col gap-0.5 min-w-0 flex-1">
									<span className="truncate font-medium text-foreground/90 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors">
										<HighlightMatch text={thread.title} query={search} />
									</span>
									<span className="text-[10px] text-muted-foreground/60 line-clamp-1 group-hover:text-primary/70 group-data-[selected=true]:text-primary/70 transition-colors">
										<HighlightMatch text={thread.subforum} query={search} />
									</span>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Favorites (when searching) */}
				{search && filteredData.favorites.length > 0 && (
					<CommandGroup heading="MIS FAVORITOS">
						{filteredData.favorites.slice(0, 5).map(fav => (
							<CommandItem key={fav.id} onSelect={() => runCommand(() => goTo(fav.url))}>
								<div className="flex shrink-0 items-center justify-center">
									<NativeFidIcon
										iconId={getIconId(fav.iconClass)}
										className="h-5 w-5 opacity-70 group-hover:opacity-100 group-data-[selected=true]:opacity-100 transition-opacity"
									/>
								</div>
								<span className="font-medium flex-1 text-foreground/90 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors">
									<HighlightMatch text={fav.name} query={search} />
								</span>
								<Star className="h-3.5 w-3.5 fill-yellow-500/10 text-yellow-500/40 group-hover:text-yellow-500 group-data-[selected=true]:text-yellow-500 transition-colors" />
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Drafts & Templates */}
				{(filteredData.drafts.length > 0 || filteredData.templates.length > 0) && (
					<CommandGroup heading="CONTENIDO PERSONAL">
						{filteredData.drafts.map(draft => (
							<CommandItem key={draft.id} onSelect={() => runCommand(() => openDashboard(`drafts/edit/${draft.id}`))}>
								<div className="flex shrink-0 items-center justify-center">
									<FileText className="h-4 w-4 text-blue-400/60 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors" />
								</div>
								<div className="flex flex-col gap-0.5 min-w-0 flex-1">
									<span className="truncate font-medium text-foreground/90 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors">
										<HighlightMatch text={draft.title || 'Sin título'} query={search} />
									</span>
									<span className="text-[10px] text-muted-foreground/60 group-hover:text-primary/70 group-data-[selected=true]:text-primary/70 transition-colors">
										Borrador
									</span>
								</div>
							</CommandItem>
						))}
						{filteredData.templates.map(tmpl => (
							<CommandItem key={tmpl.id} onSelect={() => runCommand(() => openDashboard(`templates/edit/${tmpl.id}`))}>
								<div className="flex shrink-0 items-center justify-center">
									<Layout className="h-4 w-4 text-purple-400/60 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors" />
								</div>
								<div className="flex flex-col gap-0.5 min-w-0 flex-1">
									<span className="truncate font-medium text-foreground/90 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors">
										<HighlightMatch text={tmpl.title} query={search} />
									</span>
									<span className="text-[10px] text-muted-foreground/60 group-hover:text-primary/70 group-data-[selected=true]:text-primary/70 transition-colors">
										Plantilla
									</span>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Subforums (when searching) */}
				{filteredData.subforums.length > 0 && search && (
					<CommandGroup heading="SUBFOROS ENCONTRADOS">
						{filteredData.subforums.map(sf => (
							<CommandItem key={sf.slug} onSelect={() => runCommand(() => goTo(`/foro/${sf.slug}`))}>
								<div className="flex shrink-0 items-center justify-center">
									<NativeFidIcon
										iconId={sf.iconId}
										className="h-5 w-5 opacity-70 group-hover:opacity-100 group-data-[selected=true]:opacity-100 transition-opacity"
									/>
								</div>
								<span className="font-medium text-foreground/90 group-hover:text-primary group-data-[selected=true]:text-primary transition-colors">
									<HighlightMatch text={sf.name} query={search} />
								</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Navigation Groups (no search) */}
				{!isSearching && (
					<>
						<CommandGroup heading="NAVEGACIÓN MV">
							<CommandItem onSelect={() => runCommand(() => goTo('/'))}>
								<div className="flex shrink-0 items-center justify-center">
									<Home className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Portada
								</span>
								<ShortcutKeys shortcut={getShortcut('home')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => goTo('/foro/spy'))}>
								<div className="flex shrink-0 items-center justify-center">
									<Eye className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Spy (Lo último)
								</span>
								<ShortcutKeys shortcut={getShortcut('spy')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => goTo('/mensajes'))}>
								<div className="flex shrink-0 items-center justify-center">
									<MessageSquare className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Mensajes Privados
								</span>
								<ShortcutKeys shortcut={getShortcut('messages')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => goTo('/foro'))}>
								<div className="flex shrink-0 items-center justify-center">
									<BookOpen className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Subforos
								</span>
								<ShortcutKeys shortcut={getShortcut('subforums')} />
							</CommandItem>
							{username && (
								<>
									<CommandItem onSelect={() => runCommand(() => goTo(`/id/${username}/temas#guardados`))}>
										<div className="flex shrink-0 items-center justify-center">
											<Bookmark className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
										</div>
										<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
											Threads Guardados
										</span>
										<ShortcutKeys shortcut={getShortcut('saved')} />
									</CommandItem>
									<CommandItem onSelect={() => runCommand(() => goTo(`/id/${username}/temas#anclados`))}>
										<div className="flex shrink-0 items-center justify-center">
											<Pin className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
										</div>
										<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
											Posts Anclados
										</span>
										<ShortcutKeys shortcut={getShortcut('pinned')} />
									</CommandItem>
									<CommandItem onSelect={() => runCommand(() => goTo(`/id/${username}`))}>
										<div className="flex shrink-0 items-center justify-center">
											<User className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
										</div>
										<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
											Mi Perfil
										</span>
										<ShortcutKeys shortcut={getShortcut('profile')} />
									</CommandItem>
								</>
							)}
						</CommandGroup>

						<CommandGroup heading="MVP PANEL">
							<CommandItem onSelect={() => runCommand(() => openDashboard())}>
								<div className="flex shrink-0 items-center justify-center">
									<SettingsIcon className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Panel de Control
								</span>
								<ShortcutKeys shortcut={getShortcut('panel')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => openDashboard('drafts/new'))}>
								<div className="flex shrink-0 items-center justify-center">
									<Plus className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Crear Nuevo Borrador
								</span>
								<ShortcutKeys shortcut={getShortcut('new-draft')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => openDashboard('templates/new'))}>
								<div className="flex shrink-0 items-center justify-center">
									<Layout className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Crear Nueva Plantilla
								</span>
								<ShortcutKeys shortcut={getShortcut('new-template')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => openDashboard('drafts'))}>
								<div className="flex shrink-0 items-center justify-center">
									<FileText className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Mis Borradores
								</span>
								<ShortcutKeys shortcut={getShortcut('drafts')} />
							</CommandItem>
							<CommandItem onSelect={() => runCommand(() => openDashboard('templates'))}>
								<div className="flex shrink-0 items-center justify-center">
									<Layout className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
								</div>
								<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									Mis Plantillas
								</span>
								<ShortcutKeys shortcut={getShortcut('templates')} />
							</CommandItem>
						</CommandGroup>

						{isDashboard && (
							<CommandGroup heading="APARIENCIA">
								<CommandItem
									onSelect={() =>
										runCommand(() => {
											const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
											browser.storage.local
												.set({
													[STORAGE_KEYS.THEME]: next,
													[STORAGE_KEYS.THEME_RAW]: next,
												})
												.catch(err => logger.error('Theme toggle storage error:', err))
										})
									}
								>
									<div className="flex shrink-0 items-center justify-center">
										<SunMoon className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary" />
									</div>
									<span className="font-medium flex-1 text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
										Alternar Tema
									</span>
									<ShortcutKeys shortcut={getShortcut('theme-toggle')} />
								</CommandItem>
							</CommandGroup>
						)}
					</>
				)}

				{/* Actions (when searching) */}
				{isSearching && filteredData.actions.length > 0 && (
					<CommandGroup heading="ACCIONES">
						{filteredData.actions.map(action => (
							<CommandItem key={action.key} onSelect={() => runCommand(action.action)}>
								<div className="flex shrink-0 items-center justify-center">{action.icon}</div>
								<span className="font-medium text-foreground/90 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary">
									<HighlightMatch text={action.label} query={search} />
								</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{/* Global search fallback */}
				{isSearching && (
					<CommandGroup heading="Global">
						<CommandItem onSelect={() => runCommand(searchMV)}>
							<div className="flex h-8 w-8 items-center justify-center">
								<ExternalLink className="h-4 w-4 text-muted-foreground/70" />
							</div>
							<span className="font-medium text-foreground/90">Buscar "{search}" en Google/MV</span>
						</CommandItem>
					</CommandGroup>
				)}
			</CommandList>
		</CommandDialog>
	)
}
