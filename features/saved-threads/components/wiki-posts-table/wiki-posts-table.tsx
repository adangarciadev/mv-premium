/**
 * WikiPostsTable - Refactored component using TanStack Table & Shadcn UI
 *
 * Architecture:
 * - Table: TanStack Table for data management
 * - UI: Shadcn UI components inside ShadowWrapper
 * - Style: Matches Mediavida's native aesthetics while providing premium UX
 */

import { useMemo } from 'react'
import {
	flexRender,
	getCoreRowModel,
	useReactTable,
	getPaginationRowModel,
	getSortedRowModel,
	getFilteredRowModel,
} from '@tanstack/react-table'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import { TableSkeleton } from '@/components/ui/table-skeleton'
import { Input } from '@/components/ui/input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Download from 'lucide-react/dist/esm/icons/download'
import Upload from 'lucide-react/dist/esm/icons/upload'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Filter from 'lucide-react/dist/esm/icons/filter'
import SortDesc from 'lucide-react/dist/esm/icons/sort-desc'
import Pin from 'lucide-react/dist/esm/icons/pin'
import { useWikiPostsTable } from './use-wiki-posts-table'
import { useWikiPostsColumns } from './use-wiki-posts-columns'
import { ITEMS_PER_PAGE } from './utils'
import type { FlatPinnedPost } from './types'

export function WikiPostsTable() {
	const {
		// Data
		flatPosts,
		filteredPosts,
		subforumsList,
		isLoading,
		// Filters
		searchQuery,
		setSearchQuery,
		subforumFilter,
		setSubforumFilter,
		dateFilter,
		setDateFilter,
		// Table state
		sorting,
		setSorting,
		rowSelection,
		setRowSelection,
		// Dialog state
		showDeleteDialog,
		setShowDeleteDialog,
		postToDelete,
		setPostToDelete,
		// Handlers
		handleDeleteSelected,
		handleExport,
		handleImport,
	} = useWikiPostsTable()

	const columns = useWikiPostsColumns()

	// Table instance
	const table = useReactTable({
		data: filteredPosts,
		columns,
		state: {
			sorting,
			rowSelection,
		},
		onSortingChange: setSorting,
		onRowSelectionChange: setRowSelection,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		enableRowSelection: true,
		initialState: {
			pagination: { pageSize: ITEMS_PER_PAGE },
		},
	})

	// Pagination info
	const paginationInfo = useMemo(() => {
		const pagination = table.getState().pagination
		const model = table.getFilteredRowModel()
		const totalRows = model?.rows?.length || 0

		const pageIndex = pagination?.pageIndex || 0
		const pageSize = pagination?.pageSize || ITEMS_PER_PAGE

		const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1
		const end = Math.min((pageIndex + 1) * pageSize, totalRows)

		return { start, end, total: totalRows }
	}, [table.getState().pagination, table.getFilteredRowModel().rows.length])

	const selectedCount = Object.keys(rowSelection).length

	// Get selected posts for export
	const getSelectedPosts = (): FlatPinnedPost[] => {
		return table.getSelectedRowModel().rows.map(row => row.original)
	}

	// Loading state
	if (isLoading) {
		return (
			<ShadowWrapper className="p-4">
				<TableSkeleton rows={10} columns={['3%', '3%', '30%', '44%', '12%', '8%']} showCheckbox={true} />
			</ShadowWrapper>
		)
	}

	// Empty state
	if (flatPosts.length === 0) {
		return (
			<ShadowWrapper className="p-6">
				<EmptyState
					icon={Pin}
					title="No tienes posts anclados"
					description="Los posts que ancles en los hilos aparecerán aquí para acceder rápidamente a la información más importante."
					iconColor="text-[#ff5912]"
					action={
						<Button
							variant="outline"
							onClick={handleImport}
							className="bg-secondary/50 border-border/50 hover:bg-secondary/80 hover:border-[#ff5912]/50 transition-all"
						>
							<Upload className="h-4 w-4 mr-2" />
							Importar Backup
						</Button>
					}
				/>
			</ShadowWrapper>
		)
	}

	return (
		<ShadowWrapper className="p-4">
			{/* Premium Action Bar - Sticky */}
			<div className="sticky top-[52px] z-50 flex flex-col gap-3 p-4 bg-sidebar border border-border rounded-lg shadow-xl outline outline-1 outline-black/50">
				{/* Top row: Search + Actions */}
				<div className="flex items-center gap-4">
					{/* Search */}
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Buscar tema, post o usuario..."
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							className="pl-9 bg-secondary/50 border-border/50 h-9"
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex items-center gap-2 ml-auto">
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleExport(getSelectedPosts())}
							disabled={selectedCount === 0}
							className="bg-secondary/50 border-border/50"
						>
							<Download className="h-4 w-4 mr-1.5" />
							Exportar
						</Button>
						<Button variant="outline" size="sm" onClick={handleImport} className="bg-secondary/50 border-border/50">
							<Upload className="h-4 w-4 mr-1.5" />
							Importar
						</Button>
						<Button
							variant="destructive"
							size="sm"
							disabled={selectedCount === 0}
							onClick={() => setShowDeleteDialog(true)}
							className="hover:brightness-110 transition-all active:scale-95"
						>
							<Trash2 className="h-4 w-4 mr-1.5" />
							Eliminar {selectedCount > 0 && `(${selectedCount})`}
						</Button>
					</div>
				</div>

				{/* Bottom row: Filters */}
				<div className="flex items-center gap-4 border-t border-border/30 pt-3">
					<div className="flex items-center gap-2">
						<Filter className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="text-[11px] uppercase font-bold text-muted-foreground/70 tracking-tight">Filtros:</span>
					</div>

					{/* Subforum Filter */}
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs bg-secondary/50 border-border/50 min-w-[160px] justify-between"
							>
								{subforumFilter === 'all'
									? 'Todos los subforos'
									: subforumsList.find(s => s.id === subforumFilter)?.name || 'Subforo'}
								<ChevronRight className="h-3 w-3 rotate-90 ml-2" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
							<DropdownMenuItem
								onClick={() => setSubforumFilter('all')}
								className={subforumFilter === 'all' ? 'bg-accent' : ''}
							>
								Todos los subforos
							</DropdownMenuItem>
							{subforumsList.map(s => (
								<DropdownMenuItem
									key={s.id}
									onClick={() => setSubforumFilter(s.id)}
									className={subforumFilter === s.id ? 'bg-accent' : ''}
								>
									{s.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Date Filter */}
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="h-8 text-xs bg-secondary/50 border-border/50 min-w-[130px] justify-between"
							>
								{dateFilter === 'all'
									? 'Cualquier fecha'
									: dateFilter === 'today'
									? 'Hoy'
									: dateFilter === 'week'
									? 'Esta semana'
									: 'Este mes'}
								<ChevronRight className="h-3 w-3 rotate-90 ml-2" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuItem
								onClick={() => setDateFilter('all')}
								className={dateFilter === 'all' ? 'bg-accent' : ''}
							>
								Cualquier fecha
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDateFilter('today')}
								className={dateFilter === 'today' ? 'bg-accent' : ''}
							>
								Hoy
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDateFilter('week')}
								className={dateFilter === 'week' ? 'bg-accent' : ''}
							>
								Esta semana
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => setDateFilter('month')}
								className={dateFilter === 'month' ? 'bg-accent' : ''}
							>
								Este mes
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Sort Order */}
					<div className="ml-auto flex items-center gap-2">
						<SortDesc className="h-3.5 w-3.5 text-muted-foreground" />
						<DropdownMenu modal={false}>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-8 text-xs bg-secondary/30 hover:bg-secondary/50 min-w-[120px] justify-between"
								>
									{sorting[0]?.desc ? 'Más recientes' : 'Más antiguos'}
									<ChevronRight className="h-3 w-3 rotate-90 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent>
								<DropdownMenuItem
									onClick={() => setSorting([{ id: 'timestamp', desc: true }])}
									className={sorting[0]?.desc ? 'bg-accent' : ''}
								>
									Más recientes
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => setSorting([{ id: 'timestamp', desc: false }])}
									className={!sorting[0]?.desc ? 'bg-accent' : ''}
								>
									Más antiguos
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			</div>

			{/* TanStack Table UI */}
			<div className="rounded-lg border border-table-border bg-table overflow-hidden shadow-sm mt-4">
				<Table>
					<TableHeader className="bg-table-header border-b border-table-border">
						{table.getHeaderGroups().map(headerGroup => (
							<TableRow key={headerGroup.id} className="hover:bg-transparent border-none h-10">
								{headerGroup.headers.map(header => (
									<TableHead
										key={header.id}
										className={cn(
											'px-2',
											header.id === 'select' && 'w-10 px-1 text-center',
											header.id === 'subforum' && 'w-10 px-1',
											header.id === 'threadTitle' && 'w-48 text-left',
											header.id === 'preview' && 'min-w-80 text-left',
											header.id === 'author' && 'w-32 text-center',
											header.id === 'timestamp' && 'w-20 text-center',
											header.id === 'actions' && 'w-20'
										)}
									>
										{flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map(row => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && 'selected'}
									className={cn(
										'group h-12 border-b border-table-border bg-table-row transition-colors',
										'hover:bg-table-row-hover!',
										'data-[state=selected]:bg-table-row-selected!'
									)}
								>
									{row.getVisibleCells().map(cell => (
										<TableCell
											key={cell.id}
											className={cn(
												'px-2 py-1 align-middle',
												cell.column.id === 'select' && 'px-1 text-center',
												cell.column.id === 'subforum' && 'px-1',
												cell.column.id === 'threadTitle' && 'text-left'
											)}
										>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
									<div className="flex flex-col items-center gap-2">
										<Search className="h-6 w-6 opacity-50" />
										<span>No se encontraron posts</span>
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between px-4 py-3 mt-2 bg-card rounded-lg border border-border">
				<div className="text-sm text-muted-foreground">
					Mostrando{' '}
					<span className="font-medium text-foreground">
						{paginationInfo.start}-{paginationInfo.end}
					</span>{' '}
					de <span className="font-medium text-foreground">{paginationInfo.total}</span> posts
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
						className="bg-secondary/50 border-border/50"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-sm text-muted-foreground px-2">
						Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
						className="bg-secondary/50 border-border/50"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Delete Dialog */}
			<AlertDialog
				open={showDeleteDialog}
				onOpenChange={open => {
					setShowDeleteDialog(open)
					if (!open) setPostToDelete(null)
				}}
			>
				<AlertDialogContent className="bg-card text-card-foreground border-border shadow-2xl">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{postToDelete ? '¿Eliminar post anclado?' : '¿Eliminar posts seleccionados?'}
						</AlertDialogTitle>
						<AlertDialogDescription className="opacity-70 text-muted-foreground">
							{postToDelete
								? 'Se eliminará este post de tus guardados.'
								: `Eliminarás ${selectedCount} posts de tus guardados.`}{' '}
							Esta acción no se puede deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="bg-accent hover:bg-accent/80 text-accent-foreground border-none">
							Cancelar
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDeleteSelected}
							className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ShadowWrapper>
	)
}
