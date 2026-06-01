/**
 * App Sidebar - Dashboard Navigation with Collapsible Menus
 * Uses React Router for SPA navigation within the options page
 * Based on Shadcn sidebar-08 pattern
 */
import { useState, useEffect, type MouseEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import Home from 'lucide-react/dist/esm/icons/home'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Gift from 'lucide-react/dist/esm/icons/gift'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import ListFilter from 'lucide-react/dist/esm/icons/list-filter'
import StickyNote from 'lucide-react/dist/esm/icons/sticky-note'
import Layout from 'lucide-react/dist/esm/icons/layout'
import Palette from 'lucide-react/dist/esm/icons/palette'
import { getDrafts, draftsStorage } from '@/features/drafts/storage'
import { getContentRules, watchContentRules } from '@/features/content-rules'
import { getHiddenThreads, watchHiddenThreads } from '@/features/hidden-threads/logic/storage'
import { getHiddenSubforums, watchHiddenSubforums } from '@/features/hidden-subforums/logic/storage'
import { getUserCustomizations, watchUserCustomizations } from '@/features/user-customizations/storage'
import { useSettingsStore } from '@/store/settings-store'
import { CommandMenu } from '@/features/command-menu/components/command-menu'
import { CommandMenuTrigger } from '@/features/command-menu/components/command-menu-trigger'
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarFooter,
} from '@/components/ui/sidebar'
import { browser } from 'wxt/browser'

interface NavItem {
	title: string
	path: string
	defaultPath?: string
	icon: LucideIcon
	badgeKey?: keyof SidebarCounts
	items?: {
		title: string
		path: string
		badgeKey?: keyof SidebarCounts
	}[]
}

interface SidebarCounts {
	drafts: number
	templates: number
	muted: number
	hidden: number
	hiddenSubforums: number
	contentRules: number
	customizedUsers: number
}

const platformItems: NavItem[] = [
	{
		title: 'Inicio',
		path: '/',
		icon: Home,
	},
	{
		title: 'Mis Borradores',
		path: '/drafts',
		icon: StickyNote,
		badgeKey: 'drafts',
	},
	{
		title: 'Mis Plantillas',
		path: '/templates',
		icon: Layout,
		badgeKey: 'templates',
	},

	{
		title: 'Ranking Subforos',
		path: '/subforums',
		icon: Trophy,
	},
	{
		title: 'Filtros',
		path: '/filters',
		defaultPath: '/filters?tab=threads',
		icon: ListFilter,
		badgeKey: 'contentRules',
		items: [
			{ title: 'Reglas de hilos', path: '/filters?tab=threads', badgeKey: 'contentRules' },
			{ title: 'Palabras', path: '/filters?tab=words', badgeKey: 'muted' },
			{ title: 'Usuarios', path: '/filters?tab=users', badgeKey: 'customizedUsers' },
			{ title: 'Hilos ocultos', path: '/filters?tab=hidden-threads', badgeKey: 'hidden' },
			{ title: 'Subforos ocultos', path: '/filters?tab=hidden-subforums', badgeKey: 'hiddenSubforums' },
		],
	},
]

const settingsItems: NavItem[] = [
	{
		title: 'Tema de Mediavida',
		path: '/mv-theme',
		icon: Palette,
	},
	{
		title: 'Ajustes',
		path: '/settings',
		icon: Settings,
	},
	{
		title: 'Novedades',
		path: '/whats-new',
		icon: Gift,
	},
]

/**
 * AppSidebar component - Provides the main navigation menu for the dashboard
 * Includes sections for Platform, Settings, and Novedades (What's New)
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const location = useLocation()
	const [commandOpen, setCommandOpen] = useState(false)
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
	const [counts, setCounts] = useState<SidebarCounts>({
		drafts: 0,
		templates: 0,
		muted: 0,
		hidden: 0,
		hiddenSubforums: 0,
		contentRules: 0,
		customizedUsers: 0,
	})

	// Keyboard shortcut for command menu (Ctrl+K / Cmd+K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setCommandOpen(open => !open)
			}
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Load counts and setup listeners
	useEffect(() => {
		const loadDrafts = async () => {
			const d = await getDrafts()
			// Count drafts and templates separately
			const draftsCount = d.filter(item => item.type !== 'template').length
			const templatesCount = d.filter(item => item.type === 'template').length
			setCounts(prev => ({ ...prev, drafts: draftsCount, templates: templatesCount }))
		}

		const loadMuted = () => {
			const m = useSettingsStore.getState().mutedWords.length
			setCounts(prev => ({ ...prev, muted: m }))
		}

		const loadHidden = async () => {
			const hiddenThreads = await getHiddenThreads()
			setCounts(prev => ({ ...prev, hidden: hiddenThreads.length }))
		}

		const loadHiddenSubforums = async () => {
			const hiddenSubforums = await getHiddenSubforums()
			setCounts(prev => ({ ...prev, hiddenSubforums: hiddenSubforums.length }))
		}

		const loadContentRules = async () => {
			const rules = await getContentRules()
			setCounts(prev => ({ ...prev, contentRules: rules.length }))
		}

		const loadCustomizedUsers = async () => {
			const data = await getUserCustomizations()
			setCounts(prev => ({ ...prev, customizedUsers: Object.keys(data.users).length }))
		}

		// Initial load
		loadDrafts()
		loadMuted()
		void loadHidden()
		void loadHiddenSubforums()
		void loadContentRules()
		void loadCustomizedUsers()

		// Listeners
		const unwatchDrafts = draftsStorage.watch(() => loadDrafts())
		const unwatchSettings = useSettingsStore.subscribe(state => {
			setCounts(prev => ({ ...prev, muted: state.mutedWords.length }))
		})
		const unwatchHidden = watchHiddenThreads(hiddenThreads => {
			setCounts(prev => ({ ...prev, hidden: hiddenThreads.length }))
		})
		const unwatchHiddenSubforums = watchHiddenSubforums(hiddenSubforums => {
			setCounts(prev => ({ ...prev, hiddenSubforums: hiddenSubforums.length }))
		})
		const unwatchContentRules = watchContentRules(rules => {
			setCounts(prev => ({ ...prev, contentRules: rules.length }))
		})
		const unwatchUserCustomizations = watchUserCustomizations(data => {
			setCounts(prev => ({ ...prev, customizedUsers: Object.keys(data.users).length }))
		})

		return () => {
			unwatchDrafts()
			unwatchSettings()
			unwatchHidden()
			unwatchHiddenSubforums()
			unwatchContentRules()
			unwatchUserCustomizations()
		}
	}, [])

	const isActive = (path: string) => {
		if (path === '/') {
			return location.pathname === '/'
		}
		// Handle hash routes (e.g., /settings#editor)
		if (path.includes('#')) {
			return location.pathname + location.hash === path
		}
		if (path.includes('?')) {
			return location.pathname + location.search === path
		}
		return location.pathname.startsWith(path)
	}

	const getItemCount = (item: NavItem) => {
		if (item.items) {
			return item.items.reduce((total, subItem) => total + (subItem.badgeKey ? counts[subItem.badgeKey] : 0), 0)
		}
		return item.badgeKey ? counts[item.badgeKey] : 0
	}

	const hasActiveChild = (item: NavItem) => {
		if (!item.items) return false
		return item.items.some(subItem => isActive(subItem.path))
	}

	useEffect(() => {
		setCollapsedGroups(current => {
			let changed = false
			const next = new Set(current)
			for (const item of platformItems) {
				if (item.items && location.pathname !== item.path && next.delete(item.path)) {
					changed = true
				}
			}
			return changed ? next : current
		})
	}, [location.pathname])

	const handleItemClick = (event: MouseEvent<HTMLAnchorElement>, item: NavItem, isGroupActive: boolean) => {
		if (!item.items) return
		if (!isGroupActive) {
			setCollapsedGroups(current => {
				if (!current.has(item.path)) return current
				const next = new Set(current)
				next.delete(item.path)
				return next
			})
			return
		}

		event.preventDefault()
		setCollapsedGroups(current => {
			const next = new Set(current)
			if (next.has(item.path)) next.delete(item.path)
			else next.add(item.path)
			return next
		})
	}

	return (
		<Sidebar variant="inset" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<Link to="/">
								<div className="flex aspect-square h-9 w-9 items-center justify-center rounded-lg overflow-hidden">
									<img src="/icon/128.png" alt="Logo" className="h-7 w-7 object-contain" />
								</div>
								<div className="grid flex-1 text-left text-sm leading-tight pl-2 pt-0.5">
									<span className="truncate font-black text-lg tracking-tighter leading-none mb-0.5 uppercase italic">
										MV <span className="text-primary tracking-normal not-italic">Premium</span>
									</span>
									<span className="truncate text-[9px] text-muted-foreground uppercase font-bold tracking-[0.25em] opacity-70">
										Dashboard
									</span>
								</div>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>

				<div className="px-2 pb-2">
					<CommandMenuTrigger onClick={() => setCommandOpen(true)} />
				</div>
			</SidebarHeader>

			<CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Plataforma</SidebarGroupLabel>
					<SidebarMenu>
						{platformItems.map(item => {
							const active = isActive(item.path)
							const groupActive = active || hasActiveChild(item)
							const groupExpanded = Boolean(item.items && groupActive && !collapsedGroups.has(item.path))
							const itemCount = getItemCount(item)
							return (
								<SidebarMenuItem key={item.path}>
									<SidebarMenuButton
										asChild
										tooltip={item.title}
										isActive={active}
										className={cn(active && 'text-primary font-bold')}
									>
										<Link
											to={item.defaultPath ?? item.path}
											onClick={event => handleItemClick(event, item, groupActive)}
											className="flex justify-between items-center w-full group/item"
										>
											<div className="flex items-center gap-2">
												<item.icon className={cn('h-4 w-4', active && '!text-primary')} />
												<span className={cn(active && '!text-primary')}>{item.title}</span>
											</div>
											<div className="ml-auto flex items-center gap-1">
												{item.items && (
													<ChevronDown
														className={cn(
															'h-3.5 w-3.5 text-muted-foreground transition-transform',
															groupExpanded ? 'rotate-0' : '-rotate-90'
														)}
													/>
												)}
												{itemCount > 0 && (
													<span
														className={cn(
															'flex items-center justify-center text-[10px] font-bold h-5 w-5 rounded-full shrink-0 shadow-sm transition-colors',
															active
																? 'bg-primary text-primary-foreground'
																: 'bg-muted text-muted-foreground group-hover/item:bg-primary group-hover/item:text-primary-foreground'
														)}
													>
														{itemCount}
													</span>
												)}
											</div>
										</Link>
									</SidebarMenuButton>
									{item.items && groupExpanded && (
										<div className="ml-7 mt-1 flex flex-col gap-1 border-l border-sidebar-border/60 pl-2">
											{item.items.map(subItem => {
												const subActive = isActive(subItem.path)
												const subCount = subItem.badgeKey ? counts[subItem.badgeKey] : 0
												return (
													<Link
														key={subItem.path}
														to={subItem.path}
														className={cn(
															'flex min-h-7 items-center justify-between gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
															subActive && 'bg-sidebar-accent text-primary font-semibold'
														)}
													>
														<span className="truncate">{subItem.title}</span>
														{subCount > 0 && (
															<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-bold text-muted-foreground">
																{subCount}
															</span>
														)}
													</Link>
												)
											})}
										</div>
									)}
								</SidebarMenuItem>
							)
						})}
					</SidebarMenu>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Configuración</SidebarGroupLabel>
					<SidebarMenu>
						{settingsItems.map(item => {
							const active = isActive(item.path)
							return (
								<SidebarMenuItem key={item.path}>
									<SidebarMenuButton
										asChild
										tooltip={item.title}
										isActive={active}
										className={cn(active && 'text-primary font-bold')}
									>
										<Link to={item.path}>
											<item.icon className={cn('h-4 w-4', active && '!text-primary')} />
											<span className={cn(active && '!text-primary')}>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="p-4 border-t border-sidebar-border/50">
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between text-[10px] text-muted-foreground/60 font-mono">
						<span>Mediavida Premium</span>
						<span>v{browser.runtime.getManifest().version}</span>
					</div>
				</div>
			</SidebarFooter>
		</Sidebar>
	)
}
