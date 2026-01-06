/**
 * Integrations Content - API Keys configuration
 */
import { useState } from 'react'
import Image from 'lucide-react/dist/esm/icons/image'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow, ApiKeyInput } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'
import { getAvailableModels } from '@/services/ai/gemini-service'

export function IntegrationsContent() {
	const { imgbbApiKey, setImgbbApiKey } = useSettingsStore()
	const [imgbbExpanded, setImgbbExpanded] = useState(false)

	const { geminiApiKey, setGeminiApiKey, aiModel, setAIModel } = useSettingsStore()

	const [testingGemini, setTestingGemini] = useState(false)
	const [geminiExpanded, setGeminiExpanded] = useState(false)

	// Test Gemini connection
	const handleTestGemini = async () => {
		if (!geminiApiKey) return
		setTestingGemini(true)
		try {
			const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`)
			if (response.ok) {
				const data = await response.json()
				const modelCount = data.models?.length || 0
				toast.success('Conexión exitosa', { description: `${modelCount} modelos disponibles.` })
			} else {
				const error = await response.json()
				toast.error('Error de conexión', { description: error.error?.message || 'API Key inválida' })
			}
		} catch {
			toast.error('Error de red', { description: 'No se pudo conectar con Google AI' })
		} finally {
			setTestingGemini(false)
		}
	}

	// Helper to show toast on change
	const withToast =
		<T,>(setter: (val: T) => void) =>
		(val: T) => {
			setter(val)
			toast.success('Configuración guardada')
		}

	// Available Gemini models
	const availableModels = getAvailableModels()

	return (
		<SettingsSection
			title="Integraciones"
			description="Configura las claves de acceso a servicios externos e Inteligencia Artificial."
		>
			{/* Image Upload Row */}
			<div className="flex flex-col gap-4 py-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex gap-3">
						<Image className="h-5 w-5 mt-0.5" />
						<div>
							<h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
								Alojamiento de Imágenes (Base: Catbox)
							</h4>
							<p className="text-sm text-muted-foreground mt-1.5 max-w-[350px]">
								{imgbbApiKey ? (
									<>
										Personalizado con <strong>ImgBB</strong> (hasta 32MB)
									</>
								) : (
									<>
										Servicio base activo:{' '}
										<a
											href="https://catbox.moe/"
											target="_blank"
											rel="noopener noreferrer"
											className="font-bold decoration-primary/30 hover:decoration-primary transition-colors text-primary"
										>
											Catbox.moe
										</a>{' '}
										(hasta 200MB)
									</>
								)}
							</p>

							<button
								onClick={() => setImgbbExpanded(!imgbbExpanded)}
								className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
							>
								<ChevronDown className={cn('h-3 w-3 transition-transform', imgbbExpanded && 'rotate-180')} />
								{imgbbExpanded ? 'Ocultar detalles' : 'Configurar ImgBB (Opcional)'}
							</button>
						</div>
					</div>

					{/* API Key Input */}
					<div>
						<ApiKeyInput
							value={imgbbApiKey}
							onChange={setImgbbApiKey}
							placeholder="Dejar vacío para usar Catbox"
							label="ImgBB"
						/>
					</div>
				</div>

				{imgbbExpanded && (
					<div className="text-xs text-muted-foreground space-y-2 pl-8 border-l-2 border-muted ml-2.5 animate-in slide-in-from-top-2 duration-200">
						<p>
							<strong>Por defecto</strong>, las imágenes se suben a{' '}
							<a
								href="https://catbox.moe/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline inline-flex items-center gap-0.5"
							>
								Catbox.moe
								<ExternalLink className="h-3 w-3" />
							</a>{' '}
							de forma anónima. Es rápido y no requiere configuración.
						</p>
						<p>
							<strong>Si prefieres ImgBB:</strong>
						</p>
						<ol className="list-decimal list-inside space-y-1.5">
							<li>
								Ve a{' '}
								<a
									href="https://imgbb.com/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline inline-flex items-center gap-0.5"
								>
									imgbb.com
									<ExternalLink className="h-3 w-3" />
								</a>
							</li>
							<li>Crea una cuenta o inicia sesión</li>
							<li>
								Ve a <strong>About → API</strong>
							</li>
							<li>Copia tu API key y pégala arriba</li>
						</ol>
						<p className="text-amber-500 dark:text-amber-400 mt-2 flex items-center gap-1">
							<AlertCircle className="h-3 w-3" />
							ImgBB tiene un límite de 32MB. Catbox permite hasta 200MB.
						</p>
					</div>
				)}
			</div>

			<Separator />

			{/* Gemini API Card */}
			<div className="flex flex-col gap-4 py-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex gap-3">
						<Sparkles className="h-5 w-5 mt-0.5 text-purple-500" />
						<div>
							<h4 className="text-sm font-medium leading-none">Google Gemini API</h4>
							<p className="text-sm text-muted-foreground mt-1.5 max-w-[350px]">
								IA en la nube con modelos potentes (gratis con límites)
							</p>

							<div className="flex items-center gap-4 mt-2">
								<button
									onClick={() => setGeminiExpanded(!geminiExpanded)}
									className="flex items-center gap-1 text-xs text-primary hover:underline"
								>
									<ChevronDown className={cn('h-3 w-3 transition-transform', geminiExpanded && 'rotate-180')} />
									{geminiExpanded ? 'Ocultar detalles' : 'Cómo obtener API Key'}
								</button>

								{geminiApiKey && (
									<button
										onClick={handleTestGemini}
										disabled={testingGemini}
										className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-purple-500 transition-colors disabled:opacity-50"
									>
										{testingGemini ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
										Probar conexión
									</button>
								)}
							</div>
						</div>
					</div>

					{/* API Key Input */}
					<div className="flex-shrink-0">
						<ApiKeyInput value={geminiApiKey} onChange={setGeminiApiKey} placeholder="AIza..." label="Gemini" />
					</div>
				</div>

				{geminiExpanded && (
					<div className="text-xs text-muted-foreground space-y-2 pl-8 border-l-2 border-muted ml-2.5 animate-in slide-in-from-top-2 duration-200">
						<ol className="list-decimal list-inside space-y-1.5">
							<li>
								Ve a{' '}
								<a
									href="https://aistudio.google.com/apikey"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									Google AI Studio
								</a>
							</li>
							<li>Inicia sesión con tu cuenta de Google</li>
							<li>
								Haz clic en <strong>"Create API Key"</strong>
							</li>
							<li>Copia la clave y pégala arriba</li>
						</ol>
						<p className="text-amber-500 dark:text-amber-400 mt-2 flex items-center gap-1">
							<AlertCircle className="h-3 w-3" />
							La clave es gratuita pero tiene un límite de ~60 consultas/minuto.
						</p>
					</div>
				)}
			</div>

			<Separator />

			{/* Model Selection */}
			<SettingRow
				icon={<Settings2 className="h-4 w-4" />}
				label="Modelo de IA"
				description="Selecciona qué modelo de Gemini usar."
			>
				<Select value={aiModel} onValueChange={val => withToast(setAIModel)(val as typeof aiModel)}>
					<SelectTrigger className="w-[200px] h-auto min-h-[3rem] py-3 [&>span]:text-left">
						<SelectValue placeholder="Seleccionar modelo" />
					</SelectTrigger>
					<SelectContent>
						{availableModels.map(model => (
							<SelectItem key={model.value} value={model.value} className="py-3 cursor-pointer">
								<div className="flex flex-col gap-1.5">
									<span className="font-semibold text-sm">{model.label}</span>
									{model.description && (
										<span className="text-xs text-muted-foreground leading-normal">{model.description}</span>
									)}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</SettingRow>
		</SettingsSection>
	)
}
