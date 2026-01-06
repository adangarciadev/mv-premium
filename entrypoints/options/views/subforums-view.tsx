import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { getTimeStats, watchTimeStats } from '@/features/stats/logic/time-tracker'
import { getSubforumStyle } from '@/lib/subforum-icons'
import { getSubforumName, ALL_SUBFORUMS } from '@/lib/subforums'
import { cn } from '@/lib/utils'
import { formatPreciseTimeShort } from '@/lib/format-utils'
import { storage } from '#imports'
import { ICONS_STORAGE_KEY, type FidIconStyle } from '@/features/icons/icon-syncer'

// Icons
import Hash from 'lucide-react/dist/esm/icons/hash'
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle'
import Landmark from 'lucide-react/dist/esm/icons/landmark'
import Video from 'lucide-react/dist/esm/icons/video'
import Bitcoin from 'lucide-react/dist/esm/icons/bitcoin'
import GraduationCap from 'lucide-react/dist/esm/icons/graduation-cap'
import FlaskConical from 'lucide-react/dist/esm/icons/flask-conical'
import Music from 'lucide-react/dist/esm/icons/music'
import Film from 'lucide-react/dist/esm/icons/film'
import Tv from 'lucide-react/dist/esm/icons/tv'
import BookOpen from 'lucide-react/dist/esm/icons/book-open'
import Trophy from 'lucide-react/dist/esm/icons/trophy'
import Medal from 'lucide-react/dist/esm/icons/medal'
import Car from 'lucide-react/dist/esm/icons/car'
import ChefHat from 'lucide-react/dist/esm/icons/chef-hat'
import Dumbbell from 'lucide-react/dist/esm/icons/dumbbell'
import PawPrint from 'lucide-react/dist/esm/icons/paw-print'
import Plane from 'lucide-react/dist/esm/icons/plane'
import ShoppingCart from 'lucide-react/dist/esm/icons/shopping-cart'
import PiggyBank from 'lucide-react/dist/esm/icons/piggy-bank'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Gamepad2 from 'lucide-react/dist/esm/icons/gamepad-2'
import Swords from 'lucide-react/dist/esm/icons/swords'
import Dice5 from 'lucide-react/dist/esm/icons/dice-5'
import Skull from 'lucide-react/dist/esm/icons/skull'
import Sword from 'lucide-react/dist/esm/icons/sword'
import Smartphone from 'lucide-react/dist/esm/icons/smartphone'
import Repeat from 'lucide-react/dist/esm/icons/repeat'
import Code2 from 'lucide-react/dist/esm/icons/code-2'
import Cpu from 'lucide-react/dist/esm/icons/cpu'
import Monitor from 'lucide-react/dist/esm/icons/monitor'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'

// Icon Mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
	'message-circle': MessageCircle,
	landmark: Landmark,
	video: Video,
	bitcoin: Bitcoin,
	'graduation-cap': GraduationCap,
	flask: FlaskConical,
	'flask-conical': FlaskConical,
	music: Music,
	film: Film,
	tv: Tv,
	'book-open': BookOpen,
	trophy: Trophy,
	car: Car,
	'chef-hat': ChefHat,
	dumbbell: Dumbbell,
	'paw-print': PawPrint,
	plane: Plane,
	'shopping-cart': ShoppingCart,
	'piggy-bank': PiggyBank,
	zap: Zap,
	'gamepad-2': Gamepad2,
	swords: Swords,
	'dice-5': Dice5,
	skull: Skull,
	sword: Sword,
	smartphone: Smartphone,
	repeat: Repeat,
	'code-2': Code2,
	cpu: Cpu,
	monitor: Monitor,
}

function SubforumIcon({
	iconStr,
	className,
	style,
	fidStyle,
}: {
	iconStr: string
	className?: string
	style?: React.CSSProperties
	fidStyle?: FidIconStyle
}) {
	if (fidStyle) {
		return (
			<i
				className={className}
				style={{
					display: 'inline-block',
					backgroundImage: fidStyle.backgroundImage,
					backgroundPosition: fidStyle.backgroundPosition,
					backgroundRepeat: 'no-repeat',
					width: '24px',
					height: '24px',
					transform: 'scale(1.5)', // Scale up slightly as they are small
					...style,
				}}
			/>
		)
	}

	if (iconStr.startsWith('/')) {
		return <img src={iconStr} alt="" className={className} style={style} />
	}

	// Extract lucide name if present
	const lucideName = iconStr.replace('lucide:', '')
	const IconComponent = ICON_MAP[lucideName] || Hash

	return <IconComponent className={className} style={style} />
}

interface SubforumStat {
	slug: string
	name: string
	iconId: number
	time: number
	formattedTime: string
	percentage: number
	icon: string
	color: string
	bgColor: string
}


export function SubforumsView() {
	const [subforums, setSubforums] = useState<SubforumStat[]>([])
	const [totalTime, setTotalTime] = useState(0)
	const [iconCache, setIconCache] = useState<Record<number, FidIconStyle>>({})
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

	useEffect(() => {
		// Load initial icon cache and watch for updates
		const unwatchIcons = storage.watch<Record<number, FidIconStyle>>(ICONS_STORAGE_KEY, newCache => {
			if (newCache) setIconCache(newCache)
		})

		// Initial fetch (in case watch doesn't fire immediately)
		storage.getItem<Record<number, FidIconStyle>>(ICONS_STORAGE_KEY).then(cache => {
			if (cache) setIconCache(cache)
		})

		async function loadData() {
			const initialStats = await getTimeStats()

			const updateStats = (stats: Record<string, number>) => {
				const entries = Object.entries(stats)
				if (entries.length === 0) {
					setSubforums([])
					setTotalTime(0)
					return
				}

				const total = Object.values(stats).reduce((acc, curr) => acc + curr, 0)

				const processed = entries
					.map(([slug, time]) => {
						const style = getSubforumStyle(slug)
						const realName = getSubforumName(slug)
						// Find icon ID
						const sfInfo = ALL_SUBFORUMS.find(s => s.slug === slug)

						return {
							slug,
							name: realName,
							iconId: sfInfo?.iconId || 0,
							time,
							formattedTime: formatPreciseTimeShort(time),
							percentage: total > 0 ? (time / total) * 100 : 0,
							icon: style.icon,
							color: style.color,
							bgColor: style.bgColor,
						}
					})
					.sort((a, b) => b.time - a.time)

				setSubforums(processed)
				setTotalTime(total)
				setLastUpdated(new Date())
			}

			updateStats(initialStats)
			const unwatchStats = watchTimeStats(updateStats)

			return () => {
				unwatchStats()
				unwatchIcons()
			}
		}

		loadData()
	}, [])

	return (
		<div className="space-y-6 animate-in fade-in duration-500 text-foreground">
			{/* Header */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold tracking-tight">Actividad por Subforo</h1>
					<span className="text-xs text-muted-foreground">
						Actualizado {lastUpdated.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
					</span>
				</div>
				<p className="text-muted-foreground">
					Has pasado un total de <span className="font-semibold text-foreground">{formatPreciseTimeShort(totalTime)}</span>{' '}
					navegando en {subforums.length} subforos.
				</p>
			</div>

			{/* Podium Section - Top 3 */}
			{subforums.length >= 3 && (
				<div className="space-y-3">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
						<Trophy className="h-4 w-4 text-yellow-500" />
						Tu Podio
					</h2>
					<div className="grid gap-4 md:grid-cols-3">
						{subforums.slice(0, 3).map((sub, index) => (
							<SubforumCard
								key={sub.slug}
								sub={sub}
								index={index}
								iconCache={iconCache}
							/>
						))}
					</div>
				</div>
			)}

			{/* Rest of subforums */}
			{subforums.length > 3 && (
				<div className="space-y-3">
					<h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
						Otros Subforos
					</h2>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{subforums.slice(3).map((sub, index) => (
							<SubforumCard
								key={sub.slug}
								sub={sub}
								index={index + 3}
								iconCache={iconCache}
							/>
						))}
					</div>
				</div>
			)}

			{/* Show all in single grid if less than 3 */}
			{subforums.length > 0 && subforums.length < 3 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{subforums.map((sub, index) => (
						<SubforumCard
							key={sub.slug}
							sub={sub}
							index={index}
							iconCache={iconCache}
						/>
					))}
				</div>
			)}
			{subforums.length === 0 && (
				<div className="py-12 text-center text-muted-foreground">
					<p>No hay actividad registrada todavía.</p>
					<p className="text-sm">Navega por el foro para empezar a ver estadísticas.</p>
				</div>
			)}
		</div>
	)
}

// Extracted Card component for reuse
function SubforumCard({
	sub,
	index,
	iconCache,
}: {
	sub: SubforumStat
	index: number
	iconCache: Record<number, FidIconStyle>
}) {
	const handleClick = () => {
		window.open(`https://www.mediavida.com/foro/${sub.slug}`, '_blank')
	}

	return (
		<Card
			className={cn(
				'overflow-hidden border-border bg-card hover:bg-accent/5 transition-all duration-300 cursor-pointer group',
				// Top 1: Gold
				index === 0 &&
					'border-yellow-500/40 bg-gradient-to-br from-card to-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.1)] ring-1 ring-yellow-500/20',
				// Top 2: Silver
				index === 1 &&
					'border-slate-400/30 bg-gradient-to-br from-card to-slate-400/5 shadow-[0_0_15px_rgba(148,163,184,0.05)] ring-1 ring-slate-400/10',
				// Top 3: Bronze
				index === 2 &&
					'border-amber-600/30 bg-gradient-to-br from-card to-amber-600/5 shadow-[0_0_15px_rgba(217,119,6,0.05)] ring-1 ring-amber-600/10'
			)}
			onClick={handleClick}
		>
			<CardContent className="p-4">
				<div className="flex items-start justify-between gap-4">
					{/* Icon & Name */}
					<div className="flex items-center gap-3">
						<div
							className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden"
							style={{
								color: sub.color,
							}}
						>
							<SubforumIcon iconStr={sub.icon} className="h-5 w-5" fidStyle={iconCache[sub.iconId]} />
						</div>
						<div className="min-w-0">
							<h3 className="font-medium leading-none truncate pr-2 flex items-center gap-1.5">
								{sub.name}
								<ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
							</h3>
							<p className="mt-1.5 text-xs text-muted-foreground font-mono flex items-center gap-1.5">
								<span className={cn("inline-block w-1.5 h-1.5 rounded-full", index === 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground")} />
								{sub.formattedTime}
							</p>
						</div>
					</div>

					{/* Rank Badges */}
					<div className="flex-shrink-0">
						{/* #1 GOLD */}
						{index === 0 && (
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
								<Trophy className="h-3.5 w-3.5 fill-yellow-500/20" />
								<span className="text-xs font-bold font-mono">#1</span>
							</div>
						)}

						{/* #2 SILVER */}
						{index === 1 && (
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-500/20 shadow-sm">
								<Trophy className="h-3.5 w-3.5 fill-slate-400/20 text-slate-500" />
								<span className="text-xs font-bold font-mono">#2</span>
							</div>
						)}

						{/* #3 BRONZE */}
						{index === 2 && (
							<div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-500 border border-amber-600/20 shadow-sm">
								<Trophy className="h-3.5 w-3.5 fill-amber-600/20 text-amber-600" />
								<span className="text-xs font-bold font-mono">#3</span>
							</div>
						)}

						{/* Other Ranks */}
						{index > 2 && (
							<span className="flex items-center justify-center w-8 h-6 text-xs font-bold font-mono rounded bg-accent/50 text-muted-foreground border border-transparent">
								#{index + 1}
							</span>
						)}
					</div>
				</div>

				{/* Progress Bar */}
				<div className="mt-5">
					<div className="flex justify-between items-end text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
						<span>Actividad Global</span>
						<span className={cn(
							index === 0 && "text-yellow-500 font-bold",
							index === 1 && "text-slate-400 font-bold",
							index === 2 && "text-amber-600 font-bold",
						)}>{sub.percentage.toFixed(1)}%</span>
					</div>
					<div className="h-1.5 w-full bg-secondary/50 rounded-full overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-700 ease-out relative",
								index === 0 && "bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 animate-gradient-x"
							)}
							style={{
								width: `${sub.percentage}%`,
								backgroundColor: index === 0 ? '' : sub.color,
								backgroundImage: index === 0 ? undefined : 'none'
							}}
						>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
