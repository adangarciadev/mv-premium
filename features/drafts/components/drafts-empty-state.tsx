import FileText from 'lucide-react/dist/esm/icons/file-text'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Lightbulb from 'lucide-react/dist/esm/icons/lightbulb'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import Wand2 from 'lucide-react/dist/esm/icons/wand-2'
import Zap from 'lucide-react/dist/esm/icons/zap'
import Search from 'lucide-react/dist/esm/icons/search'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface DraftsEmptyStateProps {
	hasFilters: boolean
	onCreateNew: () => void
	isTemplate?: boolean
}

// ============================================================================
// Illustration Component
// ============================================================================

function EmptyStateIllustration({ isTemplate }: { isTemplate: boolean }) {
	return (
		<div className="relative mb-6">
			{/* Main icon container with gradient background */}
			<div
				className={cn(
					'relative h-28 w-28 rounded-3xl flex items-center justify-center',
					'bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/5 backdrop-blur-md',
					'ring-1 ring-primary/20'
				)}
			>
				{/* Animated ring */}
				<div className="absolute inset-0 rounded-3xl animate-pulse bg-primary/5" />

				{/* Main icon */}
				{isTemplate ? (
					<Wand2 className="h-12 w-12 text-primary drop-shadow-sm" />
				) : (
					<FileText className="h-12 w-12 text-primary drop-shadow-sm" />
				)}
			</div>

			{/* Floating decorative elements - using Theme variables */}
			<div
				className="absolute -left-8 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full animate-bounce bg-primary/40"
				style={{ animationDelay: '0.2s' }}
			/>
			<div
				className="absolute -right-6 top-1/4 h-2 w-2 rounded-full animate-bounce bg-primary/30"
				style={{ animationDelay: '0.5s' }}
			/>
		</div>
	)
}

function NoResultsIllustration() {
	return (
		<div className="relative mb-6">
			<div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center border border-border/50">
				<Search className="h-10 w-10 text-muted-foreground/50" />
			</div>
		</div>
	)
}

// ============================================================================
// Tips Component
// ============================================================================

function ContextualTips({ isTemplate }: { isTemplate: boolean }) {
	const tips = isTemplate
		? [
				{
					icon: <Zap className="h-4 w-4" />,
					text: 'Inserta plantillas rápidamente con el comando /atajo + Tab.',
				},
				{
					icon: <FolderOpen className="h-4 w-4" />,
					text: 'Organiza por carpetas para tener tus respuestas a mano.',
				},
		  ]
		: [
				{
					icon: <Lightbulb className="h-4 w-4" />,
					text: 'Tus borradores se guardan solos mientras escribes.',
				},
				{ icon: <FolderOpen className="h-4 w-4" />, text: 'Arrastra y suelta para organizar tus ideas.' },
		  ]

	return (
		<div className="space-y-4">
			<p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center opacity-70 flex items-center justify-center gap-2">
				<Lightbulb className="h-3 w-3" /> Tips Pro
			</p>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
				{tips.map((tip, index) => (
					<div
						key={index}
						className="flex gap-3 items-start p-3 rounded-xl hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
					>
						<div className="shrink-0 p-2 rounded-lg bg-primary/10 text-primary">
							{tip.icon}
						</div>
						<span className="text-sm text-muted-foreground leading-snug pt-0.5">{tip.text}</span>
					</div>
				))}
			</div>
		</div>
	)
}

// ============================================================================
// Main Component
// ============================================================================

export function DraftsEmptyState({ hasFilters, onCreateNew, isTemplate = false }: DraftsEmptyStateProps) {
	const itemName = isTemplate ? 'plantillas' : 'borradores'

	if (hasFilters) {
		// Simplified state when filters are active
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<NoResultsIllustration />
				<h3 className="text-lg font-semibold mb-2">No se encontraron {itemName}</h3>
				<p className="text-muted-foreground max-w-sm">Prueba a cambiar los filtros de búsqueda, carpeta o subforo.</p>
			</div>
		)
	}

	// Rich empty state when no items exist
	return (
		<div className="flex flex-col items-center justify-center h-full py-12 animate-in fade-in zoom-in-95 duration-500">
			<div className="relative max-w-lg w-full bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12 text-center shadow-xl ring-1 ring-inset ring-foreground/5">
				{/* Ambient Glow */}
				<div
					className={cn(
						'absolute inset-0 rounded-2xl opacity-10 blur-3xl',
						isTemplate ? 'bg-violet-500' : 'bg-primary'
					)}
					aria-hidden="true"
				/>

				<div className="relative z-10 flex flex-col items-center">
					<EmptyStateIllustration isTemplate={isTemplate} />

					<h3 className="text-2xl font-bold tracking-tight mb-3">
						{isTemplate ? 'Tu biblioteca de plantillas' : 'Tu espacio creativo'}
					</h3>

					<p className="text-muted-foreground text-lg mb-8 max-w-sm mx-auto leading-relaxed">
						{isTemplate
							? 'Crea bloques de texto reutilizables para responder más rápido y mantener la consistencia en tus mensajes.'
							: 'El lugar perfecto para guardar tus ideas, hilos en construcción y respuestas pendientes.'}
					</p>

					<Button size="lg" onClick={onCreateNew} className="h-12 px-8 text-base shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 active:scale-95 group">
						<Plus className="mr-2 h-5 w-5 transition-transform group-hover:rotate-90" />
						{isTemplate ? 'Crear primera plantilla' : 'Escribir nuevo borrador'}
					</Button>

					<div className="mt-10 w-full pt-8 border-t border-border/50">
						<ContextualTips isTemplate={isTemplate} />
					</div>
				</div>
			</div>
		</div>
	)
}
