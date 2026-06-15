import { useEffect, useMemo, useState, useCallback } from 'react'
import EyeOff from 'lucide-react/dist/esm/icons/eye-off'
import Eye from 'lucide-react/dist/esm/icons/eye'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import FilterX from 'lucide-react/dist/esm/icons/filter-x'
import Check from 'lucide-react/dist/esm/icons/check'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { SimpleTooltip } from '@/components/ui/simple-tooltip'
import { EmptyState } from '@/components/ui/empty-state'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import { cn } from '@/lib/utils'
import {
	clearHiddenThreads,
	getHiddenThreads,
	hideThread,
	hideThreads,
	unhideThread,
	unhideThreads,
	watchHiddenThreads,
	type HiddenThread,
} from '@/features/hidden-threads/logic/storage'

const PAGE_SIZE = 25
type SortOption = 'recent' | 'oldest' | 'title' | 'subforum'

/** Initials used as a per-subforum monogram chip when the native icon can't be resolved. */
function getSubforumMonogram(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean)
	if (words.length === 0) return '?'
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
	return (words[0][0] + words[1][0]).toUpperCase()
}

/** Resolves the native FID icon id for a stored subforumId (`/foro/<slug>`). */
function getThreadSubforumIconId(subforumId: string): number | null {
	const slug = subforumId.replace(/^\/foro\//, '').trim()
	return slug ? getSubforumIconId(slug) : null
}

export function HiddenThreadsView({ embedded = false }: { embedded?: boolean }) {
	const [threads, setThreads] = useState<HiddenThread[]>([])
	const [searchFilter, setSearchFilter] = useState('')
	const [activeSubforum, setActiveSubforum] = useState<string>('all')
	const [sortBy, setSortBy] = useState<SortOption>('recent')
	const [isLoading, setIsLoading] = useState(true)
	const [showClearDialog, setShowClearDialog] = useState(false)
	const [currentPage, setCurrentPage] = useState(1)
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
		setSelectedIds(new Set())
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

	const isAllSelected = useMemo(() => {
		if (paginatedThreads.length === 0) return false
		return paginatedThreads.every(t => selectedIds.has(t.id))
	}, [paginatedThreads, selectedIds])

	const handleToggleSelect = useCallback((id: string) => {
		setSelectedIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const handleToggleSelectAll = useCallback(() => {
		setSelectedIds(prev => {
			const next = new Set(prev)
			if (isAllSelected) {
				for (const t of paginatedThreads) next.delete(t.id)
			} else {
				for (const t of paginatedThreads) next.add(t.id)
			}
			return next
		})
	}, [isAllSelected, paginatedThreads])

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

	const handleUnhideSelected = async () => {
		const idsToUnhide = Array.from(selectedIds)
		const threadsToRestore = threads.filter(t => selectedIds.has(t.id))
		
		await unhideThreads(idsToUnhide)
		setSelectedIds(new Set())
		
		toast.success(`${idsToUnhide.length} hilos desocultados`, {
			action: {
				label: 'Deshacer',
				onClick: () => {
					void hideThreads(
						threadsToRestore.map(t => ({
							id: t.id,
							title: t.title,
							subforum: t.subforum,
							subforumId: t.subforumId,
						}))
					)
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

	const handleClearFilters = () => {
		setSearchFilter('')
		setActiveSubforum('all')
		setSortBy('recent')
	}

	const isFiltering = searchFilter !== '' || activeSubforum !== 'all' || sortBy !== 'recent'

	return (
		<div className={embedded ? 'flex flex-col gap-6' : 'flex flex-col gap-6 max-w-5xl mx-auto p-6 animate-in fade-in duration-300'}>
			<div className="space-y-2">
				<div className={cn('flex items-center', embedded ? 'justify-end' : 'justify-between')}>
					{!embedded && <h1 className="text-3xl font-bold tracking-tight">Hilos ocultos</h1>}
					<Button variant="outline" size="sm" onClick={() => setShowClearDialog(true)} disabled={threads.length === 0}>
						<Trash2 className="h-4 w-4 mr-2" />
						Desocultar todos ({threads.length})
					</Button>
				</div>
				<p className="text-sm text-muted-foreground">
					Se ocultan en subforos, Spy y perfiles ·{' '}
					<span className="font-data tabular-nums text-foreground">{threads.length}</span> ocultos ·{' '}
					<span className="font-data tabular-nums text-foreground">{filteredThreads.length}</span> visibles con
					filtros
				</p>
			</div>



			<Card className="border-border/40 shadow-sm overflow-hidden">
				<CardHeader className="border-b border-border/40 bg-muted/20 py-4">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
								<EyeOff className="h-5 w-5" />
							</span>
							<div>
								<CardTitle className="text-base">Lista de ocultos</CardTitle>
								<CardDescription className="text-xs">Restaura cualquier hilo cuando quieras.</CardDescription>
							</div>
						</div>
						<div className="text-right">
							<p className="font-data text-2xl font-semibold leading-none tabular-nums">{threads.length}</p>
							<p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">ocultos</p>
						</div>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<div className="p-4 space-y-4">
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
									<span className="text-xs text-muted-foreground whitespace-nowrap">Ordenar por</span>
									<Select value={sortBy} onValueChange={value => setSortBy(value as SortOption)}>
										<SelectTrigger className="w-[160px] bg-background/50 h-9">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="recent">Más recientes</SelectItem>
											<SelectItem value="oldest">Más antiguos</SelectItem>
											<SelectItem value="title">Título A-Z</SelectItem>
											<SelectItem value="subforum">Subforo</SelectItem>
										</SelectContent>
									</Select>
									
									{isFiltering && (
										<SimpleTooltip content="Limpiar filtros">
											<Button variant="ghost" size="icon" onClick={handleClearFilters} className="h-9 w-9 text-muted-foreground hover:text-foreground">
												<FilterX className="h-4 w-4" />
											</Button>
										</SimpleTooltip>
									)}
								</div>
							</div>

							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant={activeSubforum === 'all' ? 'default' : 'outline'}
									size="sm"
									className={cn(
										"h-7 text-xs px-3 rounded-md transition-all",
										activeSubforum === 'all' 
											? "shadow-sm" 
											: "text-muted-foreground hover:text-foreground hover:bg-muted border-dashed"
									)}
									onClick={() => setActiveSubforum('all')}
								>
									Todos ({threads.length})
								</Button>
								{subforumCounts.map(subforum => (
									<Button
										key={subforum.name}
										type="button"
										variant={activeSubforum === subforum.name ? 'default' : 'outline'}
										size="sm"
										className={cn(
											"h-7 text-xs px-3 rounded-md transition-all border",
											activeSubforum === subforum.name
												? "shadow-sm border-primary/20"
												: "border-transparent bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted hover:border-border/50"
										)}
										onClick={() => setActiveSubforum(subforum.name)}
									>
										{subforum.name}
										{activeSubforum === subforum.name && (
											<span className="ml-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary-foreground/20 text-[8px]">
												<Check className="h-2.5 w-2.5" />
											</span>
										)}
									</Button>
								))}
							</div>
						</div>
					</div>



						<Separator />

						<div className="p-4">
							{isLoading ? (
								<div className="flex flex-col items-center justify-center py-20 gap-3">
									<div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
									<p className="text-sm text-muted-foreground">Cargando hilos ocultos...</p>
								</div>
							) : filteredThreads.length === 0 ? (
								<EmptyState
									icon={isFiltering ? Search : Eye}
									title={threads.length === 0 ? 'No tienes hilos ocultos' : 'No hay resultados'}
									description={threads.length === 0 
										? 'Los hilos que ocultes aparecerán aquí para que puedas gestionarlos o restaurarlos en cualquier momento.'
										: 'No hemos encontrado ningún hilo oculto que coincida con tus filtros actuales.'
									}
									action={isFiltering ? (
										<Button variant="outline" onClick={handleClearFilters}>
											Limpiar filtros y búsqueda
										</Button>
									) : undefined}
								/>
							) : (
								<div className="space-y-1">
									<div
										className={cn(
											'flex items-center gap-3 rounded-md px-3 py-2 text-xs transition-colors',
											selectedIds.size > 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
										)}
									>
										<Checkbox checked={isAllSelected} onCheckedChange={handleToggleSelectAll} />
										{selectedIds.size > 0 ? (
											<>
												<span className="ml-1 font-semibold">
													{selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
												</span>
												<div className="flex-1" />
												<div className="flex items-center gap-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => setSelectedIds(new Set())}
														className="h-6 px-2 text-xs hover:bg-primary/20 hover:text-primary"
													>
														Cancelar
													</Button>
													<Button size="sm" onClick={handleUnhideSelected} className="h-6 px-2 text-xs shadow-sm">
														<Eye className="mr-1.5 h-3 w-3" />
														Desocultar
													</Button>
												</div>
											</>
										) : (
											<span className="ml-1">Seleccionar todo</span>
										)}
									</div>
									
									<div className="mt-2 divide-y divide-border/50 rounded-lg border border-border/60">
										{paginatedThreads.map(thread => (
											<div
												key={thread.id}
												data-selected={selectedIds.has(thread.id)}
												className="mvp-list-row group flex items-center gap-3 px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg"
											>
												<Checkbox
													checked={selectedIds.has(thread.id)}
													onCheckedChange={() => handleToggleSelect(thread.id)}
												/>

												<span
													className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted/40"
													aria-hidden
												>
													{(() => {
														const iconId = getThreadSubforumIconId(thread.subforumId)
														return iconId !== null ? (
															<NativeFidIcon iconId={iconId} className="h-6 w-6" />
														) : (
															<span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
																{getSubforumMonogram(thread.subforum)}
															</span>
														)
													})()}
												</span>

												<div className="min-w-0 flex-1">
													<p className="block truncate text-sm font-semibold" title={thread.title}>
														{thread.title}
													</p>
													<div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
														<button
															type="button"
															className="mvp-subforum-chip cursor-pointer rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none"
															onClick={e => {
																e.preventDefault()
																e.stopPropagation()
																setActiveSubforum(thread.subforum)
															}}
														>
															{thread.subforum}
														</button>
														<span className="opacity-50">•</span>
														<span>
															{new Date(thread.hiddenAt).toLocaleDateString('es-ES', {
																day: '2-digit',
																month: 'short',
																year: '2-digit',
															})}
														</span>
													</div>
												</div>

												<div className="flex shrink-0 items-center gap-0.5">
													<SimpleTooltip content="Restaurar hilo">
														<Button
															variant="ghost"
															size="icon"
															className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
															onClick={() => handleUnhideThread(thread)}
														>
															<Eye className="h-4 w-4" />
														</Button>
													</SimpleTooltip>
												</div>
											</div>
										))}
									</div>

									<div className="pt-6 flex items-center justify-between gap-4">
										<p className="text-xs font-medium text-muted-foreground">
											Mostrando <span className="font-data tabular-nums text-foreground">{visibleStart}</span>-
											<span className="font-data tabular-nums text-foreground">{visibleEnd}</span> de{' '}
											<span className="font-data tabular-nums text-foreground">{filteredThreads.length}</span>
										</p>

										{totalPages > 1 && (
											<div className="flex items-center gap-2">
												<Button
													variant="outline"
													size="sm"
													className="h-8"
													onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
													disabled={currentPage === 1}
												>
													Anterior
												</Button>
												<div className="flex items-center justify-center w-12">
													<span className="font-data text-xs font-semibold tabular-nums">
														{currentPage}<span className="text-muted-foreground">/</span>{totalPages}
													</span>
												</div>
												<Button
													variant="outline"
													size="sm"
													className="h-8"
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
						</div>

				</CardContent>
			</Card>

			<ConfirmDialog
				open={showClearDialog}
				onOpenChange={setShowClearDialog}
				title="¿Desocultar todos los hilos?"
				description={`Se restaurarán los ${threads.length} hilos que tienes ocultos y volverán a ser visibles en todo el foro.`}
				confirmText="Desocultar todos"
				cancelText="Cancelar"
				onConfirm={handleClearAll}
			/>
		</div>
	)
}
