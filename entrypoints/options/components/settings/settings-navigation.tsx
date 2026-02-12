/**
 * SettingsNavigation - Navigation settings section
 */
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import InfinityIcon from 'lucide-react/dist/esm/icons/infinity'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Radio from 'lucide-react/dist/esm/icons/radio'
import Images from 'lucide-react/dist/esm/icons/images'
import Clock from 'lucide-react/dist/esm/icons/clock'
import Maximize from 'lucide-react/dist/esm/icons/maximize'
import Pin from 'lucide-react/dist/esm/icons/pin'
import { useSettingsStore } from '@/store/settings-store'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { SettingsSection } from './settings-section'
import { SettingRow } from './setting-row'
import { browser } from 'wxt/browser'
import { toast } from 'sonner'
import type { CenteredControlsPosition } from '@/store/settings-types'

export function SettingsNavigation() {
	const {
		infiniteScrollEnabled,
		setInfiniteScrollEnabled,
		autoInfiniteScrollEnabled,
		liveThreadEnabled,
		setLiveThreadEnabled,
		galleryButtonEnabled,
		nativeLiveDelayEnabled,
		liveThreadDelayEnabled,
		centeredPostsEnabled,
		centeredControlsSticky,
		centeredControlsPosition,
		setSetting,
		updateSettings,
	} = useSettingsStore()

	const reloadMediavidaTabs = () => {
		browser.tabs.query({ url: '*://www.mediavida.com/*' }).then(tabs => {
			tabs.forEach(tab => {
				if (tab.id) browser.tabs.reload(tab.id)
			})
		})
	}

	return (
		<SettingsSection title="Navegación" description="Opciones relacionadas con la navegación y carga de contenido.">
			<Card className="mb-6 border-primary/50 bg-primary/15 border-l-[6px] border-l-primary shadow-md overflow-hidden transition-all hover:bg-primary/20">
				<div className="flex gap-4 p-5 items-center">
					<div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-lg shrink-0 flex items-center justify-center">
						<HelpCircle className="h-6 w-6" />
					</div>
					<div className="space-y-1">
						<h4 className="font-bold text-primary text-lg leading-tight">Nota: Uso de funciones</h4>
						<p className="text-muted-foreground text-sm leading-relaxed">
							Las funciones de <strong>Scroll infinito</strong> y <strong>Modo Live</strong> se pueden activar juntas en
							los ajustes para que ambos botones aparezcan en el hilo. Sin embargo, son mutuamente excluyentes: al usar
							una, la otra se pausará automáticamente para evitar conflictos.
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
					onCheckedChange={checked => {
						setInfiniteScrollEnabled(checked)
						// Si se desactiva, también desactivar auto-activación
						if (!checked) {
							setSetting('autoInfiniteScrollEnabled', false)
						}
						reloadMediavidaTabs()
						toast.success(checked ? 'Scroll infinito activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			{infiniteScrollEnabled && (
				<SettingRow
					icon={<Zap className="h-4 w-4" />}
					label="Activar automáticamente"
					description="El scroll infinito se activa automáticamente al entrar en un hilo (excepto en hilos LIVE)."
					className="ml-6 border-l-2 border-primary/30 pl-4"
				>
					<Switch
						checked={autoInfiniteScrollEnabled}
						onCheckedChange={checked => {
							setSetting('autoInfiniteScrollEnabled', checked)
							reloadMediavidaTabs()
							toast.success(checked ? 'Auto-activación de scroll infinito activada' : 'Configuración guardada')
						}}
					/>
				</SettingRow>
			)}

			<Separator />

			<SettingRow
				icon={<Radio className="h-4 w-4" />}
				label="Modo Live"
				description="Muestra nuevos posts en tiempo real sin recargar la página."
			>
				<Switch
					checked={liveThreadEnabled}
					onCheckedChange={checked => {
						setLiveThreadEnabled(checked)
						reloadMediavidaTabs()
						toast.success(checked ? 'Modo Live activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Images className="h-4 w-4" />}
				label="Botón de galería"
				description="Muestra el botón para ver todas las imágenes de cada página del hilo en una galería."
			>
				<Switch
					checked={galleryButtonEnabled}
					onCheckedChange={checked => {
						setSetting('galleryButtonEnabled', checked)
						reloadMediavidaTabs()
						toast.success(checked ? 'Botón de galería activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Clock className="h-4 w-4" />}
				label="Delay en Live de MV Premium"
				description="Añade un control de delay en el live propio de MV Premium para evitar spoilers."
			>
				<Switch
					checked={liveThreadDelayEnabled}
					onCheckedChange={checked => {
						setSetting('liveThreadDelayEnabled', checked)
						reloadMediavidaTabs()
						toast.success(checked ? 'Delay en Modo Live activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Clock className="h-4 w-4" />}
				label="Delay en Live nativo de Mediavida"
				description="Añade un control de delay en los hilos live nativos de Mediavida para evitar spoilers."
			>
				<Switch
					checked={nativeLiveDelayEnabled}
					onCheckedChange={checked => {
						setSetting('nativeLiveDelayEnabled', checked)
						reloadMediavidaTabs()
						toast.success(checked ? 'Delay en LIVE activado' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			<Separator />

			<SettingRow
				icon={<Maximize className="h-4 w-4" />}
				label="Posts e hilos centrados"
				description="Oculta el sidebar y expande el contenido en hilos, Spy y subforos."
			>
				<Switch
					checked={centeredPostsEnabled}
					onCheckedChange={checked => {
						if (!checked) {
							// Reset sticky controls if main feature is disabled (Atomic update)
							updateSettings({
								centeredPostsEnabled: false,
								centeredControlsSticky: false,
							})
						} else {
							setSetting('centeredPostsEnabled', true)
						}

						// Reload with slight delay to ensure storage is updated
						setTimeout(() => {
							reloadMediavidaTabs()
						}, 100)

						toast.success(checked ? 'Posts centrados activados' : 'Configuración guardada')
					}}
				/>
			</SettingRow>

			{centeredPostsEnabled && (
				<SettingRow
					icon={<Maximize className="h-4 w-4" />}
					label="Posición de controles"
					description="Solo en hilos: arriba (barra horizontal) o lateral flotante sin ocupar ancho del hilo. En pantallas estrechas se usa arriba automáticamente."
					className="ml-6 border-l-2 border-primary/30 pl-4"
				>
					<Select
						value={centeredControlsPosition}
						onValueChange={value => {
							setSetting('centeredControlsPosition', value as CenteredControlsPosition)

							setTimeout(() => {
								reloadMediavidaTabs()
							}, 100)

							toast.success(value === 'side' ? 'Controles laterales activados' : 'Controles superiores activados')
						}}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="top">Arriba</SelectItem>
							<SelectItem value="side">Lateral</SelectItem>
						</SelectContent>
					</Select>
				</SettingRow>
			)}

			{centeredPostsEnabled && centeredControlsPosition === 'top' && (
				<SettingRow
					icon={<Pin className="h-4 w-4" />}
					label="Barra de controles fija"
					description="La barra de controles permanece visible al hacer scroll."
					className="ml-6 border-l-2 border-primary/30 pl-4"
				>
					<Switch
						checked={centeredControlsSticky}
						onCheckedChange={checked => {
							setSetting('centeredControlsSticky', checked)

							// Reload with slight delay
							setTimeout(() => {
								reloadMediavidaTabs()
							}, 100)

							toast.success(checked ? 'Barra de controles fija activada' : 'Configuración guardada')
						}}
					/>
				</SettingRow>
			)}
		</SettingsSection>
	)
}
