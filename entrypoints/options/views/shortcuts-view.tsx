import React, { useState, useEffect, useRef } from 'react'
import User from 'lucide-react/dist/esm/icons/user'
import Star from 'lucide-react/dist/esm/icons/star'
import Bookmark from 'lucide-react/dist/esm/icons/bookmark'
import Pin from 'lucide-react/dist/esm/icons/pin'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Home from 'lucide-react/dist/esm/icons/home'
import X from 'lucide-react/dist/esm/icons/x'
import Keyboard from 'lucide-react/dist/esm/icons/keyboard'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Plus from 'lucide-react/dist/esm/icons/plus'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Layout from 'lucide-react/dist/esm/icons/layout'
import SettingsIcon from 'lucide-react/dist/esm/icons/settings'
import SunMoon from 'lucide-react/dist/esm/icons/sun-moon'
import { useSettingsStore } from '@/store/settings-store'
import type { Settings } from '@/store/settings-types'
import { cn } from '@/lib/utils'
import { Kbd } from '@/components/ui/kbd'

// Action definitions
const SHORTCUT_ACTIONS = [
	{ id: 'profile', label: 'Mi Perfil', icon: User, description: 'Ir a tu perfil de usuario' },
	{ id: 'messages', label: 'Mensajes Privados', icon: MessageSquare, description: 'Ir a tu bandeja de entrada' },
	{ id: 'subforums', label: 'Subforos', icon: Star, description: 'Ir al índice de foros' },
	{ id: 'favorite_threads', label: 'Threads Favoritos', icon: Star, description: 'Tus hilos favoritos' },
	{ id: 'bookmarks', label: 'Marcadores', icon: Bookmark, description: 'Tus marcadores guardados' },
	{ id: 'saved', label: 'Threads Guardados', icon: Folder, description: 'Hilos guardados localmente' },
	{ id: 'pinned', label: 'Posts Anclados', icon: Pin, description: 'Posts anclados en tu perfil' },
	{ id: 'spy', label: 'Spy', icon: Eye, description: 'Lo último en Mediavida' },
	{ id: 'home', label: 'Portada', icon: Home, description: 'Ir a la página principal' },
	{ id: 'new-draft', label: 'Crear Borrador', icon: Plus, description: 'Abrir editor de nuevo borrador' },
	{ id: 'new-template', label: 'Crear Plantilla', icon: Layout, description: 'Crear una nueva plantilla' },
	{ id: 'drafts', label: 'Mis Borradores', icon: FileText, description: 'Ver lista de borradores' },
	{ id: 'templates', label: 'Mis Plantillas', icon: Layout, description: 'Ver lista de plantillas' },
	{ id: 'panel', label: 'Panel de Control', icon: SettingsIcon, description: 'Abrir configuración de la extensión' },
	{ id: 'theme-toggle', label: 'Alternar Tema', icon: SunMoon, description: 'Cambiar entre modo claro/oscuro' },
]

export function ShortcutsView() {
	const shortcuts = useSettingsStore(state => state.shortcuts)
	const setShortcut = useSettingsStore(state => state.setShortcut)

	return (
		<div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
			{/* Header */}
			<div className="space-y-2 mb-8">
				<h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
					Atajos de Teclado
				</h2>
				<p className="text-muted-foreground text-lg font-light">
					Navega por Mediavida y el panel de control a la velocidad de la luz.
				</p>
			</div>

			{/* Info Card - Improved Visuals */}
			<div className="relative overflow-hidden bg-card border border-border rounded-lg p-6 shadow-sm flex flex-col sm:flex-row gap-5 items-start sm:items-center">
				<div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/50" />

				<div className="bg-primary/10 p-3 rounded-full shrink-0 text-primary ring-1 ring-primary/20">
					<Keyboard className="h-6 w-6" />
				</div>

				<div className="space-y-1.5 flex-1">
					<p className="font-semibold text-foreground tracking-tight flex items-center gap-2">
						Funcionamiento Global Inteligente
					</p>
					<p className="text-muted-foreground leading-relaxed text-sm md:text-base">
						Los atajos están activos en <strong className="text-foreground">todas las páginas</strong>.
						<span className="block mt-1 text-xs opacity-80">
							No te preocupes al escribir: se desactivan automáticamente en cajas de texto.
						</span>
					</p>
				</div>
			</div>

			{/* Configuration List */}
			<div className="grid gap-3">
				{SHORTCUT_ACTIONS.map(action => (
					<div
						key={action.id}
						className="group relative flex items-center justify-between p-4 rounded-lg border border-border/40 bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow-md"
					>
						<div className="flex items-center gap-5">
							<div
								className={cn(
									'h-11 w-11 rounded-md flex items-center justify-center transition-all duration-300 shadow-sm ring-1 ring-inset ring-white/5',
									shortcuts[action.id]
										? 'bg-primary/15 text-primary ring-primary/20'
										: 'bg-secondary/40 text-muted-foreground group-hover:bg-secondary/60 group-hover:text-foreground'
								)}
							>
								<action.icon className="h-5 w-5" strokeWidth={2} />
							</div>
							<div>
								<span
									className={cn(
										'font-semibold block text-base md:text-lg tracking-tight transition-colors',
										shortcuts[action.id] ? 'text-foreground' : 'text-foreground/80 group-hover:text-foreground'
									)}
								>
									{action.label}
								</span>
								<span className="text-xs md:text-sm text-muted-foreground hidden sm:block font-normal opacity-50">
									{action.description}
								</span>
							</div>
						</div>

						<div className="flex items-center">
							<ShortcutRecorder
								value={shortcuts[action.id] || null}
								onChange={combo => setShortcut(action.id, combo)}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function ShortcutRecorder({ value, onChange }: { value: string | null; onChange: (combo: string | null) => void }) {
	const [isRecording, setIsRecording] = useState(false)
	const buttonRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!isRecording) return

		const handleKeyDown = (e: KeyboardEvent) => {
			e.preventDefault()
			e.stopPropagation()

			// Ignore standalone modifier keys
			if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

			// Escape to cancel
			if (e.key === 'Escape') {
				setIsRecording(false)
				return
			}

			// Backspace/Delete to clear
			if (e.key === 'Backspace' || e.key === 'Delete') {
				onChange(null)
				setIsRecording(false)
				return
			}

			// Build combo string
			const modifiers = []
			if (e.ctrlKey) modifiers.push('Ctrl')
			if (e.altKey) modifiers.push('Alt')
			if (e.shiftKey) modifiers.push('Shift')
			if (e.metaKey) modifiers.push('Meta')

			const key = e.key.toUpperCase()
			const combo = [...modifiers, key].join('+')

			onChange(combo)
			setIsRecording(false)
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isRecording, onChange])

	// Click outside to cancel
	useEffect(() => {
		if (!isRecording) return
		const handleClickOutside = (e: MouseEvent) => {
			if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
				setIsRecording(false)
			}
		}
		window.addEventListener('mousedown', handleClickOutside)
		return () => window.removeEventListener('mousedown', handleClickOutside)
	}, [isRecording])

	return (
		<div className="relative flex items-center group/recorder">
			<button
				ref={buttonRef}
				onClick={() => setIsRecording(true)}
				className={cn(
					'relative h-10 min-w-[120px] px-4 rounded-md text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 shadow-sm active:scale-95',
					isRecording
						? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/20'
						: value
						? 'bg-secondary/80 text-secondary-foreground hover:bg-secondary hover:text-foreground border border-transparent shadow-inner'
						: 'bg-background border border-border/80 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 hover:shadow-sm'
				)}
			>
				{isRecording ? (
					<span className="animate-pulse">Pulsar teclas...</span>
				) : value ? (
					<div className="flex items-center gap-1.5 select-none">
						{(value as string).split('+').map((part, i, arr) => (
							<React.Fragment key={i}>
								<Kbd className="bg-muted border-border min-w-[28px] h-7 text-center px-2 text-[11px] font-bold text-foreground/80 shadow-sm shadow-black/10 transition-all duration-200">
									{part}
								</Kbd>
								{i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs font-black">+</span>}
							</React.Fragment>
						))}
					</div>
				) : (
					<div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
						<Plus className="h-3.5 w-3.5" />
						<span className="text-xs font-medium">Asignar</span>
					</div>
				)}
			</button>

			{value && !isRecording && (
				<button
					onClick={e => {
						e.stopPropagation()
						onChange(null)
					}}
					title="Eliminar atajo"
					className="absolute -right-3 -top-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center shadow-md opacity-0 scale-75 group-hover/recorder:opacity-100 group-hover/recorder:scale-100 transition-all duration-200 z-10 hover:scale-110 active:scale-90 ring-2 ring-background"
				>
					<X className="h-3 w-3" strokeWidth={3} />
				</button>
			)}
		</div>
	)
}

/**
 * ShortcutsContent - Headless version for embedding in Settings tabs
 * Same as ShortcutsView but without the title header
 */
export function ShortcutsContent() {
	const shortcuts = useSettingsStore(state => state.shortcuts)
	const setShortcut = useSettingsStore(state => state.setShortcut)

	return (
		<div className="space-y-6">
			{/* Info Card */}
			<div className="relative overflow-hidden bg-card border border-border rounded-lg p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center">
				<div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-primary/50" />

				<div className="bg-primary/10 p-2.5 rounded-full shrink-0 text-primary ring-1 ring-primary/20">
					<Keyboard className="h-5 w-5" />
				</div>

				<div className="space-y-1 flex-1">
					<p className="font-semibold text-foreground tracking-tight text-sm">
						Funcionamiento Global
					</p>
					<p className="text-muted-foreground text-xs">
						Los atajos funcionan en todas las páginas. Se desactivan automáticamente al escribir en campos de texto.
					</p>
				</div>
			</div>

			{/* Configuration List */}
			<div className="grid gap-2.5">
				{SHORTCUT_ACTIONS.map(action => (
					<div
						key={action.id}
						className="group relative flex items-center justify-between p-3 rounded-lg border border-border/40 bg-card/50 hover:bg-card hover:border-primary/20 transition-all duration-200 shadow-sm"
					>
						<div className="flex items-center gap-3">
							<div
								className={cn(
									'h-9 w-9 rounded-md flex items-center justify-center transition-all duration-200 ring-1 ring-inset ring-white/5',
									shortcuts[action.id]
										? 'bg-primary/15 text-primary ring-primary/20'
										: 'bg-secondary/40 text-muted-foreground group-hover:bg-secondary/60'
								)}
							>
								<action.icon className="h-4 w-4" strokeWidth={2} />
							</div>
							<div>
								<span
									className={cn(
										'font-medium block text-sm tracking-tight transition-colors',
										shortcuts[action.id] ? 'text-foreground' : 'text-foreground/80'
									)}
								>
									{action.label}
								</span>
								<span className="text-xs text-muted-foreground hidden sm:block opacity-60">
									{action.description}
								</span>
							</div>
						</div>

						<ShortcutRecorder
							value={shortcuts[action.id] || null}
							onChange={combo => setShortcut(action.id, combo)}
						/>
					</div>
				))}
			</div>
		</div>
	)
}
