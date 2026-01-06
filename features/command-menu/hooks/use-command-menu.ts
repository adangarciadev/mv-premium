/**
 * useCommandMenu Hook
 * Manages state and data loading for the command menu
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { logger } from '@/lib/logger'
import { browser } from 'wxt/browser'
import { getSettings } from '@/store/settings-store'
import { ALL_SUBFORUMS } from '@/lib/subforums'
import { getCurrentUsername, matchesQuery, getPageContext, navigateTo, openDashboard } from '../utils'
import type { SavedThread } from '@/features/saved-threads/logic/storage'
import type { Draft } from '@/features/drafts/storage'
import type { FavoriteSubforum } from '@/features/favorite-subforums/logic/storage'
import type { FilteredData, CommandAction } from '../types'

// Icons for searchable actions
import SettingsIcon from 'lucide-react/dist/esm/icons/settings'
import User from 'lucide-react/dist/esm/icons/user'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Home from 'lucide-react/dist/esm/icons/home'
import Eye from 'lucide-react/dist/esm/icons/eye'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import Pin from 'lucide-react/dist/esm/icons/pin'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Layout from 'lucide-react/dist/esm/icons/layout'
import SunMoon from 'lucide-react/dist/esm/icons/sun-moon'
import Bookmark from 'lucide-react/dist/esm/icons/bookmark'
import { STORAGE_KEYS, getSearchUrl } from '@/constants'
import React from 'react'

interface UseCommandMenuOptions {
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

interface UseCommandMenuReturn {
	// State
	open: boolean
	setOpen: (open: boolean) => void
	search: string
	setSearch: (search: string) => void
	loading: boolean
	shortcuts: Record<string, string | null>
	username: string | null
	contextLabel: string

	// Page context
	isDashboard: boolean
	isSearching: boolean

	// Data
	savedThreads: SavedThread[]
	drafts: Draft[]
	templates: Draft[]
	favorites: FavoriteSubforum[]
	filteredData: FilteredData

	// Actions
	runCommand: (command: () => void) => void
	goTo: (path: string) => void
	searchMV: () => void
	getShortcut: (actionInfo: string) => string | undefined
}

/**
 * Icon class for consistent styling
 */
const iconClass =
	'h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary group-data-[selected=true]:text-primary'

export function useCommandMenu({
	open: controlledOpen,
	onOpenChange: setControlledOpen,
}: UseCommandMenuOptions): UseCommandMenuReturn {
	// Controlled vs uncontrolled mode
	const isControlled = controlledOpen !== undefined && setControlledOpen !== undefined
	const [internalOpen, setInternalOpen] = useState(false)
	const open = isControlled ? controlledOpen : internalOpen
	const setOpen = isControlled ? setControlledOpen : setInternalOpen

	// State
	const [search, setSearch] = useState('')
	const [loading, setLoading] = useState(false)
	const [shortcuts, setShortcuts] = useState<Record<string, string | null>>({})
	const [username, setUsername] = useState<string | null>(null)
	const [contextLabel, setContextLabel] = useState<string>('Mediavida')

	// Data state
	const [savedThreads, setSavedThreads] = useState<SavedThread[]>([])
	const [templates, setTemplates] = useState<Draft[]>([])
	const [drafts, setDrafts] = useState<Draft[]>([])
	const [favorites, setFavorites] = useState<FavoriteSubforum[]>([])

	// Page context
	const pageContext = getPageContext()
	const { isDashboard, isSubforum, isThread, isMessages } = pageContext
	const isSearching = search.trim().length > 0

	// Listen for external trigger events
	useEffect(() => {
		const handleOpen = () => setOpen(true)
		window.addEventListener('mvp:open-command-menu', handleOpen)

		// Load shortcuts settings
		getSettings().then(settings => {
			if (settings.shortcuts) {
				setShortcuts(settings.shortcuts)
			}
		})

		return () => window.removeEventListener('mvp:open-command-menu', handleOpen)
	}, [setOpen])

	// Sync username
	useEffect(() => {
		const domUser = getCurrentUsername()
		if (domUser) {
			setUsername(domUser)
			browser.storage.local
				.set({ cachedUsername: domUser })
				.catch(err => logger.error('Failed to cache username:', err))
		} else {
			browser.storage.local.get('cachedUsername').then(res => {
				if (res.cachedUsername) {
					setUsername(res.cachedUsername as string)
				}
			})
		}
	}, [])

	// Load data when menu opens
	useEffect(() => {
		if (open) {
			setLoading(true)

			Promise.all([
				import('@/features/saved-threads/logic/storage'),
				import('@/features/drafts/storage'),
				import('@/features/favorite-subforums/logic/storage'),
			])
				.then(async ([savedThreadsModule, draftsModule, favoritesModule]) => {
					const [threads, tmpls, allDrafts, favs] = await Promise.all([
						savedThreadsModule.getSavedThreads(),
						draftsModule.getTemplates(),
						draftsModule.getDrafts(),
						favoritesModule.getFavoriteSubforums(),
					])

					setSavedThreads(threads)
					setTemplates(tmpls)
					setDrafts(allDrafts.filter(d => d.type === 'draft'))
					setFavorites(favs)
				})
				.finally(() => setLoading(false))
		}
	}, [open])

	// Determine context label
	useEffect(() => {
		if (open) {
			if (isDashboard) {
				setContextLabel('Panel Premium')
			} else if (isMessages) {
				setContextLabel('Mensajes')
			} else if (isSubforum || isThread) {
				const pathParts = window.location.pathname.split('/')
				const slug = pathParts[2]
				const found = ALL_SUBFORUMS.find(s => s.slug === slug)

				if (found) {
					setContextLabel(found.name)
				} else {
					setContextLabel(slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Foro')
				}
			} else {
				setContextLabel('General')
			}
		}
	}, [open, isDashboard, isMessages, isSubforum, isThread])

	// Navigation helper
	const goTo = useCallback(
		(path: string) => {
			navigateTo(path, isDashboard)
		},
		[isDashboard]
	)

	// Run command and close menu
	const runCommand = useCallback(
		(command: () => void) => {
			setOpen(false)
			setSearch('')
			command()
		},
		[setOpen]
	)

	// Search on Mediavida
	const searchMV = useCallback(() => {
		if (search.trim()) {
			const searchUrl = getSearchUrl(search)
			if (isDashboard) {
				window.open(searchUrl, '_blank')
			} else {
				goTo(searchUrl)
			}
		}
	}, [search, isDashboard, goTo])

	// Get shortcut for action
	const getShortcut = useCallback((actionInfo: string) => shortcuts[actionInfo] || undefined, [shortcuts])

	// Searchable actions
	const searchableActions = useMemo((): CommandAction[] => {
		const actions: CommandAction[] = [
			{
				key: 'home',
				label: 'Ir a portada',
				action: () => goTo('/'),
				icon: React.createElement(Home, { className: iconClass }),
				category: 'NAVEGACIÓN MV',
			},
			{
				key: 'spy',
				label: 'Spy (Lo último)',
				action: () => goTo('/foro/spy'),
				icon: React.createElement(Eye, { className: iconClass }),
				category: 'NAVEGACIÓN MV',
			},
			{
				key: 'subforums',
				label: 'Subforos',
				action: () => goTo('/foro'),
				icon: React.createElement(BookOpen, { className: iconClass }),
				category: 'NAVEGACIÓN MV',
			},
			{
				key: 'mp',
				label: 'Mensajes privados',
				action: () => goTo('/mensajes'),
				icon: React.createElement(MessageSquare, { className: iconClass }),
				category: 'NAVEGACIÓN MV',
			},
		]

		if (username) {
			actions.push(
				{
					key: 'saved',
					label: 'Mis hilos guardados',
					action: () => goTo(`/id/${username}/temas#guardados`),
					icon: React.createElement(Bookmark, { className: iconClass }),
					category: 'NAVEGACIÓN MV',
				},
				{
					key: 'anclados',
					label: 'Posts Anclados',
					action: () => goTo(`/id/${username}/temas#anclados`),
					icon: React.createElement(Pin, { className: iconClass }),
					category: 'NAVEGACIÓN MV',
				},
				{
					key: 'profile',
					label: 'Mi Perfil',
					action: () => goTo(`/id/${username}`),
					icon: React.createElement(User, { className: iconClass }),
					category: 'NAVEGACIÓN MV',
				}
			)
		}

		actions.push(
			{
				key: 'panel',
				label: 'Panel de Control (Ajustes)',
				action: () => openDashboard(),
				icon: React.createElement(SettingsIcon, { className: iconClass }),
				category: 'MVP PANEL',
			},
			{
				key: 'new-draft',
				label: 'Crear Nuevo Borrador',
				action: () => openDashboard('drafts/new'),
				icon: React.createElement(Plus, { className: iconClass }),
				category: 'MVP PANEL',
			},
			{
				key: 'new-template',
				label: 'Crear Nueva Plantilla',
				action: () => openDashboard('templates/new'),
				icon: React.createElement(Layout, { className: iconClass }),
				category: 'MVP PANEL',
			},
			{
				key: 'drafts-list',
				label: 'Mis Borradores',
				action: () => openDashboard('drafts'),
				icon: React.createElement(FileText, { className: iconClass }),
				category: 'MVP PANEL',
			},
			{
				key: 'templates-list',
				label: 'Mis Plantillas',
				action: () => openDashboard('templates'),
				icon: React.createElement(Layout, { className: iconClass }),
				category: 'MVP PANEL',
			},
			{
				key: 'theme',
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
				icon: React.createElement(SunMoon, { className: iconClass }),
				category: 'MVP PANEL',
			}
		)

		return actions
	}, [username, goTo])

	// Filter data based on search
	const filteredData = useMemo((): FilteredData => {
		const q = search.toLowerCase()

		// Favorites & Subforums
		const matchedFavorites = favorites.filter(f => matchesQuery(f.name, q))
		const favIds = new Set(favorites.map(f => f.id))
		const matchedSubforums = ALL_SUBFORUMS.filter(s => matchesQuery(s.name, q) && !favIds.has(s.slug)).slice(0, 10)

		// Saved Threads
		const matchedThreads = savedThreads.filter(t => matchesQuery(t.title, q)).slice(0, 5)

		// Drafts & Templates
		const matchedDrafts = drafts.filter(d => matchesQuery(d.title || '', q) || matchesQuery(d.content, q)).slice(0, 3)
		const matchedTemplates = templates.filter(t => matchesQuery(t.title, q)).slice(0, 3)

		// Actions
		const matchedActions = searchableActions.filter(a => matchesQuery(a.label, q))

		return {
			favorites: matchedFavorites,
			subforums: matchedSubforums,
			threads: matchedThreads,
			drafts: matchedDrafts,
			templates: matchedTemplates,
			actions: matchedActions,
		}
	}, [search, favorites, savedThreads, drafts, templates, searchableActions])

	return {
		open,
		setOpen,
		search,
		setSearch,
		loading,
		shortcuts,
		username,
		contextLabel,
		isDashboard,
		isSearching,
		savedThreads,
		drafts,
		templates,
		favorites,
		filteredData,
		runCommand,
		goTo,
		searchMV,
		getShortcut,
	}
}
