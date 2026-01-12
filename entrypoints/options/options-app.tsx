/**
 * Options Page App
 * Main application component with React Router routes
 */
import { Routes, Route, useLocation, Link, Navigate } from 'react-router-dom'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '../../components/app-sidebar'
import { cn } from '@/lib/utils'
import Home from 'lucide-react/dist/esm/icons/home'
import Eye from 'lucide-react/dist/esm/icons/eye'
import User from 'lucide-react/dist/esm/icons/user'
import { getCurrentUser, type CurrentUser } from './lib/current-user'
import { MV_BASE_URL, MV_URLS, getUserProfileUrl } from '@/constants'
import { useState, useEffect } from 'react'
import { ModeToggle } from '@/components/mode-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// Views
import { HomeView } from './views/home-view'
import { SubforumsView } from './views/subforums-view'
import { DraftsView } from './views/drafts-view'
import { DraftEditorView } from './views/draft-editor-view'
import { UsersView } from './views/users-view'
import { SettingsView } from './views/settings-view'
import MutedPostsView from './views/muted-posts-view'
import { WhatsNewView } from './views/whats-new-view'
import React from 'react'

/**
 * Route configuration for breadcrumb generation
 */
const routeLabels: Record<string, string> = {
	'': 'Inicio',

	drafts: 'Borradores',
	templates: 'Plantillas',
	'muted-posts': 'Palabras Silenciadas',
	favorites: 'Subforos Favoritos',
	subforums: 'Subforos',
	users: 'Usuarios',
	settings: 'Ajustes',

	'whats-new': 'Novedades',
	shortcuts: 'Atajos de Teclado',
}

/**
 * Dynamic Breadcrumb component that reads current route
 */
function DynamicBreadcrumb() {
	const location = useLocation()
	const pathSegments = location.pathname.split('/').filter(Boolean)

	// Build breadcrumb items from path segments
	const breadcrumbItems = pathSegments.map((segment: string, index: number) => {
		const path = '/' + pathSegments.slice(0, index + 1).join('/')
		const isLast = index === pathSegments.length - 1
		// Handle dynamic segments like :id
		const label = segment.match(/^[0-9a-f-]+$/i) ? 'Editar' : routeLabels[segment] || segment

		return { path, label, isLast }
	})

	return (
		<Breadcrumb>
			<BreadcrumbList>
				{/* Always show Inicio as first item */}
				<BreadcrumbItem className="hidden md:block">
					{pathSegments.length === 0 ? (
						<BreadcrumbPage>Dashboard</BreadcrumbPage>
					) : (
						<BreadcrumbLink asChild>
							<Link to="/">Dashboard</Link>
						</BreadcrumbLink>
					)}
				</BreadcrumbItem>

				{breadcrumbItems.map((item: { path: string; label: string; isLast: boolean }, index: number) => (
					<React.Fragment key={item.path}>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							{item.isLast ? (
								<BreadcrumbPage>{item.label}</BreadcrumbPage>
							) : (
								<BreadcrumbLink asChild>
									<Link to={item.path}>{item.label}</Link>
								</BreadcrumbLink>
							)}
						</BreadcrumbItem>
					</React.Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

/**
 * Quick navigation buttons to go back to Mediavida
 */
function QuickNavButtons() {
	const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

	useEffect(() => {
		getCurrentUser().then(setCurrentUser)
	}, [])

	const displayName = currentUser?.username || 'Usuario'
	const avatarUrl = currentUser?.avatarUrl || ''
	const avatarInitials = displayName.slice(0, 2).toUpperCase()

	return (
		<div className="flex items-center gap-1">
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 text-muted-foreground hover:text-foreground"
							onClick={() => window.open(MV_BASE_URL, '_blank')}
						>
							<Home className="h-4 w-4" />
							<span className="sr-only">Mediavida</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Mediavida</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 text-muted-foreground hover:text-foreground"
							onClick={() => window.open(MV_URLS.SPY, '_blank')}
						>
							<Eye className="h-4 w-4" />
							<span className="sr-only">Spy</span>
						</Button>
					</TooltipTrigger>
					<TooltipContent>Spy</TooltipContent>
				</Tooltip>

				<Separator orientation="vertical" className="mx-1 h-4" />

				<div className="flex items-center gap-2 pl-1">
					<ModeToggle />
					<Tooltip>
						<TooltipTrigger asChild>
							<Avatar
								className="h-8 w-8 rounded-md cursor-pointer hover:ring-2 hover:ring-sidebar-ring transition-all"
								onClick={() =>
									currentUser && window.open(`https://www.mediavida.com/id/${currentUser.username}`, '_blank')
								}
							>
								<AvatarImage src={avatarUrl} alt={displayName} />
								<AvatarFallback className="rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-[10px] font-bold">
									{avatarInitials}
								</AvatarFallback>
							</Avatar>
						</TooltipTrigger>
						<TooltipContent>{displayName}</TooltipContent>
					</Tooltip>
				</div>
			</TooltipProvider>
		</div>
	)
}

import { initGlobalThemeListener } from '@/lib/theme/injector'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/query-client'

export default function OptionsApp() {
	const location = useLocation()
	
	// Initialize global theme listener (font, radius, colors)
	useEffect(() => {
		const cleanup = initGlobalThemeListener()
		return cleanup
	}, [])

	const isEditorView =
		location.pathname.includes('/drafts/new') ||
		location.pathname.includes('/drafts/edit') ||
		location.pathname.includes('/templates/new') ||
		location.pathname.includes('/templates/edit')

	return (
		<QueryClientProvider client={queryClient}>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					{/* Header with trigger and breadcrumb */}
					<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
						<DynamicBreadcrumb />

						{/* Spacer */}
						<div className="flex-1" />

						{/* Quick navigation to Mediavida */}
						<QuickNavButtons />
					</header>

					{/* Main content area with routes - constrained width for readability */}
					<main className="flex-1 overflow-auto p-6">
						<div className={cn('w-full mx-auto transition-all duration-300', isEditorView ? 'max-w-[1600px]' : 'max-w-7xl')}>
							<Routes>
								<Route path="/" element={<HomeView />} />
								<Route path="/subforums" element={<SubforumsView />} />
								{/* Borradores */}
								<Route path="/drafts" element={<DraftsView filterType="draft" />} />
								<Route path="/drafts/new" element={<DraftEditorView docType="draft" />} />
								<Route path="/drafts/edit/:id" element={<DraftEditorView docType="draft" />} />
								{/* Plantillas */}
								<Route path="/templates" element={<DraftsView filterType="template" />} />
								<Route path="/templates/new" element={<DraftEditorView docType="template" />} />
								<Route path="/templates/edit/:id" element={<DraftEditorView docType="template" />} />
								{/* Otros */}
								<Route path="/muted-posts" element={<MutedPostsView />} />
								<Route path="/users" element={<UsersView />} />
								<Route path="/settings" element={<SettingsView />} />

								<Route path="/whats-new" element={<WhatsNewView />} />
								<Route path="/shortcuts" element={<Navigate to="/settings?tab=shortcuts" replace />} />
							</Routes>
						</div>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</QueryClientProvider>
	)
}
