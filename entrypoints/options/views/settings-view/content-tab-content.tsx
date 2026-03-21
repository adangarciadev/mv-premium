/**
 * Content Tab Content - Bold color + page width settings + dashboard icon + work mode
 */
import { useState } from 'react'
import PanelTopClose from 'lucide-react/dist/esm/icons/panel-top-close'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Rocket from 'lucide-react/dist/esm/icons/rocket'
import Cog from 'lucide-react/dist/esm/icons/cog'
import Briefcase from 'lucide-react/dist/esm/icons/briefcase'
import CircleUserRound from 'lucide-react/dist/esm/icons/circle-user-round'
import Image from 'lucide-react/dist/esm/icons/image'
import Play from 'lucide-react/dist/esm/icons/play'
import Share2 from 'lucide-react/dist/esm/icons/share-2'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Hash from 'lucide-react/dist/esm/icons/hash'
import AppWindow from 'lucide-react/dist/esm/icons/app-window'
import Check from 'lucide-react/dist/esm/icons/check'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow, ColorPickerWithConfirm } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'
import type { DashboardIcon, WorkModeOptions } from '@/store/settings-types'
import { browser } from 'wxt/browser'

const logoUrl = browser.runtime.getURL('/icon/48.png')

const DASHBOARD_ICON_OPTIONS: { value: DashboardIcon; label: string; icon: React.ReactNode }[] = [
	{ value: 'logo', label: 'Logo MV Premium', icon: <img src={logoUrl} alt="Logo" className="h-4 w-4" /> },
	{ value: 'user-shield', label: 'Escudo', icon: <Shield className="h-4 w-4" /> },
	{ value: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
	{ value: 'rocket', label: 'Cohete', icon: <Rocket className="h-4 w-4" /> },
	{ value: 'gears', label: 'Engranajes', icon: <Cog className="h-4 w-4" /> },
]

export function ContentTabContent() {
	const {
		boldColor,
		boldColorEnabled,
		twitterLiteEmbedsEnabled,
		hideHeaderEnabled,
		workModeEnabled,
		workModeOptions,
		workModeTabTitle,
		setBoldColor,
		setBoldColorEnabled,
		dashboardIcon,
		setSetting,
	} =
		useSettingsStore()

	const updateWorkModeOption = (key: keyof WorkModeOptions, value: boolean) => {
		setSetting('workModeOptions', { ...workModeOptions, [key]: value })
	}

	return (
		<SettingsSection title="Contenido" description="Funciones para visualizar y organizar contenido en hilos.">
			{/* Text Styling */}
			<SettingRow
				icon={<Sparkles className="h-4 w-4" />}
				label="Personalizar color de negrita"
				description="Usa un color personalizado para el texto en negrita. Desactivado = color nativo de Mediavida."
			>
				<div className="flex items-center gap-3">
					{boldColorEnabled && (
						<ColorPickerWithConfirm value={boldColor || '#ffffff'} defaultValue="#ffffff" onConfirm={setBoldColor} />
					)}
					<Switch
						checked={boldColorEnabled}
						onCheckedChange={checked => {
							setBoldColorEnabled(checked)
							toast.success(checked ? 'Color personalizado activado' : 'Color nativo restaurado')
						}}
					/>
				</div>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<MessageSquare className="h-4 w-4" />}
				label="Tweets Lite"
				description="Reemplaza los iframes de X/Twitter por tarjetas ligeras con avatar, texto, imágenes, tweets citados e hilos. Carga más rápido y se ve siempre."
			>
				<Switch
					checked={twitterLiteEmbedsEnabled}
					onCheckedChange={checked => {
						setSetting('twitterLiteEmbedsEnabled', checked)
						toast.success(checked ? 'Modo ligero de tweets activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			<Separator />

			{/* Dashboard Icon Selection */}
			<SettingRow
				icon={<LayoutDashboard className="h-4 w-4" />}
				label="Icono del Dashboard"
				description="Elige el icono que aparece en el navbar de Mediavida para acceder al panel."
			>
				<Select
					value={dashboardIcon || 'logo'}
					onValueChange={val => {
						setSetting('dashboardIcon', val as DashboardIcon)
						toast.success('Icono actualizado. Recarga Mediavida para ver el cambio.')
					}}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DASHBOARD_ICON_OPTIONS.map(opt => (
							<SelectItem key={opt.value} value={opt.value}>
								<span className="flex items-center gap-2">
									{opt.icon}
									{opt.label}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>

			<Separator />

			{/* Hide Header */}
			<SettingRow
				icon={<PanelTopClose className="h-4 w-4" />}
				label="Ocultar cabecera"
				description="Oculta el header/navbar superior de Mediavida para ganar espacio vertical. También disponible como atajo de teclado."
			>
				<Switch
					checked={hideHeaderEnabled}
					onCheckedChange={checked => {
						setSetting('hideHeaderEnabled', checked)
						toast.success(checked ? 'Cabecera oculta' : 'Cabecera visible')
					}}
				/>
			</SettingRow>

			<Separator />

			{/* Work Mode */}
			<SettingRow
				icon={<Briefcase className="h-4 w-4" />}
				label="Modo trabajo"
				description="Oculta contenido visual del foro para navegar discretamente. También disponible como atajo de teclado."
			>
				<Switch
					checked={workModeEnabled}
					onCheckedChange={checked => {
						setSetting('workModeEnabled', checked)
						toast.success(checked ? 'Modo trabajo activado' : 'Modo trabajo desactivado')
					}}
				/>
			</SettingRow>

			{workModeEnabled && (
				<div className="ml-6 space-y-1 border-l-2 border-muted pl-4 pb-1">
					<p className="text-xs text-muted-foreground mb-3">Elige qué contenido ocultar:</p>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<CircleUserRound className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Avatares</span>
						</div>
						<Switch
							checked={workModeOptions.hideAvatars}
							onCheckedChange={checked => updateWorkModeOption('hideAvatars', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<Image className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Imágenes</span>
						</div>
						<Switch
							checked={workModeOptions.hideImages}
							onCheckedChange={checked => updateWorkModeOption('hideImages', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<Play className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Videos</span>
						</div>
						<Switch
							checked={workModeOptions.hideVideos}
							onCheckedChange={checked => updateWorkModeOption('hideVideos', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<Share2 className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Redes sociales</span>
						</div>
						<Switch
							checked={workModeOptions.hideSocialEmbeds}
							onCheckedChange={checked => updateWorkModeOption('hideSocialEmbeds', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<Gamepad2 className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Tarjetas de Steam</span>
						</div>
						<Switch
							checked={workModeOptions.hideSteamCards}
							onCheckedChange={checked => updateWorkModeOption('hideSteamCards', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<Hash className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Iconos de subforos</span>
						</div>
						<Switch
							checked={workModeOptions.hideForumIcons}
							onCheckedChange={checked => updateWorkModeOption('hideForumIcons', checked)}
						/>
					</div>

					<div className="flex items-center justify-between py-1.5">
						<div className="flex items-center gap-2">
							<AppWindow className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-sm">Camuflar pestaña</span>
						</div>
						<Switch
							checked={workModeOptions.disguiseTab}
							onCheckedChange={checked => updateWorkModeOption('disguiseTab', checked)}
						/>
					</div>

					{workModeOptions.disguiseTab && (
						<TabTitleInput value={workModeTabTitle} onConfirm={val => setSetting('workModeTabTitle', val)} />
					)}
				</div>
			)}

			<Separator />

			{/* Page Width - Layout */}
			<PageWidthSettings />
		</SettingsSection>
	)
}

function PageWidthSettings() {
	const { ultrawideMode, setUltrawideMode } = useSettingsStore()

	return (
		<SettingRow
			icon={<Settings2 className="h-4 w-4" />}
			label="Modo Ultrawide"
			description="Ajusta el ancho del contenido. Ideal para monitores grandes."
		>
			<Select
				value={ultrawideMode}
				onValueChange={val => {
					setUltrawideMode(val as typeof ultrawideMode)
					toast.success('Configuración guardada')
				}}
			>
				<SelectTrigger className="w-[180px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="off">Off</SelectItem>
					<SelectItem value="wide">Wide</SelectItem>
					<SelectItem value="extra-wide">Extrawide</SelectItem>
					<SelectItem value="full">Ultrawide</SelectItem>
				</SelectContent>
			</Select>
		</SettingRow>
	)
}

const MAX_TAB_TITLE_LENGTH = 40

function TabTitleInput({ value, onConfirm }: { value: string; onConfirm: (val: string) => void }) {
	const [draft, setDraft] = useState(value)
	const hasChanged = draft !== value

	const handleConfirm = () => {
		const trimmed = draft.trim() || 'Documentación'
		onConfirm(trimmed)
		setDraft(trimmed)
		toast.success('Título de pestaña actualizado')
	}

	return (
		<div className="ml-6 mt-1 mb-1">
			<label className="text-xs text-muted-foreground mb-1.5 block">
				Título de la pestaña ({draft.length}/{MAX_TAB_TITLE_LENGTH})
			</label>
			<div className="flex items-center gap-2">
				<input
					type="text"
					value={draft}
					onChange={e => setDraft(e.target.value.slice(0, MAX_TAB_TITLE_LENGTH))}
					onKeyDown={e => { if (e.key === 'Enter' && hasChanged) handleConfirm() }}
					placeholder="Documentación"
					maxLength={MAX_TAB_TITLE_LENGTH}
					className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
				/>
				<button
					type="button"
					onClick={handleConfirm}
					disabled={!hasChanged}
					className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
					title="Confirmar título"
				>
					<Check className="h-4 w-4" />
				</button>
			</div>
		</div>
	)
}
