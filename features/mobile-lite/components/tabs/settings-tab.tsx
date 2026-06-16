import Bold from 'lucide-react/dist/esm/icons/bold'
import Check from 'lucide-react/dist/esm/icons/check'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Gift from 'lucide-react/dist/esm/icons/gift'
import Images from 'lucide-react/dist/esm/icons/images'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import Radio from 'lucide-react/dist/esm/icons/radio'
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw'
import TextQuote from 'lucide-react/dist/esm/icons/text-quote'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import type { GeminiModel } from '@/store/settings-types'
import type { MobileLiteChangelogEntry } from '../../logic/whats-new'
import type { StorageUsage } from '../../hooks/use-storage-usage'
import { GoogleGIcon } from '../google-g-icon'
import { StorageCard } from '../storage-card'
import { DEFAULT_BOLD_COLOR, type SavingMobileLiteSetting } from '../panel-helpers'
import {
	GROUP_CLASS,
	INPUT_CLASS,
	PRIMARY_BUTTON_CLASS,
	SECONDARY_BUTTON_CLASS,
	SECTION_LABEL_CLASS,
	SWITCH_THUMB_BASE_CLASS,
	SWITCH_TRACK_BASE_CLASS,
	SWITCH_WRAPPER_CLASS,
} from '../panel-tokens'

export function SettingsTab({
	latestMobileLiteEntry,
	latestMobileLiteChangeCount,
	hasUnseenWhatsNew,
	onOpenWhatsNew,
	imgbbApiKeyDraft,
	isImgbbConfigured,
	isImgbbDirty,
	savingImgbbApiKey,
	onImgbbDraftChange,
	onSaveImgbbApiKey,
	geminiApiKeyDraft,
	isGeminiConfigured,
	isGeminiDirty,
	savingGeminiApiKey,
	onGeminiDraftChange,
	onSaveGeminiApiKey,
	aiModel,
	savingAiModel,
	availableModels,
	onSelectAiModel,
	boldColor,
	boldColorDraft,
	normalizedBoldColorDraft,
	boldColorEnabled,
	boldColorExpanded,
	isBoldColorDirty,
	savingBoldColor,
	onToggleBoldColor,
	onToggleBoldColorExpanded,
	onBoldColorDraftChange,
	onResetBoldColor,
	onSaveBoldColor,
	liveThreadEnabled,
	galleryButtonEnabled,
	quoteSelectionEnabled,
	hideThreadButtonEnabled,
	savingMobileLiteSetting,
	onToggleLiveThread,
	onToggleGallery,
	onToggleQuoteSelection,
	onToggleHideThread,
	storageUsage,
}: {
	latestMobileLiteEntry: MobileLiteChangelogEntry | null
	latestMobileLiteChangeCount: number
	hasUnseenWhatsNew: boolean
	onOpenWhatsNew: () => void
	imgbbApiKeyDraft: string
	isImgbbConfigured: boolean
	isImgbbDirty: boolean
	savingImgbbApiKey: boolean
	onImgbbDraftChange: (value: string) => void
	onSaveImgbbApiKey: () => void
	geminiApiKeyDraft: string
	isGeminiConfigured: boolean
	isGeminiDirty: boolean
	savingGeminiApiKey: boolean
	onGeminiDraftChange: (value: string) => void
	onSaveGeminiApiKey: () => void
	aiModel: string
	savingAiModel: boolean
	availableModels: Array<{ value: string; label: string; description: string }>
	onSelectAiModel: (model: GeminiModel) => void
	boldColor: string
	boldColorDraft: string
	normalizedBoldColorDraft: string
	boldColorEnabled: boolean
	boldColorExpanded: boolean
	isBoldColorDirty: boolean
	savingBoldColor: boolean
	onToggleBoldColor: () => void
	onToggleBoldColorExpanded: () => void
	onBoldColorDraftChange: (value: string) => void
	onResetBoldColor: () => void
	onSaveBoldColor: () => void
	liveThreadEnabled: boolean
	galleryButtonEnabled: boolean
	quoteSelectionEnabled: boolean
	hideThreadButtonEnabled: boolean
	savingMobileLiteSetting: SavingMobileLiteSetting
	onToggleLiveThread: () => void
	onToggleGallery: () => void
	onToggleQuoteSelection: () => void
	onToggleHideThread: () => void
	storageUsage: StorageUsage
}) {
	return (
		<div className="pb-1">
			{latestMobileLiteEntry && (
				<>
					<div className={SECTION_LABEL_CLASS}>MVPremium</div>
					<section className={GROUP_CLASS}>
						<button
							type="button"
							className="flex min-h-[60px] w-full items-center gap-3 py-2 pl-4 pr-2 text-left transition-colors active:bg-[#2e3543]"
							onClick={onOpenWhatsNew}
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14171d] text-[#f0a020]">
								<Gift className="h-5 w-5" aria-hidden="true" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-2">
									<div className="truncate text-[15px] font-semibold text-[#eef1f6]">Novedades</div>
									{hasUnseenWhatsNew && (
										<span
											aria-hidden="true"
											className="inline-flex shrink-0 items-center rounded-full bg-[#f0a020] px-2 py-0.5 text-[10px] font-black leading-none text-[#221604]"
										>
											NEW
										</span>
									)}
								</div>
								<div className="mt-0.5 truncate text-xs text-[#8b95a3]">
									v{latestMobileLiteEntry.version} - {latestMobileLiteChangeCount} cambios
								</div>
							</div>
							<ChevronDown className="h-5 w-5 shrink-0 -rotate-90 text-[#707b8e]" aria-hidden="true" />
						</button>
					</section>
				</>
			)}
			<div className={SECTION_LABEL_CLASS}>Imágenes</div>
			<div className={GROUP_CLASS}>
				<div className="p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0a020]/[0.16] text-[#f0a020]">
							<KeyRound className="h-5 w-5" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<div className="text-[15px] font-semibold">ImgBB</div>
								<span
									className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
										isImgbbConfigured ? 'bg-[#274532] text-[#bdf2c7]' : 'bg-[#3b3526] text-[#e7c77f]'
									}`}
								>
									{isImgbbConfigured && <Check className="h-3 w-3" aria-hidden="true" />}
									{isImgbbConfigured ? 'ImgBB activo' : 'Freeimage gratis'}
								</span>
							</div>
							<p className="mt-1 text-xs leading-relaxed text-[#9aa5b4]">
								{isImgbbConfigured
									? 'Tus subidas de imágenes usarán ImgBB con tu API key.'
									: 'Sin API key se usará Freeimage, el servicio gratuito por defecto.'}
							</p>
						</div>
					</div>

					<label className="mt-4 block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]" htmlFor="mvp-mobile-lite-imgbb-key">
						API key
					</label>
					<input
						id="mvp-mobile-lite-imgbb-key"
						type="password"
						value={imgbbApiKeyDraft}
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						onChange={event => onImgbbDraftChange(event.target.value)}
						placeholder="Pega tu API key de ImgBB"
						className={`${INPUT_CLASS} mt-2 px-3 font-mono`}
					/>

					{/* No "Pegar" button on purpose: clipboard reads on Android always
					    trigger the browser's paste-authorization bubble and there is no
					    API to know beforehand whether the clipboard has content. The
					    native long-press paste on the input avoids both problems. */}
					<button
						type="button"
						aria-label="Guardar API key de ImgBB"
						className={`${PRIMARY_BUTTON_CLASS} mt-3 w-full`}
						disabled={savingImgbbApiKey || !isImgbbDirty}
						onClick={onSaveImgbbApiKey}
					>
						<Check className="h-4 w-4" aria-hidden="true" />
						{savingImgbbApiKey ? 'Guardando' : 'Guardar'}
					</button>
				</div>

				<a
					href="https://api.imgbb.com/"
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-12 items-center justify-between gap-2 border-t border-[#2d3442] px-4 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#2e3543]"
				>
					<span>Obtener API key</span>
					<ExternalLink className="h-4 w-4 shrink-0 text-[#707b8e]" aria-hidden="true" />
				</a>
			</div>

			<div className={SECTION_LABEL_CLASS}>Inteligencia Artificial</div>
			<div className={GROUP_CLASS}>
				<div className="p-4">
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#14171d]">
							<GoogleGIcon className="h-5 w-5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<div className="text-[15px] font-semibold">Gemini</div>
								<span
									className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
										isGeminiConfigured ? 'bg-[#274532] text-[#bdf2c7]' : 'bg-[#3b3526] text-[#e7c77f]'
									}`}
								>
									{isGeminiConfigured && <Check className="h-3 w-3" aria-hidden="true" />}
									{isGeminiConfigured ? 'IA activa' : 'Sin configurar'}
								</span>
							</div>
							<p className="mt-1 text-xs leading-relaxed text-[#9aa5b4]">
								{isGeminiConfigured
									? 'Podrás resumir hilos con IA desde el botón Resumir.'
									: 'Añade tu API key de Gemini para resumir hilos con IA.'}
							</p>
						</div>
					</div>

					<label className="mt-4 block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]" htmlFor="mvp-mobile-lite-gemini-key">
						API key
					</label>
					<input
						id="mvp-mobile-lite-gemini-key"
						type="password"
						value={geminiApiKeyDraft}
						autoCapitalize="none"
						autoCorrect="off"
						spellCheck={false}
						onChange={event => onGeminiDraftChange(event.target.value)}
						placeholder="Pega tu API key de Gemini"
						className={`${INPUT_CLASS} mt-2 px-3 font-mono`}
					/>

					<button
						type="button"
						aria-label="Guardar API key de Gemini"
						className={`${PRIMARY_BUTTON_CLASS} mt-3 w-full`}
						disabled={savingGeminiApiKey || !isGeminiDirty}
						onClick={onSaveGeminiApiKey}
					>
						<Check className="h-4 w-4" aria-hidden="true" />
						{savingGeminiApiKey ? 'Guardando' : 'Guardar'}
					</button>

					<div className="mt-4" role="radiogroup" aria-label="Modelo de IA">
						<span className="block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]">
							Modelo
						</span>
						<div className="mt-2 overflow-hidden rounded-xl bg-[#14171d]">
							{availableModels.map((model, index) => {
								const isActive = model.value === aiModel
								return (
									<button
										key={model.value}
										type="button"
										role="radio"
										aria-checked={isActive}
										disabled={savingAiModel}
										className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-[#242a36] disabled:opacity-60 ${index > 0 ? 'border-t border-[#2d3442]' : ''}`}
										onClick={() => onSelectAiModel(model.value as GeminiModel)}
									>
										<div className="min-w-0 flex-1">
											<div className="text-sm font-semibold text-[#eef1f6]">{model.label}</div>
											<div className="mt-0.5 text-xs text-[#8b95a3]">{model.description}</div>
										</div>
										{isActive && <Check className="h-4 w-4 shrink-0 text-[#f0a020]" aria-hidden="true" />}
									</button>
								)
							})}
						</div>
					</div>
				</div>

				<a
					href="https://aistudio.google.com/apikey"
					target="_blank"
					rel="noopener noreferrer"
					className="flex h-12 items-center justify-between gap-2 border-t border-[#2d3442] px-4 text-sm font-semibold text-[#eef1f6] transition-colors active:bg-[#2e3543]"
				>
					<span>Obtener API key</span>
					<ExternalLink className="h-4 w-4 shrink-0 text-[#707b8e]" aria-hidden="true" />
				</a>
			</div>

			<div className={SECTION_LABEL_CLASS}>Apariencia</div>

			<section className={GROUP_CLASS}>
				<div className="flex min-h-[60px] items-center gap-3 py-2 pl-4 pr-2">
					<span
						className="h-7 w-7 shrink-0 rounded-lg border border-[#3a4254]"
						style={{ backgroundColor: normalizedBoldColorDraft }}
						aria-hidden="true"
					/>
					<div className="min-w-0 flex-1">
						<div className="truncate text-[15px] font-semibold text-[#eef1f6]">Color de negrita</div>
						<div className="mt-0.5 truncate text-xs text-[#8b95a3]">
							{boldColorEnabled ? 'Activo en Mediavida' : 'Se usa el color nativo'}
						</div>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Color personalizado"
						aria-checked={boldColorEnabled}
						className={SWITCH_WRAPPER_CLASS}
						disabled={savingBoldColor}
						onClick={onToggleBoldColor}
					>
						<span className={`${SWITCH_TRACK_BASE_CLASS} ${boldColorEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
							<span className={`${SWITCH_THUMB_BASE_CLASS} ${boldColorEnabled ? 'translate-x-5' : ''}`} />
						</span>
					</button>
					<button
						type="button"
						aria-expanded={boldColorExpanded}
						aria-label={boldColorExpanded ? 'Ocultar ajustes de color' : 'Editar color de negrita'}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8b95a3] transition-colors active:bg-[#2e3543]"
						onClick={onToggleBoldColorExpanded}
					>
						<ChevronDown
							className={`h-5 w-5 transition-transform ${boldColorExpanded ? 'rotate-180' : ''}`}
							aria-hidden="true"
						/>
					</button>
				</div>

				{boldColorExpanded && (
					<div className="border-t border-[#2d3442] bg-[#1c1f27] p-4">
						<label className="block px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b95a3]" htmlFor="mvp-mobile-lite-bold-color">
							Color
						</label>
						<div className="mt-2 grid grid-cols-[56px_minmax(0,1fr)] gap-2">
							<input
								id="mvp-mobile-lite-bold-color"
								type="color"
								value={normalizedBoldColorDraft}
								disabled={savingBoldColor}
								onChange={event => onBoldColorDraftChange(event.target.value)}
								className="h-11 w-full rounded-xl border border-transparent bg-[#14171d] p-1.5"
							/>
							<input
								type="text"
								value={boldColorDraft}
								autoCapitalize="none"
								autoCorrect="off"
								spellCheck={false}
								disabled={savingBoldColor}
								onChange={event => onBoldColorDraftChange(event.target.value)}
								className={`${INPUT_CLASS} px-3 font-mono`}
							/>
						</div>

						<div className="mt-3 rounded-xl bg-[#14171d] px-3 py-3 text-sm leading-relaxed text-[#cfd5db]">
							Texto normal y{' '}
							<strong style={{ color: boldColorEnabled ? normalizedBoldColorDraft : 'inherit' }}>
								texto en negrita
							</strong>
						</div>

						<div className="mt-3 grid grid-cols-2 gap-2">
							<button
								type="button"
								className={SECONDARY_BUTTON_CLASS}
								disabled={savingBoldColor || (boldColor === DEFAULT_BOLD_COLOR && normalizedBoldColorDraft === DEFAULT_BOLD_COLOR)}
								onClick={onResetBoldColor}
							>
								<RotateCcw className="h-4 w-4" aria-hidden="true" />
								Restaurar
							</button>
							<button
								type="button"
								aria-label="Guardar color de negrita"
								className={PRIMARY_BUTTON_CLASS}
								disabled={savingBoldColor || !isBoldColorDirty}
								onClick={onSaveBoldColor}
							>
								<Bold className="h-4 w-4" aria-hidden="true" />
								{savingBoldColor ? 'Guardando' : 'Guardar'}
							</button>
						</div>
					</div>
				)}
			</section>

			<div className={SECTION_LABEL_CLASS}>Hilos</div>

			<section className={`${GROUP_CLASS} divide-y divide-[#2d3442]`}>
				<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
							<Radio className="h-4 w-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#eef1f6]">Modo Live</div>
							<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
								{liveThreadEnabled ? 'Muestra el botón Live en los hilos' : 'No muestra el botón Live'}
							</div>
						</div>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Modo Live"
						aria-checked={liveThreadEnabled}
						className={SWITCH_WRAPPER_CLASS}
						disabled={savingMobileLiteSetting === 'liveThreadEnabled'}
						onClick={onToggleLiveThread}
					>
						<span className={`${SWITCH_TRACK_BASE_CLASS} ${liveThreadEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
							<span className={`${SWITCH_THUMB_BASE_CLASS} ${liveThreadEnabled ? 'translate-x-5' : ''}`} />
						</span>
					</button>
				</div>

				<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
							<Images className="h-4 w-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#eef1f6]">Botón galería</div>
							<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
								{galleryButtonEnabled ? 'Muestra el botón Galería en los hilos' : 'No muestra el botón Galería'}
							</div>
						</div>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Botón galería"
						aria-checked={galleryButtonEnabled}
						className={SWITCH_WRAPPER_CLASS}
						disabled={savingMobileLiteSetting === 'galleryButtonEnabled'}
						onClick={onToggleGallery}
					>
						<span className={`${SWITCH_TRACK_BASE_CLASS} ${galleryButtonEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
							<span className={`${SWITCH_THUMB_BASE_CLASS} ${galleryButtonEnabled ? 'translate-x-5' : ''}`} />
						</span>
					</button>
				</div>

				<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
							<TextQuote className="h-4 w-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#eef1f6]">Citar selección</div>
							<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
								{quoteSelectionEnabled
									? 'Recoloca el botón citar bajo la selección'
									: 'Usa el botón citar nativo (lo tapa el menú de Android)'}
							</div>
						</div>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Citar selección"
						aria-checked={quoteSelectionEnabled}
						className={SWITCH_WRAPPER_CLASS}
						disabled={savingMobileLiteSetting === 'quoteSelectionEnabled'}
						onClick={onToggleQuoteSelection}
					>
						<span className={`${SWITCH_TRACK_BASE_CLASS} ${quoteSelectionEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
							<span className={`${SWITCH_THUMB_BASE_CLASS} ${quoteSelectionEnabled ? 'translate-x-5' : ''}`} />
						</span>
					</button>
				</div>

				<div className="flex min-h-[60px] items-center justify-between gap-2 py-2 pl-4 pr-2">
					<div className="flex min-w-0 items-center gap-3">
						<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#14171d] text-[#f0a020]">
							<EyeOff className="h-4 w-4" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<div className="text-[15px] font-semibold text-[#eef1f6]">Botón ocultar hilos</div>
							<div className="mt-0.5 text-xs leading-relaxed text-[#8b95a3]">
								{hideThreadButtonEnabled ? 'Muestra el botón en los listados' : 'Oculta el botón de los listados'}
							</div>
						</div>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Botón ocultar hilos"
						aria-checked={hideThreadButtonEnabled}
						className={SWITCH_WRAPPER_CLASS}
						disabled={savingMobileLiteSetting === 'hideThreadEnabled'}
						onClick={onToggleHideThread}
					>
						<span className={`${SWITCH_TRACK_BASE_CLASS} ${hideThreadButtonEnabled ? 'bg-[#f0a020]' : 'bg-[#3a4254]'}`}>
							<span className={`${SWITCH_THUMB_BASE_CLASS} ${hideThreadButtonEnabled ? 'translate-x-5' : ''}`} />
						</span>
					</button>
				</div>
			</section>

			<StorageCard usage={storageUsage} />
		</div>
	)
}
