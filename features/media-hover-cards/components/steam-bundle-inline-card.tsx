import { useEffect, useRef, useState } from 'react'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Package from 'lucide-react/dist/esm/icons/package'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { fetchSteamBundleDetailsViaBackground, type SteamBundleDetails } from '@/services/api/steam'
import { logger } from '@/lib/logger'

interface SteamBundleInlineCardProps {
	bundleId: number
	url: string
}

const SteamLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
	<svg className={className} viewBox="0 0 256 259" xmlns="http://www.w3.org/2000/svg">
		<path
			d="M127.779 0C60.42 0 5.24 52.412.436 119.036l68.48 28.281c5.803-3.97 12.81-6.291 20.366-6.291.677 0 1.345.028 2.012.06l30.465-44.116v-.618c0-26.342 21.456-47.77 47.834-47.77 26.378 0 47.833 21.445 47.833 47.82 0 26.375-21.472 47.834-47.85 47.834-.395 0-.78-.017-1.168-.025l-43.42 30.967c.017.556.042 1.11.042 1.674 0 19.771-16.07 35.833-35.849 35.833-17.39 0-31.909-12.397-35.228-28.844l-49.02-20.262C28.353 224.848 73.298 259 127.78 259c70.697 0 128.003-57.288 128.003-127.952C255.782 57.305 198.476 0 127.779 0zm-54.82 194.602-15.453-6.372c2.74 5.678 7.242 10.527 13.139 13.445 12.805 6.337 28.36 1.135 34.713-11.636 3.074-6.198 3.36-13.03.801-19.238-2.553-6.2-7.525-10.983-14.007-13.47-6.424-2.462-13.19-2.352-19.164.085l15.973 6.603c9.447 3.9 13.927 14.704 10.01 24.126-3.909 9.414-14.73 13.869-24.143 9.93l.13.527zm100.635-93.18c0-17.574-14.306-31.856-31.908-31.856-17.602 0-31.908 14.29-31.908 31.873 0 17.575 14.306 31.857 31.908 31.857 17.602 0 31.908-14.282 31.908-31.874zm-55.822.05c0-13.227 10.727-23.938 23.964-23.938 13.244 0 23.971 10.71 23.971 23.937 0 13.228-10.727 23.946-23.971 23.946-13.237 0-23.964-10.71-23.964-23.946z"
			fill="currentColor"
		/>
	</svg>
)

const WindowsIcon = () => (
	<svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
		<path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
	</svg>
)

const MacIcon = () => (
	<svg className="h-4 w-4" viewBox="0 0 384 512" fill="currentColor">
		<path d="M318.7 268.4c-.2-36.7 16.4-64.6 49.7-84.9-18.6-26.5-46.8-41.1-84.1-44.2-35.3-2.8-73.9 20.6-88 20.6-14.9 0-49.4-19.6-76.3-19.6C64.9 141 24 186.1 24 273.1 24 299.1 29.3 326 39.9 353.6c14.1 36.7 64.8 126.6 117.6 125.1 27.6-.7 47.1-19.6 83.1-19.6 34.9 0 52.9 19.6 83.7 19.6 53.2-.8 99.3-82.5 112.7-119.3-72-34-68.3-104.1-68.3-109zm-56.5-164.8c27.1-32.1 24.6-61.3 23.8-71.6-23.9 1.4-51.6 16.2-67.4 34.4-17.4 19.8-27.6 44.3-25.4 71.8 25.8 2 49.4-11.2 69-34.6z" />
	</svg>
)

function parsePriceNumber(value: string | null): number | null {
	if (!value) return null

	const cleaned = value.replace(/\s+/g, '').replace(/[^\d,.-]/g, '')
	if (!cleaned) return null

	const lastComma = cleaned.lastIndexOf(',')
	const lastDot = cleaned.lastIndexOf('.')

	let normalized = cleaned
	if (lastComma !== -1 && lastDot !== -1) {
		if (lastComma > lastDot) {
			normalized = cleaned.replace(/\./g, '').replace(',', '.')
		} else {
			normalized = cleaned.replace(/,/g, '')
		}
	} else if (lastComma !== -1) {
		normalized = cleaned.replace(',', '.')
	}

	const parsed = Number.parseFloat(normalized)
	return Number.isFinite(parsed) ? parsed : null
}

function isSamePrice(a: string | null, b: string | null): boolean {
	if (!a || !b) return false

	const aNumber = parsePriceNumber(a)
	const bNumber = parsePriceNumber(b)
	if (aNumber !== null && bNumber !== null) {
		return Math.abs(aNumber - bNumber) < 0.01
	}

	const normalizeText = (value: string) => value.replace(/\s+/g, '').toLowerCase()
	return normalizeText(a) === normalizeText(b)
}

function PriceBlock({
	price,
	originalPrice,
	baseDiscountPercent,
	discountPercent,
}: {
	price: string | null
	originalPrice: string | null
	baseDiscountPercent: number
	discountPercent: number
}) {
	const finalPriceText = price || 'Ver precio'
	const hasDualDiscount = baseDiscountPercent > 0 && discountPercent > 0 && baseDiscountPercent !== discountPercent
	const singleDiscountPercent = hasDualDiscount ? 0 : Math.max(baseDiscountPercent, discountPercent)
	const showOriginalPrice = hasDualDiscount && Boolean(originalPrice && price && !isSamePrice(originalPrice, price))
	const showSinglePriceLabel = singleDiscountPercent > 0 && finalPriceText !== 'Ver precio'

	return (
		<div className="flex items-center gap-1">
			{hasDualDiscount && (
				<span className="inline-flex h-8 items-center rounded-[var(--radius)] bg-black/80 px-2 text-base font-normal leading-none text-[#b8b6b4] line-through">
					-{baseDiscountPercent}%
				</span>
			)}

			{hasDualDiscount && (
				<span className="inline-flex h-8 items-center rounded-[var(--radius)] bg-[#4c6b22] px-2 text-base font-extrabold leading-none text-[#beee11]">
					-{discountPercent}%
				</span>
			)}

			{singleDiscountPercent > 0 && !hasDualDiscount && (
				<span className="inline-flex h-8 items-center rounded-[var(--radius)] bg-black px-2 text-base font-normal leading-none text-[#b8b6b4]">
					-{singleDiscountPercent}%
				</span>
			)}

			{hasDualDiscount ? (
				<div className="flex h-8 min-w-[74px] flex-col items-end justify-center rounded-[var(--radius)] bg-[#4c6b22] px-2">
					{showOriginalPrice ? (
						<span className="text-[10px] leading-none text-[#b6d28a] line-through">{originalPrice}</span>
					) : (
						<span className="text-[10px] leading-none text-[#d2e885]">&nbsp;</span>
					)}
					<span className="text-[13px] leading-none text-[#beee11]">{finalPriceText}</span>
				</div>
			) : singleDiscountPercent > 0 ? (
				<div className="flex h-8 min-w-[74px] flex-col items-end justify-center rounded-[var(--radius)] bg-black px-2">
					{showSinglePriceLabel ? (
						<span className="text-[10px] leading-none text-white/85">Tu precio:</span>
					) : (
						<span className="text-[10px] leading-none text-white/85">&nbsp;</span>
					)}
					<span className="text-[13px] leading-none text-white">{finalPriceText}</span>
				</div>
			) : (
				<span className="inline-flex h-8 min-w-[74px] items-center justify-center rounded-[var(--radius)] bg-gradient-to-b from-[#799905] to-[#536904] px-3 text-[13px] text-[#d2e885]">
					{finalPriceText}
				</span>
			)}
		</div>
	)
}

export function SteamBundleInlineCard({ bundleId, url }: SteamBundleInlineCardProps) {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [data, setData] = useState<SteamBundleDetails | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [shouldLoad, setShouldLoad] = useState(false)
	const [hasImageError, setHasImageError] = useState(false)

	useEffect(() => {
		const node = containerRef.current
		if (shouldLoad) return
		if (!node) return

		if (!('IntersectionObserver' in window)) {
			setShouldLoad(true)
			return
		}

		const viewportObserver = new IntersectionObserver(
			entries => {
				const isVisible = entries.some(entry => entry.isIntersecting)
				if (!isVisible) return
				setShouldLoad(true)
				viewportObserver.disconnect()
			},
			{
				rootMargin: '320px 0px',
				threshold: 0.01,
			}
		)

		viewportObserver.observe(node)

		return () => {
			viewportObserver.disconnect()
		}
	}, [shouldLoad])

	useEffect(() => {
		if (!shouldLoad) return

		let cancelled = false
		setIsLoading(true)
		setData(null)
		setHasImageError(false)

		async function loadBundle() {
			try {
				const bundle = await fetchSteamBundleDetailsViaBackground(bundleId)
				if (cancelled) return
				setData(bundle)
			} catch (error) {
				logger.error('Failed to load Steam bundle inline card:', error)
			} finally {
				if (!cancelled) {
					setIsLoading(false)
				}
			}
		}

		void loadBundle()

		return () => {
			cancelled = true
		}
	}, [bundleId, shouldLoad])

	const bundleUrl = data?.bundleUrl || url

	if (!shouldLoad) {
		return (
			<div ref={containerRef} className="mt-2 w-full max-w-[640px]">
				<div className="flex h-[116px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[#3d5a73] bg-[linear-gradient(135deg,#1b2838_0%,#2a475e_100%)] text-[#8f98a0]">
					<span className="text-sm">Bundle detectado. Se cargara al entrar en pantalla.</span>
				</div>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className="mt-2 w-full max-w-[640px]">
				<div className="flex h-[116px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[#3d5a73] bg-[linear-gradient(135deg,#1b2838_0%,#2a475e_100%)] text-[#8f98a0]">
					<div className="flex items-center gap-2 text-sm">
						<Loader2 className="h-4 w-4 animate-spin text-[#67c1f5]" />
						Cargando bundle de Steam...
					</div>
				</div>
			</div>
		)
	}

	if (!data) {
		return (
			<div className="mt-2 w-full max-w-[640px]">
				<a
					href={bundleUrl}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={`Abrir bundle de Steam #${bundleId}`}
					className="relative flex h-[116px] items-center justify-between overflow-hidden rounded-[var(--radius)] border border-[#3d5a73] bg-[linear-gradient(135deg,#1b2838_0%,#2a475e_100%)] px-4 text-[#c7d5e0] no-underline transition-colors hover:border-[#66c0f4] hover:shadow-[0_4px_16px_rgba(102,192,244,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66c0f4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b2838]"
				>
					<div className="flex items-center gap-2">
						<Package className="h-4 w-4 text-[#8f98a0]" />
						<span className="text-sm">Steam Bundle #{bundleId}</span>
					</div>
					<ExternalLink className="h-4 w-4 text-[#8f98a0]" />
				</a>
			</div>
		)
	}

	const secondaryParts: string[] = []
	if (data.itemCount && data.itemCount > 0) {
		secondaryParts.push(`${data.itemCount} elementos`)
	}
	if (data.appIds.length > 0) {
		secondaryParts.push(`${data.appIds.length} juegos`)
	}
	const secondaryText = secondaryParts.length > 0 ? secondaryParts.join(' · ') : 'Bundle de Steam'
	const supportsWindows = data.supportsWindows ?? true
	const supportsMac = data.supportsMac ?? false
	const supportsLinux = data.supportsLinux ?? false
	const hasExplicitPlatforms = supportsWindows || supportsMac || supportsLinux

	return (
		<div className="mt-2 w-full max-w-[640px]">
			<a
				href={bundleUrl}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`Abrir bundle de Steam: ${data.name}`}
				className="group relative flex h-[116px] w-full overflow-hidden rounded-[var(--radius)] border border-[#3d5a73] bg-[linear-gradient(135deg,#1b2838_0%,#2a475e_100%)] text-[#c7d5e0] no-underline transition-colors hover:border-[#66c0f4] hover:shadow-[0_4px_16px_rgba(102,192,244,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66c0f4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b2838]"
			>
				<div className="h-full w-[230px] shrink-0 overflow-hidden bg-[#171a21]">
					{data.headerImage && !hasImageError ? (
						<img
							src={data.headerImage}
							alt={data.name}
							className="h-full w-full object-cover object-center"
							loading="lazy"
							onError={() => setHasImageError(true)}
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-[#8f98a0]">
							<Package className="h-6 w-6" />
						</div>
					)}
				</div>

				<div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-4 pr-[90px]">
					<h4 className="truncate text-[16px] font-medium text-[#c7d5e0] transition-colors group-hover:text-white">
						{data.name}
					</h4>
					<p className="text-[12px] uppercase tracking-wide text-[#8f98a0]">Steam Bundle</p>
					<p className="truncate text-[11px] text-[#67c1f5]">{secondaryText}</p>
					<div className="flex items-center gap-1 pt-0.5 text-[#8f98a0]">
						{supportsWindows && <WindowsIcon />}
						{supportsMac && <MacIcon />}
						{supportsLinux && <SteamLogo className="h-4 w-4" />}
						{!hasExplicitPlatforms && <WindowsIcon />}
					</div>
				</div>

				<div className="absolute right-2 top-2 text-[#67c1f5]/70 transition-opacity group-hover:text-[#67c1f5]">
					<SteamLogo />
				</div>

				<div className="absolute bottom-2 right-2 flex items-center gap-1">
					<PriceBlock
						price={data.price}
						originalPrice={data.originalPrice}
						baseDiscountPercent={data.baseDiscountPercent}
						discountPercent={data.discountPercent}
					/>
				</div>
			</a>
		</div>
	)
}
