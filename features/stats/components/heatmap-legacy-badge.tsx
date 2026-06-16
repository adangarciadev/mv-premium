import Info from 'lucide-react/dist/esm/icons/info'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function HeatmapLegacyBadge({ className }: { className?: string }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						'inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5',
						'text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500 transition-colors',
						'hover:border-amber-500/60 hover:bg-amber-500/15 hover:text-amber-400',
						'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60',
						className
					)}
					aria-label="Qué significa heatmap legacy"
					title="Qué significa heatmap legacy"
				>
					Legacy
					<Info className="h-3 w-3" aria-hidden="true" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={8} className="w-80 p-3 text-xs leading-relaxed">
				<div className="space-y-2.5">
					<p className="text-sm font-black text-foreground">Heatmap legacy de posts</p>
					<p className="text-muted-foreground">
						Este calendario registra acciones concretas de posts e hilos. Puede guardar títulos, URLs,
						subforo/contexto y hora aproximada para pintar las contribuciones.
					</p>
					<p className="text-muted-foreground">
						A partir de ahora queda pausado por defecto porque depende de señales del editor y puede no ser
						tan fiable como las estadísticas de tiempo.
					</p>
					<p className="text-muted-foreground">
						Si ya tienes historial, podrás seguir viéndolo. Si lo activas en Ajustes, se volverán a guardar
						nuevos eventos del heatmap. El reloj de ritmo y el tiempo por subforo no dependen de este registro.
					</p>
				</div>
			</PopoverContent>
		</Popover>
	)
}
