import { useEffect, useMemo, useState } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Search from 'lucide-react/dist/esm/icons/search'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { toast } from 'sonner'
import { getThreadUrl } from '@/constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
	clearHiddenThreads,
	getHiddenThreads,
	hideThread,
	unhideThread,
	watchHiddenThreads,
	type HiddenThread,
} from '@/features/hidden-threads/logic/storage'

const PAGE_SIZE = 25
type SortOption = 'recent' | 'oldest' | 'title' | 'subforum'

export function HiddenThreadsView() {
	const [threads, setThreads] = useState<HiddenThread[]>([])
	const [searchFilter, setSearchFilter] = useState('')
	const [activeSubforum, setActiveSubforum] = useState<string>('all')
	const [sortBy, setSortBy] = useState<SortOption>('recent')
	const [isLoading, setIsLoading] = useState(true)
	const [showClearDialog, setShowClearDialog] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)

	useEffect(() => {
		let mounted = true

		const load = async () => {
			const data = await getHiddenThreads()
			if (!mounted) return
			setThreads(data)
			setIsLoading(false)
		}

		void load()

		const unwatch = watchHiddenThreads(nextThreads => {
			setThreads(nextThreads)
			setIsLoading(false)
		})

		return () => {
			mounted = false
			unwatch()
		}
	}, [])

	const subforumCounts = useMemo(() => {
		const counts = new Map<string, number>()
		for (const thread of threads) {
			counts.set(thread.subforum, (counts.get(thread.subforum) ?? 0) + 1)
		}
		return Array.from(counts.entries())
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
	}, [threads])

	const filteredThreads = useMemo(() => {
		const query = searchFilter.trim().toLowerCase()
		const filteredBySubforum =
			activeSubforum === 'all' ? threads : threads.filter(thread => thread.subforum === activeSubforum)

		const filteredBySearch = query
			? filteredBySubforum.filter(thread => `${thread.title} ${thread.subforum}`.toLowerCase().includes(query))
			: filteredBySubforum

		const sorted = [...filteredBySearch]
		switch (sortBy) {
			case 'oldest':
				sorted.sort((a, b) => a.hiddenAt - b.hiddenAt)
				break
			case 'title':
				sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'))
				break
			case 'subforum':
				sorted.sort((a, b) => a.subforum.localeCompare(b.subforum, 'es') || b.hiddenAt - a.hiddenAt)
				break
			case 'recent':
			default:
				sorted.sort((a, b) => b.hiddenAt - a.hiddenAt)
				break
		}

		return sorted
	}, [threads, searchFilter, activeSubforum, sortBy])

	const totalPages = Math.max(1, Math.ceil(filteredThreads.length / PAGE_SIZE))

	const paginatedThreads = useMemo(() => {
		const startIndex = (currentPage - 1) * PAGE_SIZE
		return filteredThreads.slice(startIndex, startIndex + PAGE_SIZE)
	}, [filteredThreads, currentPage])

	useEffect(() => {
		setCurrentPage(1)
	}, [searchFilter, activeSubforum, sortBy])

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	useEffect(() => {
		if (activeSubforum === 'all') return
		if (threads.some(thread => thread.subforum === activeSubforum)) return
		setActiveSubforum('all')
	}, [threads, activeSubforum])

	const visibleStart = filteredThreads.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
	const visibleEnd = Math.min(currentPage * PAGE_SIZE, filteredThreads.length)

	const handleUnhideThread = async (thread: HiddenThread) => {
		await unhideThread(thread.id)
		toast.success('Hilo desocultado', {
			description: thread.title,
			action: {
				label: 'Deshacer',
				onClick: () => {
					void hideThread({
						id: thread.id,
						title: thread.title,
						subforum: thread.subforum,
						subforumId: thread.subforumId,
					})
				},
			},
		})
	}

	const handleClearAll = async () => {
		if (threads.length === 0) return

		await clearHiddenThreads()
		setShowClearDialog(false)
		toast.success('Todos los hilos han sido desocultados')
	}

	return (
		<div className="flex flex-col gap-6 max-w-5xl mx-auto p-6 animate-in fade-in duration-300">
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Hilos Ocultos</h1>
				<p className="text-sm text-muted-foreground">
					Estos hilos se ocultan automáticamente en subforos, Spy y en perfiles (últimos posts, /temas y /posts).
				</p>
				<p className="text-sm text-muted-foreground">
					{threads.length} ocultos en total · {filteredThreads.length} visibles con filtros
				</p>
			</div>

			<Card>
				<CardHeader className="pb-4">
					<div className="flex items-center justify-between gap-4">
						<div>
							<CardTitle className="flex items-center gap-2">
								<EyeOff className="h-5 w-5" />
								Lista de ocultos
							</CardTitle>
							<CardDescription>Desoculta hilos individualmente o restaura toda la lista.</CardDescription>
						</div>
						<Button variant="outline" onClick={() => setShowClearDialog(true)} disabled={threads.length === 0}>
							<Trash2 className="h-4 w-4 mr-2" />
							Desocultar todos ({threads.length})
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="relative w-full sm:max-w-md">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
								<Input
									placeholder="Buscar por título o subforo..."
									value={searchFilter}
									onChange={e => setSearchFilter(e.target.value)}
									className="pl-9"
								/>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground whitespace-nowrap">Ordenar</span>
								<Select value={sortBy} onValueChange={value => setSortBy(value as SortOption)}>
									<SelectTrigger className="w-[170px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="recent">Más recientes</SelectItem>
										<SelectItem value="oldest">Más antiguos</SelectItem>
										<SelectItem value="title">Título A-Z</SelectItem>
										<SelectItem value="subforum">Subforo</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant={activeSubforum === 'all' ? 'secondary' : 'outline'}
								size="sm"
								className="h-7 text-xs"
								onClick={() => setActiveSubforum('all')}
							>
								Todos ({threads.length})
							</Button>
							{subforumCounts.map(subforum => (
								<Button
									key={subforum.name}
									type="button"
									variant={activeSubforum === subforum.name ? 'secondary' : 'outline'}
									size="sm"
									className="h-7 text-xs"
									onClick={() => setActiveSubforum(subforum.name)}
								>
									{subforum.name} ({subforum.count})
								</Button>
							))}
						</div>
					</div>

					<Separator />

					{isLoading ? (
						<div className="text-sm text-muted-foreground py-8 text-center">Cargando hilos ocultos...</div>
					) : filteredThreads.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
							<Eye className="h-10 w-10 opacity-30 mb-3" />
							<p>{threads.length === 0 ? 'No tienes hilos ocultos.' : 'No hay resultados para tus filtros.'}</p>
							{threads.length > 0 && (
								<Button
									variant="ghost"
									size="sm"
									className="mt-2"
									onClick={() => {
										setSearchFilter('')
										setActiveSubforum('all')
										setSortBy('recent')
									}}
								>
									Limpiar filtros
								</Button>
							)}
						</div>
					) : (
						<div className="space-y-3">
							{paginatedThreads.map(thread => (
								<div
									key={thread.id}
									className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card/50 p-3 transition-colors hover:bg-accent/30"
								>
									<div className="min-w-0">
										<div className="flex items-center gap-2 min-w-0">
											<a
												href={getThreadUrl(thread.id)}
												target="_blank"
												rel="noreferrer"
												className="font-medium hover:text-primary transition-colors truncate"
												title={thread.title}
											>
												{thread.title}
											</a>
											<ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
										</div>
										<div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
											<Badge
												variant="outline"
												className="rounded-[var(--radius)] border-border bg-accent/40 text-[10px] text-accent-foreground"
											>
												{thread.subforum}
											</Badge>
											<span>
												Ocultado el{' '}
												{new Date(thread.hiddenAt).toLocaleString('es-ES', {
													dateStyle: 'short',
													timeStyle: 'short',
												})}
											</span>
										</div>
									</div>

									<Button variant="outline" size="sm" onClick={() => handleUnhideThread(thread)}>
										<Eye className="h-4 w-4 mr-2" />
										Desocultar
									</Button>
								</div>
							))}

							<div className="pt-1 flex items-center justify-between gap-4">
								<p className="text-xs text-muted-foreground">
									Mostrando {visibleStart}-{visibleEnd} de {filteredThreads.length}
								</p>

								{totalPages > 1 && (
									<div className="flex items-center gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
											disabled={currentPage === 1}
										>
											Anterior
										</Button>
										<span className="text-xs text-muted-foreground tabular-nums min-w-12 text-center">
											{currentPage}/{totalPages}
										</span>
										<Button
											variant="outline"
											size="sm"
											onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
											disabled={currentPage === totalPages}
										>
											Siguiente
										</Button>
									</div>
								)}
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<ConfirmDialog
				open={showClearDialog}
				onOpenChange={setShowClearDialog}
				title="¿Desocultar todos los hilos?"
				description={`Se restaurarán ${threads.length} hilos ocultos y volverán a mostrarse en subforos y en Spy.`}
				confirmText="Desocultar todos"
				cancelText="Cancelar"
				onConfirm={handleClearAll}
			/>
		</div>
	)
}
