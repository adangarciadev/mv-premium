/**
 * Media Hover Card Content - Premium Wide Layout
 */
import Star from 'lucide-react/dist/esm/icons/star'
import Film from 'lucide-react/dist/esm/icons/film'
import Tv from 'lucide-react/dist/esm/icons/tv'
import User from 'lucide-react/dist/esm/icons/user'
import Calendar from 'lucide-react/dist/esm/icons/calendar'
import Clock from 'lucide-react/dist/esm/icons/clock'
import type { MediaData } from '@/services/media/unified-resolver'
import { cn } from '@/lib/utils'

interface ContentProps {
	data: MediaData
	url?: string
}

// =============================================================================
// ATOMS
// =============================================================================

// Using Mediavida's native semantic variables for perfect theme integration
function Rating({ value }: { value: number }) {
	const colorStyle =
		value >= 8 ? 'var(--mv-accent)' : // Green
		value >= 6 ? 'var(--mv-orange)' : // Orange
		value >= 5 ? 'var(--mv-orange)' : // Orange (broadened range for mid-tier)
		'var(--mv-danger)' // Red

	return (
		<div 
			className="inline-flex items-center gap-2 px-3 py-1.5 bg-muted/80 rounded-full border border-border/50 shadow-sm"
		>
			<span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">TMDB</span>
			<div className="flex items-center gap-1">
				<Star 
					className="w-4 h-4 fill-current" 
					style={{ color: colorStyle }}
				/>
				<span 
					className="text-base font-black leading-none" 
					style={{ color: colorStyle }}
				>
					{value.toFixed(1)}
				</span>
			</div>
		</div>
	)
}

function Poster({ src, alt, icon: Icon }: { src: string | null; alt: string; icon: typeof Film }) {
	return (
		<div 
			className="relative flex-shrink-0 w-[140px] h-[200px] overflow-hidden border border-border/40 shadow-xl bg-muted"
			style={{ borderRadius: 'var(--radius, 0.5rem)' }}
		>
			{src ? (
				<img
					src={src}
					alt={alt}
					className="w-full h-full object-cover"
					loading="lazy"
				/>
			) : (
				<div className="w-full h-full bg-muted/30 flex items-center justify-center">
					<Icon className="w-10 h-10 text-muted-foreground/20" />
				</div>
			)}
		</div>
	)
}

function Tag({ children }: { children: string }) {
	return (
		<span 
			className="px-3 py-1 bg-primary text-[11px] font-bold text-primary-foreground whitespace-nowrap shadow-sm border border-primary/20"
			style={{ borderRadius: 'calc(var(--radius, 0.5rem) * 0.8)' }}
		>
			{children}
		</span>
	)
}

function formatDate(date: string): string {
	try {
		return new Date(date).toLocaleDateString('es-ES', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		})
	} catch {
		return date
	}
}

// =============================================================================
// LAYOUTS
// =============================================================================

function ScrollableOverview({ text }: { text: string }) {
	return (
		<div className="flex-1 mt-3 pr-2 overflow-y-auto max-h-[135px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/50 transition-colors">
			<p className="text-[13px] text-muted-foreground/90 leading-relaxed">
				{text}
			</p>
		</div>
	)
}

function MediaContainer({ data, children }: ContentProps & { children: React.ReactNode }) {
	return (
		<div className="flex gap-8 p-6 bg-card text-card-foreground transition-all duration-200 h-[300px]">
			<Poster src={data.image} alt={data.title} icon={data.type === 'person' ? User : data.type === 'tv' ? Tv : Film} />
			
			<div className="flex-1 min-w-0 flex flex-col pt-1 h-full">
				{/* Header: Title + Rating */}
				<div className="flex items-start justify-between gap-4 mb-2">
					<h3 className="text-xl font-black leading-tight tracking-tight drop-shadow-sm line-clamp-2">
						{data.title}
					</h3>
					{data.rating != null && data.rating > 0 && (
						<div className="flex-shrink-0">
							<Rating value={data.rating} />
						</div>
					)}
				</div>

				{children}
			</div>
		</div>
	)
}

function MovieContent({ data, url }: ContentProps) {
	return (
		<MediaContainer data={data} url={url}>
			<div className="flex flex-col h-full">
				<div className="space-y-3 flex-shrink-0">
					{/* Meta Info */}
					<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground font-medium">
						{data.subtitle && (
							<div className="flex items-center gap-1.5 opacity-90">
								<Calendar className="w-3.5 h-3.5" />
								<span>{data.subtitle}</span>
							</div>
						)}
						{data.runtime && (
							<div className="flex items-center gap-1.5 opacity-90">
								<Clock className="w-3.5 h-3.5" />
								<span>{data.runtime} min</span>
							</div>
						)}
						{data.director && (
							<span className="opacity-80">Dir: {data.director}</span>
						)}
					</div>

					{/* Genres */}
					{data.genres && data.genres.length > 0 && (
						<div className="flex flex-wrap gap-2.5">
							{data.genres.slice(0, 5).map(g => <Tag key={g}>{g}</Tag>)}
						</div>
					)}
				</div>

				{/* Synopsis with Scroll */}
				{data.overview && <ScrollableOverview text={data.overview} />}
			</div>
		</MediaContainer>
	)
}

function TvContent({ data, url }: ContentProps) {
	return (
		<MediaContainer data={data} url={url}>
			<div className="flex flex-col h-full">
				<div className="space-y-3 flex-shrink-0">
					{/* Meta Info */}
					<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground font-medium">
						{data.subtitle && (
							<div className="flex items-center gap-1.5 opacity-90">
								<Calendar className="w-3.5 h-3.5" />
								<span>{data.subtitle}</span>
							</div>
						)}
						{data.genres && data.genres.length > 0 && (
							<span className="opacity-80">{data.genres[0]}</span>
						)}
					</div>

					{/* Genres */}
					{data.genres && data.genres.length > 1 && (
						<div className="flex flex-wrap gap-2.5">
							{data.genres.slice(1, 6).map(g => <Tag key={g}>{g}</Tag>)}
						</div>
					)}
				</div>

				{/* Synopsis with Scroll */}
				{data.overview && <ScrollableOverview text={data.overview} />}
			</div>
		</MediaContainer>
	)
}

function PersonContent({ data, url }: ContentProps) {
	return (
		<MediaContainer data={data} url={url}>
			<div className="flex flex-col h-full">
				<div className="space-y-3 flex-shrink-0">
					{/* Role */}
					{data.subtitle && (
						<p className="text-base font-extrabold text-primary tracking-wide drop-shadow-sm">{data.subtitle}</p>
					)}

					{/* Birthday */}
					{data.birthday && (
						<div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium opacity-90">
							<Calendar className="w-3.5 h-3.5" />
							<span>{formatDate(data.birthday)}</span>
						</div>
					)}
				</div>

				{/* Bio with Scroll */}
				{data.overview && (
					<div className="flex-1 mt-3 pr-2 overflow-y-auto max-h-[145px] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/50 transition-colors border-l-4 border-primary/20 pl-4">
						<p className="text-[13px] text-muted-foreground/90 leading-relaxed">
							{data.overview}
						</p>
					</div>
				)}
			</div>
		</MediaContainer>
	)
}

// =============================================================================
// EXPORTS
// =============================================================================

export function MediaHoverCardContent({ data, url }: ContentProps) {
	switch (data.type) {
		case 'movie':
			return <MovieContent data={data} url={url} />
		case 'tv':
			return <TvContent data={data} url={url} />
		case 'person':
			return <PersonContent data={data} url={url} />
		default:
			return null
	}
}

export function MediaHoverCardSkeleton() {
	return (
		<div className="p-6 flex gap-8 bg-card animate-pulse h-[300px]">
			<div className="w-[140px] h-full rounded-md bg-muted/50 flex-shrink-0" />
			<div className="flex-1 flex flex-col gap-4 pt-1">
				<div className="flex items-start justify-between">
					<div className="h-7 w-3/4 bg-muted/50 rounded" />
					<div className="h-7 w-20 bg-muted/50 rounded" />
				</div>
				<div className="flex gap-2">
					<div className="h-6 w-24 bg-muted/50 rounded" />
					<div className="h-6 w-20 bg-muted/50 rounded" />
				</div>
				<div className="flex-1 space-y-3 mt-2">
					{[...Array(5)].map((_, i) => (
						<div key={i} className={cn("h-3.5 bg-muted/50 rounded", i === 4 ? "w-2/3" : "w-full")} />
					))}
				</div>
			</div>
		</div>
	)
}
