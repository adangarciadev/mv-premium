/**
 * Reusable DataTable Component
 * Based on TanStack Table with sorting, filtering, pagination, and row selection
 */
import * as React from 'react'
import {
	ColumnDef,
	ColumnFiltersState,
	OnChangeFn,
	RowSelectionState,
	SortingState,
	VisibilityState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table'
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronsLeft from 'lucide-react/dist/esm/icons/chevrons-left'
import ChevronsRight from 'lucide-react/dist/esm/icons/chevrons-right'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';
import X from 'lucide-react/dist/esm/icons/x'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[]
	data: TData[]
	onDeleteSelected?: (rows: TData[]) => void
	filterColumn?: string
	filterValue?: string
	// Controlled selection props
	rowSelection?: RowSelectionState
	onRowSelectionChange?: OnChangeFn<RowSelectionState>
	hideSelectionBar?: boolean
}

export function DataTable<TData, TValue>({
	columns,
	data,
	onDeleteSelected,
	filterColumn,
	filterValue,
	rowSelection,
	onRowSelectionChange,
	hideSelectionBar,
	itemLabel = 'post',
}: DataTableProps<TData, TValue> & { itemLabel?: string }) {
	const [sorting, setSorting] = React.useState<SortingState>([
		{ id: 'timestamp', desc: true }, // Default sort by date descending
	])
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
	const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
	const [internalRowSelection, setInternalRowSelection] = React.useState({})

	const selection = rowSelection ?? internalRowSelection
	const setSelection = onRowSelectionChange ?? setInternalRowSelection

	// Apply external filter
	React.useEffect(() => {
		if (filterColumn && filterValue !== undefined) {
			if (filterValue === 'all') {
				setColumnFilters([])
			} else {
				setColumnFilters([{ id: filterColumn, value: filterValue }])
			}
		}
	}, [filterColumn, filterValue])

	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection: selection,
		},
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	})

	const selectedRows = table.getFilteredSelectedRowModel().rows
	const hasSelection = selectedRows.length > 0

	return (
		<div className="space-y-0">
			{/* Table Container */}
			<div className="overflow-x-auto rounded-md border relative">
				<Table className="min-w-[800px]">
					<TableHeader>
						{/* Header Row */}
						{table.getHeaderGroups().map(headerGroup => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map(header => (
									<TableHead key={header.id}>
										{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{!hideSelectionBar && hasSelection && onDeleteSelected && (
							<TableRow className="absolute inset-y-0 left-[48px] right-0 h-[3.25rem] bg-background border-b z-20 flex items-center px-4">
								<TableCell colSpan={columns.length} className="border-0 p-0 h-full w-full flex items-center">
									<div className="flex items-center gap-4 w-full">
										<span className="text-sm font-medium">
											{selectedRows.length} seleccionado{selectedRows.length > 1 ? 's' : ''}
										</span>
										<div className="h-4 w-px bg-primary/20" />
										<Button
											variant="destructive"
											size="sm"
											className="h-7"
											onClick={() => onDeleteSelected(selectedRows.map(row => row.original))}
										>
											<Trash2 className="h-3.5 w-3.5 mr-1" />
											Eliminar
										</Button>
										<Button variant="ghost" size="sm" className="h-7" onClick={() => table.resetRowSelection()}>
											<X className="h-3.5 w-3.5 mr-1" />
											Deseleccionar
										</Button>
									</div>
								</TableCell>
							</TableRow>
						)}
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map(row => (
								<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
									{row.getVisibleCells().map(cell => (
										<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className="h-24 text-center">
									No hay resultados.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between px-2 pt-4">
				<div className="text-sm text-muted-foreground">
					{table.getFilteredRowModel().rows.length} {itemLabel}{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''} en
					total
				</div>
				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Filas</span>
						<Select
							value={`${table.getState().pagination.pageSize}`}
							onValueChange={value => {
								table.setPageSize(Number(value))
							}}
						>
							<SelectTrigger className="h-8 w-16.25">
								<SelectValue placeholder={table.getState().pagination.pageSize} />
							</SelectTrigger>
							<SelectContent>
								{[5, 10, 20, 30, 50].map(pageSize => (
									<SelectItem key={pageSize} value={`${pageSize}`}>
										{pageSize}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							{table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
						</span>
						<div className="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => table.setPageIndex(0)}
								disabled={!table.getCanPreviousPage()}
							>
								<ChevronsLeft className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8"
								onClick={() => table.setPageIndex(table.getPageCount() - 1)}
								disabled={!table.getCanNextPage()}
							>
								<ChevronsRight className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
