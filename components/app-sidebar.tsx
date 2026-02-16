/**
 * App Sidebar - Dashboard Navigation with Collapsible Menus
 * Uses React Router for SPA navigation within the options page
 * Based on Shadcn sidebar-08 pattern
 */
import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import Home from 'lucide-react/dist/esm/icons/home'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Gift from 'lucide-react/dist/esm/icons/gift'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import Users from 'lucide-react/dist/esm/icons/users'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import StickyNote from 'lucide-react/dist/esm/icons/sticky-note'
import Layout from 'lucide-react/dist/esm/icons/layout'
import Palette from 'lucide-react/dist/esm/icons/palette'
import { getDrafts, draftsStorage } from '@/features/drafts/storage'
import { getHiddenThreads, watchHiddenThreads } from '@/features/hidden-threads/logic/storage'
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
		title: 'Palabras Silenciadas',
		path: '/muted-posts',
		icon: VolumeX,
		badgeKey: 'muted',
	},
	{
		title: 'Hilos Ocultos',
		path: '/hidden-threads',
		icon: EyeOff,
		badgeKey: 'hidden',
	},
	{
		title: 'Usuarios',
		path: '/users',
		icon: Users,
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
	const [counts, setCounts] = useState<SidebarCounts>({
		drafts: 0,
		templates: 0,
		muted: 0,
		hidden: 0,
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

		// Initial load
		loadDrafts()
		loadMuted()
		void loadHidden()

		// Listeners
		const unwatchDrafts = draftsStorage.watch(() => loadDrafts())
		const unwatchSettings = useSettingsStore.subscribe(state => {
			setCounts(prev => ({ ...prev, muted: state.mutedWords.length }))
		})
		const unwatchHidden = watchHiddenThreads(hiddenThreads => {
			setCounts(prev => ({ ...prev, hidden: hiddenThreads.length }))
		})

		return () => {
			unwatchDrafts()
			unwatchSettings()
			unwatchHidden()
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
		return location.pathname.startsWith(path)
	}

	const hasActiveChild = (item: NavItem) => {
		if (!item.items) return false
		return item.items.some(subItem => isActive(subItem.path))
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
							return (
								<SidebarMenuItem key={item.path}>
									<SidebarMenuButton
										asChild
										tooltip={item.title}
										isActive={active}
										className={cn(active && 'text-primary font-bold')}
									>
										<Link to={item.path} className="flex justify-between items-center w-full group/item">
											<div className="flex items-center gap-2">
												<item.icon className={cn('h-4 w-4', active && '!text-primary')} />
												<span className={cn(active && '!text-primary')}>{item.title}</span>
											</div>
											{item.badgeKey && counts[item.badgeKey] > 0 && (
												<span
													className={cn(
														'flex items-center justify-center text-[10px] font-bold h-5 w-5 rounded-full shrink-0 shadow-sm transition-colors',
														active
															? 'bg-primary text-primary-foreground'
															: 'bg-muted text-muted-foreground group-hover/item:bg-primary group-hover/item:text-primary-foreground'
													)}
												>
													{counts[item.badgeKey]}
												</span>
											)}
										</Link>
									</SidebarMenuButton>
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
