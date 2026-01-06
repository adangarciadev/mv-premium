/**
 * Content Tab Content - Bold color + page width settings
 */
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow, ColorPickerWithConfirm } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'

export function ContentTabContent() {
	const { boldColor, setBoldColor } = useSettingsStore()

	return (
		<SettingsSection title="Contenido" description="Funciones para visualizar y organizar contenido en hilos.">
			{/* Text Styling */}
			<SettingRow
				icon={<Sparkles className="h-4 w-4" />}
				label="Color de negrita"
				description="Color del texto en negrita en los posts de Mediavida."
			>
				<ColorPickerWithConfirm value={boldColor} defaultValue="#c9a227" onConfirm={setBoldColor} />
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
