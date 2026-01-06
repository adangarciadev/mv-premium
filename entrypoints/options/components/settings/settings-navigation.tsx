/**
 * SettingsNavigation - Navigation settings section
 */
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import InfinityIcon from 'lucide-react/dist/esm/icons/infinity'
import Radio from 'lucide-react/dist/esm/icons/radio'
import Images from 'lucide-react/dist/esm/icons/images'
import { useSettingsStore } from '@/store/settings-store'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { SettingsSection } from './settings-section'
import { SettingRow } from './setting-row'
import { browser } from 'wxt/browser'
import { toast } from 'sonner'

export function SettingsNavigation() {
	const {
		infiniteScrollEnabled,
		setInfiniteScrollEnabled,
		liveThreadEnabled,
		setLiveThreadEnabled,
		galleryButtonEnabled,
		setSetting,
	} = useSettingsStore()

	const reloadMediavidaTabs = () => {
		browser.tabs.query({ url: '*://www.mediavida.com/*' }).then((tabs) => {
			tabs.forEach((tab) => {
				if (tab.id) browser.tabs.reload(tab.id)
			})
		})
	}

	return (
		<SettingsSection
			title="Navegación"
			description="Opciones relacionadas con la navegación y carga de contenido."
		>
			<Card className="mb-6 border-primary/50 bg-primary/15 border-l-[6px] border-l-primary shadow-md overflow-hidden transition-all hover:bg-primary/20">
				<div className="flex gap-4 p-5 items-center">
					<div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-lg shrink-0 flex items-center justify-center">
						<HelpCircle className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<h4 className="font-bold text-primary text-lg leading-tight">
							Nota: Uso de funciones
						</h4>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Las funciones de <strong>Scroll infinito</strong> y{' '}
							<strong>Modo Live</strong> se pueden activar juntas en los ajustes
							para que ambos botones aparezcan en el hilo. Sin embargo, son
							mutuamente excluyentes: al usar una, la otra se pausará
							automáticamente para evitar conflictos.
						</p>
					</div>
				</div>
			</Card>

			<SettingRow
				icon={<InfinityIcon className="h-4 w-4" />}
				label="Scroll infinito"
				description="Carga automáticamente más posts al llegar al final de la página."
			>
				<Switch
					checked={infiniteScrollEnabled}
					onCheckedChange={(checked) => {
						setInfiniteScrollEnabled(checked)
						reloadMediavidaTabs()
						toast.success(
							checked ? 'Scroll infinito activado' : 'Configuración guardada'
						)
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Radio className="h-4 w-4" />}
				label="Modo Live"
				description="Muestra nuevos posts en tiempo real sin recargar la página."
			>
				<Switch
					checked={liveThreadEnabled}
					onCheckedChange={(checked) => {
						setLiveThreadEnabled(checked)
						reloadMediavidaTabs()
						toast.success(
							checked ? 'Modo Live activado' : 'Configuración guardada'
						)
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Images className="h-4 w-4" />}
				label="Botón de galería"
				description="Muestra el botón para ver todas las imágenes del hilo en una galería."
			>
				<Switch
					checked={galleryButtonEnabled}
					onCheckedChange={(checked) => {
						setSetting('galleryButtonEnabled', checked)
						reloadMediavidaTabs()
						toast.success(
							checked ? 'Botón de galería activado' : 'Configuración guardada'
						)
					}}
				/>
			</SettingRow>
		</SettingsSection>
	)
}
