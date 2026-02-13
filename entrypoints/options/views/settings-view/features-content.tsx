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
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Search from 'lucide-react/dist/esm/icons/search'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Package from 'lucide-react/dist/esm/icons/package'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
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
		gameButtonEnabled,
		gifPickerEnabled,
		draftsButtonEnabled,
		templateButtonEnabled,
		mediaHoverCardsEnabled,
		steamBundleInlineCardsEnabled,
		pinnedPostsEnabled,
		threadSummarizerEnabled,
		postSummaryEnabled,
		saveThreadEnabled,
		hideThreadEnabled,
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
				| 'gameButtonEnabled'
				| 'gifPickerEnabled'
				| 'draftsButtonEnabled'
				| 'templateButtonEnabled'
				| 'mediaHoverCardsEnabled'
				| 'steamBundleInlineCardsEnabled'
				| 'pinnedPostsEnabled'
				| 'threadSummarizerEnabled'
				| 'postSummaryEnabled'
				| 'saveThreadEnabled'
				| 'hideThreadEnabled',
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
				label="Homepage de MV Premium"
				description={
					<div className="space-y-2 pr-1">
						<p className="m-0 leading-relaxed">
							Reemplaza la portada nativa por una homepage personalizada de MV Premium con noticias y actividad del foro.
						</p>
						<div className="rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5">
							<p className="m-0 text-[11px] leading-snug font-medium text-foreground/90">
								Todos los créditos del diseño visual original de esta homepage pertenecen a MV-Ignited.
							</p>
							<a
								href="https://www.mediavida.com/foro/dev/mv-ignited-2024-tampoco-me-dejo-mediavida-extension-709386"
								target="_blank"
								rel="noopener noreferrer"
								className="mt-1 inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 hover:underline"
							>
								Ver MV-Ignited (diseño original)
								<ExternalLink className="h-3 w-3" />
							</a>
						</div>
					</div>
				}
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
				icon={<Gamepad2 className="h-4 w-4" />}
				label="Botón de Videojuegos"
				description="Añade un botón en el editor para buscar e insertar fichas de videojuegos desde IGDB."
			>
				<Switch checked={gameButtonEnabled} onCheckedChange={withToastAndReload('gameButtonEnabled', true)} />
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
				icon={<Package className="h-4 w-4" />}
				label="Cards de Bundles de Steam"
				description="Muestra tarjetas inline para enlaces de bundles de Steam en editores y vistas previas. No afecta a las cards de juegos individuales."
			>
				<Switch
					checked={steamBundleInlineCardsEnabled}
					onCheckedChange={withToastAndReload('steamBundleInlineCardsEnabled', true)}
				/>
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
						Permite resúmenes de 1 página con el botón de resumir o hasta 30 páginas con el botón de Resumir+.{' '}
						<span className="text-destructive font-bold block mt-1">
							⚠️ Requiere configurar una API Key de Gemini o Groq
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
        				description={
					<span>
						Permite resumir posts individuales muy largos con un solo clic.{' '}
						<span className="text-destructive font-bold block mt-1">
							⚠️ Requiere configurar una API Key de Gemini o Groq
						</span>
					</span>
				}
			>
				<Switch checked={postSummaryEnabled} onCheckedChange={withToastAndReload('postSummaryEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<FolderHeart className="h-4 w-4" />}
				label="Guardar Hilo"
				description="Muestra botones de guardar en listados y noticias. El botón de guardar dentro del hilo y el click derecho siempre están activos."
			>
				<Switch checked={saveThreadEnabled} onCheckedChange={withToastAndReload('saveThreadEnabled', true)} />
			</SettingRow>

			<SettingRow
				icon={<EyeOff className="h-4 w-4" />}
				label="Ocultar Hilos"
				description="Muestra botones para ocultar hilos en listados. La opción de ocultar con click derecho siempre está activa."
			>
				<Switch checked={hideThreadEnabled} onCheckedChange={withToastAndReload('hideThreadEnabled', true)} />
			</SettingRow>
		</SettingsSection>
	)
}
