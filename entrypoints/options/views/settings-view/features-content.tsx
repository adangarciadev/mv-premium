/**
 * Features Content - Feature toggles
 */
import Film from 'lucide-react/dist/esm/icons/film'
import HomeIcon from 'lucide-react/dist/esm/icons/home'
import { logger } from '@/lib/logger'
import ImageIcon from 'lucide-react/dist/esm/icons/image-play'
import Pin from 'lucide-react/dist/esm/icons/pin'
import Bot from 'lucide-react/dist/esm/icons/bot'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Layout from 'lucide-react/dist/esm/icons/layout'
import List from 'lucide-react/dist/esm/icons/list'
import FolderHeart from 'lucide-react/dist/esm/icons/folder-heart'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Search from 'lucide-react/dist/esm/icons/search'
import { browser } from 'wxt/browser'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'

export function FeaturesContent() {
	const {
		setSetting,
		newHomepageEnabled,
		navbarSearchEnabled,
		cinemaButtonEnabled,
		gifPickerEnabled,
		draftsButtonEnabled,
		templateButtonEnabled,
		mediaHoverCardsEnabled,
		pinnedPostsEnabled,
		threadSummarizerEnabled,
		postSummaryEnabled,
		saveThreadEnabled,
	} = useSettingsStore()

	const reloadMediavidaTabs = async () => {
		try {
			const tabs = await browser.tabs.query({ url: '*://*.mediavida.com/*' })
			for (const tab of tabs) {
				if (tab.id) {
					browser.tabs.reload(tab.id)
				}
			}
		} catch (error) {
			logger.warn('Could not reload tabs:', error)
		}
	}

	// Helper to show toast on change and reload tabs that require it
	const withToastAndReload =
		(
			key:
				| 'newHomepageEnabled'
				| 'navbarSearchEnabled'
				| 'cinemaButtonEnabled'
				| 'gifPickerEnabled'
				| 'draftsButtonEnabled'
				| 'templateButtonEnabled'
				| 'mediaHoverCardsEnabled'
				| 'pinnedPostsEnabled'
				| 'threadSummarizerEnabled'
				| 'postSummaryEnabled'
				| 'saveThreadEnabled',
			requiresReload: boolean = false
		) =>
		async (val: boolean) => {
			setSetting(key, val)

			if (requiresReload) {
				toast.success(val ? 'Funcionalidad activada' : 'Funcionalidad desactivada', {
					description: 'Recargando pestañas de Mediavida...',
				})
				// Small delay to allow storage to sync
				await new Promise(resolve => setTimeout(resolve, 300))
				await reloadMediavidaTabs()
			} else {
				toast.success(val ? 'Funcionalidad activada' : 'Funcionalidad desactivada')
			}
		}

	return (
		<SettingsSection title="Funcionalidades" description="Activa o desactiva las características de la extensión.">
			{/* Navigation Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Navegación</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<HomeIcon className="h-4 w-4" />}
				label="Nueva Homepage"
				description="Reemplaza la pagina de inicio de Mediavida con un dashboard personalizado mostrando noticias, hilos recientes, tus ultimos posts y favoritos."
			>
				<Switch checked={newHomepageEnabled} onCheckedChange={withToastAndReload('newHomepageEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Search className="h-4 w-4" />}
				label="Super Buscador en Navbar"
				description="Reemplaza el buscador nativo de Mediavida con el Super Buscador. Si lo desactivas, el buscador nativo se mostrará pero Ctrl+K seguirá funcionando."
			>
				<Switch checked={navbarSearchEnabled} onCheckedChange={withToastAndReload('navbarSearchEnabled', true)} />
			</SettingRow>

			<Separator className="my-6" />

			{/* Editor Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Editor</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<Film className="h-4 w-4" />}
				label="Botón de Cine"
				description="Añade un botón en el editor para buscar e insertar fichas de películas y series desde TMDB."
			>
				<Switch checked={cinemaButtonEnabled} onCheckedChange={withToastAndReload('cinemaButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<ImageIcon className="h-4 w-4" />}
				label="Selector de GIFs"
				description="Permite buscar e insertar GIFs animados desde GIPHY directamente en el editor."
			>
				<Switch checked={gifPickerEnabled} onCheckedChange={withToastAndReload('gifPickerEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<FileText className="h-4 w-4" />}
				label="Botón de Borradores"
				description="Añade acceso rápido a tus borradores guardados en la barra de herramientas."
			>
				<Switch checked={draftsButtonEnabled} onCheckedChange={withToastAndReload('draftsButtonEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Layout className="h-4 w-4" />}
				label="Insertar Plantilla"
				description="Añade un botón para insertar plantillas predefinidas o propias."
			>
				<Switch checked={templateButtonEnabled} onCheckedChange={withToastAndReload('templateButtonEnabled', true)} />
			</SettingRow>

			<Separator className="my-6" />

			{/* Content Section */}
			<div className="space-y-1 mb-4">
				<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contenido</h3>
				<p className="text-xs text-muted-foreground">Estos cambios requieren recargar las pestañas de Mediavida.</p>
			</div>

			<SettingRow
				icon={<Sparkles className="h-4 w-4" />}
				label="Hover Cards de Medios"
				description="Muestra tarjetas informativas al pasar el ratón sobre enlaces de TMDB o IMDb."
			>
				<Switch checked={mediaHoverCardsEnabled} onCheckedChange={withToastAndReload('mediaHoverCardsEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Pin className="h-4 w-4" />}
				label="Posts Anclados"
				description="Permite anclar posts importantes y verlos en un panel lateral."
			>
				<Switch checked={pinnedPostsEnabled} onCheckedChange={withToastAndReload('pinnedPostsEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<Bot className="h-4 w-4" />}
				label="Resumidor de Hilos (IA)"
				description={
					<span>
						Añade un botón para generar resúmenes de cada página del hilo usando inteligencia artificial.{' '}
						<span className="text-destructive font-bold block mt-1">
							⚠️ Requiere configurar una Gemini API Key
						</span>
					</span>
				}
			>
				<Switch
					checked={threadSummarizerEnabled}
					onCheckedChange={withToastAndReload('threadSummarizerEnabled', true)}
				/>
			</SettingRow>

			<SettingRow
				icon={<List className="h-4 w-4" />}
				label="Resumen de Post (IA)"
				description="Permite resumir posts individuales muy largos con un solo clic."
			>
				<Switch checked={postSummaryEnabled} onCheckedChange={withToastAndReload('postSummaryEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<FolderHeart className="h-4 w-4" />}
				label="Guardar Hilo"
				description="Añade un botón para guardar hilos localmente y leerlos después."
			>
				<Switch checked={saveThreadEnabled} onCheckedChange={withToastAndReload('saveThreadEnabled', true)} />
			</SettingRow>
		</SettingsSection>
	)
}
