import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right'
import Copy from 'lucide-react/dist/esm/icons/copy'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import KeyRound from 'lucide-react/dist/esm/icons/key-round'
import QrCode from 'lucide-react/dist/esm/icons/qr-code'
import RefreshCcw from 'lucide-react/dist/esm/icons/refresh-ccw'
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import UsersRound from 'lucide-react/dist/esm/icons/users-round'
import VolumeX from 'lucide-react/dist/esm/icons/volume-x'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getUserCustomizations, watchUserCustomizations, type UserCustomizationsData } from '@/features/user-customizations/storage'
import {
	createMobileLiteImportUrl,
	type MobileLiteTransferSummary,
} from '@/features/ignored-users-mobile-sync'
import { useSettingsStore } from '@/store/settings-store'

interface MobileLiteQrState {
	url: string
	qrDataUrl: string
	summary: MobileLiteTransferSummary
	error: string | null
	loading: boolean
}

const EMPTY_SUMMARY: MobileLiteTransferSummary = {
	total: 0,
	hide: 0,
	mute: 0,
	hasImgbbApiKey: false,
}

function SummaryCard({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: LucideIcon
	label: string
	value: string | number
	tone: 'users' | 'hidden' | 'muted' | 'key' | 'empty'
}) {
	const toneClasses = {
		users: {
			card: 'border-primary/45 bg-primary/5',
			label: 'text-primary',
			icon: 'border-primary/35 bg-primary/15 text-primary',
		},
		hidden: {
			card: 'border-red-500/45 bg-red-500/5',
			label: 'text-red-400',
			icon: 'border-red-500/35 bg-red-500/15 text-red-400',
		},
		muted: {
			card: 'border-amber-500/45 bg-amber-500/5',
			label: 'text-amber-400',
			icon: 'border-amber-500/35 bg-amber-500/15 text-amber-400',
		},
		key: {
			card: 'border-primary/45 bg-primary/5',
			label: 'text-primary',
			icon: 'border-primary/35 bg-primary/15 text-primary',
		},
		empty: {
			card: 'border-border bg-card',
			label: 'text-muted-foreground',
			icon: 'border-border bg-muted/40 text-muted-foreground',
		},
	}[tone]
	const isKeyCard = tone === 'key' || (tone === 'empty' && label === 'API key de ImgBB')

	return (
		<div className={`min-h-[104px] rounded-lg border px-5 py-4 shadow-sm transition-colors ${toneClasses.card}`}>
			<div className="flex h-full items-center justify-between gap-4">
				<div className="min-w-0 flex-1">
					<div className={`${isKeyCard ? 'text-xl' : 'text-2xl'} font-black leading-none tracking-tight`}>{value}</div>
					<div className={`mt-2 ${isKeyCard ? 'text-xs' : 'text-sm'} font-black uppercase tracking-wide ${toneClasses.label}`}>
						{label}
					</div>
				</div>
				<div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ${toneClasses.icon}`}>
					<Icon className="h-5 w-5" aria-hidden="true" />
				</div>
			</div>
		</div>
	)
}

function pluralize(count: number, singular: string, plural: string): string {
	return count === 1 ? singular : plural
}

function formatCount(count: number, singular: string, plural: string): string {
	return `${count} ${pluralize(count, singular, plural)}`
}

export function MobileLiteQrView() {
	const navigate = useNavigate()
	const imgbbApiKey = useSettingsStore(state => state.imgbbApiKey)
	const [userData, setUserData] = useState<UserCustomizationsData | null>(null)
	const [refreshToken, setRefreshToken] = useState(0)
	const [state, setState] = useState<MobileLiteQrState>({
		url: '',
		qrDataUrl: '',
		summary: EMPTY_SUMMARY,
		error: null,
		loading: true,
	})

	useEffect(() => {
		let mounted = true

		getUserCustomizations()
			.then(data => {
				if (mounted) setUserData(data)
			})
			.catch(() => {
				if (mounted) {
					setState(current => ({
						...current,
						error: 'No se pudieron cargar los datos de usuarios.',
						loading: false,
					}))
				}
			})

		const unwatch = watchUserCustomizations(data => {
			if (mounted) setUserData(data)
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	useEffect(() => {
		if (!userData) return

		const currentUserData = userData
		let cancelled = false
		setState(current => ({ ...current, loading: true, error: null }))

		async function buildQr() {
			try {
				const result = createMobileLiteImportUrl(currentUserData, imgbbApiKey)
				if (result.summary.total === 0 && !result.summary.hasImgbbApiKey) {
					setState({
						url: '',
						qrDataUrl: '',
						summary: result.summary,
						error: null,
						loading: false,
					})
					return
				}

				const qrDataUrl = await QRCode.toDataURL(result.url, {
					errorCorrectionLevel: 'M',
					margin: 2,
					scale: 6,
				})

				if (!cancelled) {
					setState({
						url: result.url,
						qrDataUrl,
						summary: result.summary,
						error: null,
						loading: false,
					})
				}
			} catch (error) {
				if (!cancelled) {
					const message = error instanceof Error ? error.message : 'No se pudo generar el QR.'
					setState({
						url: '',
						qrDataUrl: '',
						summary: EMPTY_SUMMARY,
						error: message,
						loading: false,
					})
				}
			}
		}

		void buildQr()

		return () => {
			cancelled = true
		}
	}, [userData, imgbbApiKey, refreshToken])

	const hasData = Boolean(state.url && state.qrDataUrl)
	const isEmpty = !state.loading && !state.error && !hasData
	const configuredStatus = useMemo(
		() => (state.summary.hasImgbbApiKey ? 'Configurada' : 'No configurada'),
		[state.summary.hasImgbbApiKey]
	)
	const userCountLabel = pluralize(state.summary.total, 'Usuario', 'Usuarios')
	const hiddenCountLabel = pluralize(state.summary.hide, 'Oculto', 'Ocultos')
	const mutedCountLabel = pluralize(state.summary.mute, 'Silenciado', 'Silenciados')

	const copyLink = async () => {
		if (!state.url) return
		try {
			await navigator.clipboard.writeText(state.url)
			toast.success('Enlace copiado')
		} catch {
			toast.error('No se pudo copiar el enlace')
		}
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-20">
			<div className="rounded-lg border bg-card px-5 py-5 shadow-sm">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
							<QrCode className="h-5 w-5" aria-hidden="true" />
						</div>
						<div className="min-w-0">
							<h1 className="text-2xl font-bold tracking-tight">QR Mobile Lite</h1>
							<p className="text-sm text-muted-foreground">
								Lleva usuarios ignorados y la API key de ImgBB a Firefox Android.
							</p>
						</div>
					</div>
					<Button type="button" variant="outline" onClick={() => setRefreshToken(value => value + 1)}>
						<RefreshCcw className="h-4 w-4" />
						Actualizar
					</Button>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<SummaryCard
					icon={UsersRound}
					label={userCountLabel}
					value={state.summary.total}
					tone={state.summary.total > 0 ? 'users' : 'empty'}
				/>
				<SummaryCard
					icon={EyeOff}
					label={hiddenCountLabel}
					value={state.summary.hide}
					tone={state.summary.hide > 0 ? 'hidden' : 'empty'}
				/>
				<SummaryCard
					icon={VolumeX}
					label={mutedCountLabel}
					value={state.summary.mute}
					tone={state.summary.mute > 0 ? 'muted' : 'empty'}
				/>
				<SummaryCard
					icon={KeyRound}
					label="API key de ImgBB"
					value={configuredStatus}
					tone={state.summary.hasImgbbApiKey ? 'key' : 'empty'}
				/>
			</div>

			<Card className="overflow-hidden">
				<CardHeader className="border-b bg-muted/20">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<Smartphone className="h-4 w-4 text-primary" aria-hidden="true" />
								Exportar a Mobile Lite
							</CardTitle>
							<CardDescription>
								Escanea este QR desde Firefox Android con Mobile Lite activo o copia el enlace manualmente.
							</CardDescription>
						</div>
						<Badge variant={state.summary.hasImgbbApiKey ? 'default' : 'secondary'}>
							{state.summary.hasImgbbApiKey ? 'Incluye ImgBB' : 'Sin API key'}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-5 pt-6">
					{state.summary.hasImgbbApiKey && (
						<Alert>
							<KeyRound className="h-4 w-4" />
							<AlertTitle>El QR contiene tu API key de ImgBB</AlertTitle>
							<AlertDescription>
								Escanéalo solo en tu dispositivo. La importación en Mobile Lite siempre pedirá confirmación.
							</AlertDescription>
						</Alert>
					)}

					{isEmpty && (
						<div className="rounded-lg border bg-muted/20 p-5">
							<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
								<div className="flex gap-4">
									<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
										<ShieldCheck className="h-5 w-5" aria-hidden="true" />
									</div>
									<div className="space-y-1">
										<h3 className="font-semibold">Aún no hay datos para crear el QR</h3>
										<p className="max-w-2xl text-sm text-muted-foreground">
											Añade usuarios ocultos o silenciados, o configura tu API key de ImgBB para preparar la transferencia a Mobile Lite.
										</p>
									</div>
								</div>
								<div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
									<Button type="button" variant="outline" onClick={() => navigate('/filters?tab=users')}>
										<UsersRound className="h-4 w-4" />
										Usuarios
									</Button>
									<Button type="button" onClick={() => navigate('/settings?tab=integrations&setting=imgbb-api-key')}>
										<KeyRound className="h-4 w-4" />
										ImgBB
										<ArrowRight className="h-4 w-4" />
									</Button>
								</div>
							</div>
						</div>
					)}

					{state.error && (
						<Alert variant="destructive">
							<AlertTitle>No se pudo generar el QR</AlertTitle>
							<AlertDescription>{state.error}</AlertDescription>
						</Alert>
					)}

					{state.loading && (
						<div className="flex min-h-[320px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
							Generando QR...
						</div>
					)}

					{hasData && !state.loading && (
						<div className="grid gap-4 lg:grid-cols-[minmax(280px,420px)_1fr] lg:items-start">
							<div className="rounded-lg border bg-muted/20 p-3">
								<div className="rounded-md bg-white p-4 shadow-sm">
									<img src={state.qrDataUrl} alt="QR Mobile Lite" className="mx-auto h-auto w-full max-w-sm" />
								</div>
							</div>
							<div className="flex min-h-full flex-col rounded-lg border bg-muted/20 p-4">
								<div className="flex items-start justify-between gap-3 border-b pb-4">
									<div>
										<div className="text-base font-bold">Contenido del QR</div>
										<p className="mt-1 text-sm text-muted-foreground">Resumen de lo que se importará en Mobile Lite.</p>
									</div>
									<Badge variant="outline">URL local</Badge>
								</div>

								<div className="mt-4 grid gap-3">
									<div className="rounded-lg border bg-background/45 p-3">
										<div className="flex items-center justify-between gap-3">
											<div className="flex items-center gap-2">
												<UsersRound className="h-4 w-4 text-primary" aria-hidden="true" />
												<span className="text-sm font-semibold">{userCountLabel}</span>
											</div>
											<span className="text-lg font-black">{state.summary.total}</span>
										</div>
										<div className="mt-2 text-xs text-muted-foreground">
											{formatCount(
												state.summary.total,
												'usuario ignorado o silenciado',
												'usuarios ignorados o silenciados'
											)}
										</div>
									</div>

									<div className="grid gap-3 sm:grid-cols-2">
										<div className="rounded-lg border bg-background/45 p-3">
											<div className="flex items-center justify-between gap-3">
												<div className="flex items-center gap-2">
													<EyeOff className="h-4 w-4 text-red-400" aria-hidden="true" />
													<span className="text-sm font-semibold">{hiddenCountLabel}</span>
												</div>
												<span className="font-black">{state.summary.hide}</span>
											</div>
											<div className="mt-2 text-xs text-muted-foreground">
												{formatCount(state.summary.hide, 'oculto', 'ocultos')}
											</div>
										</div>

										<div className="rounded-lg border bg-background/45 p-3">
											<div className="flex items-center justify-between gap-3">
												<div className="flex items-center gap-2">
													<VolumeX className="h-4 w-4 text-amber-400" aria-hidden="true" />
													<span className="text-sm font-semibold">{mutedCountLabel}</span>
												</div>
												<span className="font-black">{state.summary.mute}</span>
											</div>
											<div className="mt-2 text-xs text-muted-foreground">
												{formatCount(state.summary.mute, 'silenciado', 'silenciados')}
											</div>
										</div>
									</div>

									<div className="flex items-center justify-between gap-3 rounded-lg border bg-background/45 p-3">
										<div className="flex min-w-0 items-center gap-2">
											<KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
											<span className="truncate text-sm font-semibold">API key de ImgBB</span>
										</div>
										<Badge variant={state.summary.hasImgbbApiKey ? 'default' : 'secondary'}>
											{state.summary.hasImgbbApiKey ? 'Incluida' : 'No incluida'}
										</Badge>
									</div>
								</div>

								<div className="mt-auto pt-4">
									<Button type="button" className="w-full justify-center sm:w-auto" onClick={copyLink}>
										<Copy className="h-4 w-4" />
										Copiar enlace
									</Button>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
