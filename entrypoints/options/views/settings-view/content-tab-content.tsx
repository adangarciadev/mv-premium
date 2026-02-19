/**
 * Content Tab Content - Bold color + page width settings + dashboard icon
 */
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard'
import Shield from 'lucide-react/dist/esm/icons/shield'
import Rocket from 'lucide-react/dist/esm/icons/rocket'
import Cog from 'lucide-react/dist/esm/icons/cog'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow, ColorPickerWithConfirm } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'
import type { DashboardIcon } from '@/store/settings-types'
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
		setBoldColor,
		setBoldColorEnabled,
		dashboardIcon,
		setSetting,
	} =
		useSettingsStore()

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
