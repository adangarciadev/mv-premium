import { useEffect, useMemo, useState } from 'react'
import Eye from 'lucide-react/dist/esm/icons/eye'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import {
	clearHiddenSubforums,
	getHiddenSubforums,
	hideSubforum,
	unhideSubforum,
	watchHiddenSubforums,
	type HiddenSubforum,
} from '@/features/hidden-subforums/logic/storage'

export function HiddenSubforumsView() {
	const [subforums, setSubforums] = useState<HiddenSubforum[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [query, setQuery] = useState('')
	const [showClearDialog, setShowClearDialog] = useState(false)

	useEffect(() => {
		let mounted = true

		const load = async () => {
			const data = await getHiddenSubforums()
			if (!mounted) return
			setSubforums(data)
			setIsLoading(false)
		}

		void load()

		const unwatch = watchHiddenSubforums(nextSubforums => {
			setSubforums(nextSubforums)
			setIsLoading(false)
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	const filteredSubforums = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase()
		const sorted = [...subforums].sort((a, b) => b.hiddenAt - a.hiddenAt)

		if (!normalizedQuery) return sorted

		return sorted.filter(subforum =>
			`${subforum.name} ${subforum.id} ${subforum.description || ''}`.toLowerCase().includes(normalizedQuery)
		)
	}, [subforums, query])

	const handleUnhide = async (subforum: HiddenSubforum) => {
		await unhideSubforum(subforum.id)
		toast.success('Subforo desocultado', {
			description: subforum.name,
			action: {
				label: 'Deshacer',
				onClick: () => {
					void hideSubforum({
						id: subforum.id,
						name: subforum.name,
						url: subforum.url,
						iconClass: subforum.iconClass,
						description: subforum.description,
					})
				},
			},
		})
	}

	const handleClearAll = async () => {
		const previousSubforums = [...subforums]
		await clearHiddenSubforums()
		setShowClearDialog(false)

		toast.success('Todos los subforos han sido desocultados', {
			action: {
				label: 'Deshacer',
				onClick: () => {
					previousSubforums.forEach(subforum => {
						void hideSubforum({
							id: subforum.id,
							name: subforum.name,
							url: subforum.url,
							iconClass: subforum.iconClass,
							description: subforum.description,
						})
					})
				},
			},
		})
	}

	return (
		<div className="mx-auto flex max-w-5xl flex-col gap-6 p-6 animate-in fade-in duration-300">
			<div className="space-y-2">
				<div className="flex items-center justify-between gap-4">
					<h1 className="text-3xl font-bold tracking-tight">Subforos ocultos</h1>
					<Button variant="outline" size="sm" onClick={() => setShowClearDialog(true)} disabled={subforums.length === 0}>
						<Trash2 className="mr-2 h-4 w-4" />
						Desocultar todos ({subforums.length})
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					Si ocultas un subforo, desaparece del índice y sus enlaces quedan bloqueados hasta que lo restaures.
				</p>
			</div>

			<Card className="overflow-hidden border-border/40 shadow-sm">
				<CardHeader className="border-b border-border/40 bg-muted/30 pb-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<CardTitle className="flex items-center gap-2 text-lg">
								<EyeOff className="h-5 w-5 text-primary" />
								Lista de subforos ocultos
							</CardTitle>
							<CardDescription>Gestiona rápidamente los subforos que estás bloqueando para no caer en la tentación.</CardDescription>
						</div>
						<Badge variant="outline">{filteredSubforums.length}</Badge>
					</div>
				</CardHeader>

				<CardContent className="space-y-4 p-4">
					<div className="relative w-full sm:max-w-md">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Buscar subforo oculto..."
							value={query}
							onChange={event => setQuery(event.target.value)}
							className="pl-9"
						/>
					</div>

					{isLoading ? (
						<div className="flex flex-col items-center justify-center gap-3 py-20">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
							<p className="text-sm text-muted-foreground">Cargando subforos ocultos...</p>
						</div>
					) : filteredSubforums.length === 0 ? (
						<EmptyState
							icon={query ? Search : Eye}
							title={subforums.length === 0 ? 'No tienes subforos ocultos' : 'No hay resultados'}
							description={
								subforums.length === 0
									? 'Los subforos que ocultes aparecerán aquí para poder restaurarlos en cualquier momento.'
									: 'No hemos encontrado ningún subforo oculto que coincida con tu búsqueda.'
							}
						/>
					) : (
						<div className="space-y-2">
							{filteredSubforums.map(subforum => (
								<div
									key={subforum.id}
									className="group flex items-center gap-4 rounded-lg border border-border/60 bg-card/50 p-3 transition-all duration-200 hover:border-border hover:bg-accent/40"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold" title={subforum.name}>
											{subforum.name}
										</p>

										<div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
											<span>
												Ocultado el{' '}
												{new Date(subforum.hiddenAt).toLocaleString('es-ES', {
													dateStyle: 'short',
													timeStyle: 'short',
												})}
											</span>
										</div>

										{subforum.description && (
											<p className="mt-1.5 truncate text-xs text-muted-foreground">{subforum.description}</p>
										)}
									</div>

									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
										onClick={() => handleUnhide(subforum)}
										title="Desocultar subforo"
									>
										<Eye className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			<ConfirmDialog
				open={showClearDialog}
				onOpenChange={setShowClearDialog}
				title="¿Desocultar todos los subforos?"
				description={`Se restaurarán los ${subforums.length} subforos que tienes ocultos y volverán a estar accesibles.`}
				confirmText="Desocultar todos"
				cancelText="Cancelar"
				onConfirm={handleClearAll}
			/>
		</div>
	)
}
