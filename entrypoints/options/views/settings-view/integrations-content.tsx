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
import { ProviderStatusBadge } from '../../components/settings/provider-status-badge'
import { useSettingsStore } from '@/store/settings-store'
import { getAvailableModels, testGeminiConnection } from '@/services/ai/gemini-service'
import { getAvailableGroqModels, testGroqConnection } from '@/services/ai/groq-service'
import type { AIProvider, GeminiModel, GroqModel } from '@/store/settings-types'

export function IntegrationsContent() {
	const { imgbbApiKey, setImgbbApiKey } = useSettingsStore()
	const [imgbbExpanded, setImgbbExpanded] = useState(false)

	// Gemini state
	const { geminiApiKey, setGeminiApiKey, aiModel, setAIModel } = useSettingsStore()
	const [testingGemini, setTestingGemini] = useState(false)
	const [geminiExpanded, setGeminiExpanded] = useState(false)

	// Groq state
	const { groqApiKey, setGroqApiKey, groqModel, setGroqModel } = useSettingsStore()
	const [testingGroq, setTestingGroq] = useState(false)
	const [groqExpanded, setGroqExpanded] = useState(false)

	// AI Provider state
	const { aiProvider, setAIProvider } = useSettingsStore()

	// Test Gemini connection and validate selected model
	const handleTestGemini = async () => {
		if (!geminiApiKey) return
		setTestingGemini(true)
		try {
			const result = await testGeminiConnection(geminiApiKey)

			if (result.success) {
				toast.success('Conexión exitosa', { description: result.message })

				// Check if the currently selected model is available
				if (result.availableModelIds && aiModel) {
					const isModelAvailable = result.availableModelIds.some(
						id => id === aiModel || id.startsWith(aiModel)
					)
					if (!isModelAvailable) {
						const modelLabel = availableGeminiModels.find(m => m.value === aiModel)?.label || aiModel
						toast.warning(`Modelo "${modelLabel}" no encontrado`, {
							description: 'Este modelo no está disponible en tu cuenta. Considera cambiar a otro.',
							duration: 8000,
						})
					}
				}
			} else {
				toast.error('Error de conexión', { description: result.message })
			}
		} catch {
			toast.error('Error de red', { description: 'No se pudo conectar con Google AI' })
		} finally {
			setTestingGemini(false)
		}
	}

	// Test Groq connection
	const handleTestGroq = async () => {
		if (!groqApiKey) return
		setTestingGroq(true)
		try {
			const result = await testGroqConnection(groqApiKey)

			if (result.success) {
				toast.success('Conexión exitosa', { description: result.message })
			} else {
				toast.error('Error de conexión', { description: result.message })
			}
		} catch {
			toast.error('Error de red', { description: 'No se pudo conectar con Groq' })
		} finally {
			setTestingGroq(false)
		}
	}

	// Helper to show toast on change
	const withToast =
		<T,>(setter: (val: T) => void) =>
		(val: T) => {
			setter(val)
			toast.success('Configuración guardada')
		}

	// Available models
	const availableGeminiModels = getAvailableModels()
	const availableGroqModels = getAvailableGroqModels()

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
							<h4 className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
								Alojamiento de Imágenes (Base: freeimage.host)
								<ProviderStatusBadge isConfigured={!!imgbbApiKey} />
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
											href="https://freeimage.host/"
											target="_blank"
											rel="noopener noreferrer"
											className="font-bold decoration-primary/30 hover:decoration-primary transition-colors text-primary"
										>
											freeimage.host
										</a>{' '}
										(hasta 64MB, permanente)
									</>
								)}
							</p>

							<button
								onClick={() => setImgbbExpanded(!imgbbExpanded)}
								aria-expanded={imgbbExpanded}
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
							placeholder="Dejar vacío para usar freeimage.host"
							label="ImgBB"
						/>
					</div>
				</div>

				{imgbbExpanded && (
					<div className="text-xs text-muted-foreground space-y-2 pl-8 border-l-2 border-muted ml-2.5 animate-in slide-in-from-top-2 duration-200">
						<p>
							<strong>Por defecto</strong>, las imágenes se suben a{' '}
							<a
								href="https://freeimage.host/"
								target="_blank"
								rel="noopener noreferrer"
								className="text-primary hover:underline inline-flex items-center gap-0.5"
							>
								freeimage.host
								<ExternalLink className="h-3 w-3" />
							</a>{' '}
							de forma automática. Almacenamiento permanente y gratuito.
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
							ImgBB tiene un límite de 32MB. freeimage.host permite hasta 64MB.
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
							<h4 className="text-sm font-medium leading-none flex items-center gap-2">
								Google Gemini API
								<ProviderStatusBadge isConfigured={!!geminiApiKey} />
							</h4>
							<p className="text-sm text-muted-foreground mt-1.5 max-w-[350px]">
								IA en la nube con modelos potentes (gratis con límites)
							</p>

							<div className="flex items-center gap-4 mt-2">
								<button
									onClick={() => setGeminiExpanded(!geminiExpanded)}
									aria-expanded={geminiExpanded}
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

			{/* Groq API Card */}
			<div className="flex flex-col gap-4 py-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex gap-3">
						<Zap className="h-5 w-5 mt-0.5 text-orange-500" />
						<div>
							<h4 className="text-sm font-medium leading-none flex items-center gap-2">
								Groq API
								<ProviderStatusBadge isConfigured={!!groqApiKey} />
							</h4>
							<p className="text-sm text-muted-foreground mt-1.5 max-w-[350px]">
								IA ultra-rápida con Kimi K2 (gratis con límites)
							</p>

							<div className="flex items-center gap-4 mt-2">
								<button
									onClick={() => setGroqExpanded(!groqExpanded)}
									aria-expanded={groqExpanded}
									className="flex items-center gap-1 text-xs text-primary hover:underline"
								>
									<ChevronDown className={cn('h-3 w-3 transition-transform', groqExpanded && 'rotate-180')} />
									{groqExpanded ? 'Ocultar detalles' : 'Cómo obtener API Key'}
								</button>

								{groqApiKey && (
									<button
										onClick={handleTestGroq}
										disabled={testingGroq}
										className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-500 transition-colors disabled:opacity-50"
									>
										{testingGroq ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
										Probar conexión
									</button>
								)}
							</div>
						</div>
					</div>

					{/* API Key Input */}
					<div className="flex-shrink-0">
						<ApiKeyInput value={groqApiKey} onChange={setGroqApiKey} placeholder="gsk_..." label="Groq" />
					</div>
				</div>

				{groqExpanded && (
					<div className="text-xs text-muted-foreground space-y-2 pl-8 border-l-2 border-muted ml-2.5 animate-in slide-in-from-top-2 duration-200">
						<ol className="list-decimal list-inside space-y-1.5">
							<li>
								Ve a{' '}
								<a
									href="https://console.groq.com/keys"
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary hover:underline"
								>
									Groq Console
								</a>
							</li>
							<li>Crea una cuenta o inicia sesión</li>
							<li>
								Haz clic en <strong>"Create API Key"</strong>
							</li>
							<li>Copia la clave y pégala arriba</li>
						</ol>
						<p className="text-amber-500 dark:text-amber-400 mt-2 flex items-center gap-1">
							<AlertCircle className="h-3 w-3" />
							Groq es muy rápido. Kimi K2 tiene un límite de tokens por minuto en el plan gratuito.
						</p>
					</div>
				)}
			</div>

			<Separator />

			{/* AI Provider Selection */}
			<SettingRow
				icon={<Sparkles className="h-4 w-4 text-purple-500" />}
				label="Proveedor IA por defecto"
				description="Elige qué servicio usar para resumir y otras tareas IA."
			>
				<Select value={aiProvider} onValueChange={val => withToast(setAIProvider)(val as AIProvider)}>
					<SelectTrigger className="w-[200px] h-auto min-h-[3rem] py-3 [&>span]:text-left">
						<SelectValue placeholder="Seleccionar proveedor" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="gemini" className="py-3 cursor-pointer">
							<div className="flex flex-col gap-1.5">
								<span className="font-semibold text-sm">Google Gemini</span>
								<span className="text-xs text-muted-foreground leading-normal">Recomendado - Alto rendimiento</span>
							</div>
						</SelectItem>
						<SelectItem value="groq" className="py-3 cursor-pointer">
							<div className="flex flex-col gap-1.5">
								<span className="font-semibold text-sm">Groq</span>
								<span className="text-xs text-muted-foreground leading-normal">Ultra rápido - Kimi K2</span>
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>

			{/* Model Selection - Gemini */}
			<SettingRow
				icon={<Settings2 className="h-4 w-4" />}
				label="Modelo Gemini"
				description="Modelo de Google para resumir e IA."
			>
				<Select value={aiModel} onValueChange={val => withToast(setAIModel)(val as GeminiModel)}>
					<SelectTrigger className="w-[200px] h-auto min-h-[3rem] py-3 [&>span]:text-left">
						<SelectValue placeholder="Seleccionar modelo" />
					</SelectTrigger>
					<SelectContent>
						{availableGeminiModels.map(model => (
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

			{/* Model Selection - Groq */}
			<SettingRow
				icon={<Zap className="h-4 w-4 text-orange-500" />}
				label="Modelo Groq"
				description="Modelo Groq para tareas rápidas."
			>
				<Select value={groqModel} onValueChange={val => withToast(setGroqModel)(val as GroqModel)}>
					<SelectTrigger className="w-[200px] h-auto min-h-[3rem] py-3 [&>span]:text-left">
						<SelectValue placeholder="Seleccionar modelo" />
					</SelectTrigger>
					<SelectContent>
						{availableGroqModels.map(model => (
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

