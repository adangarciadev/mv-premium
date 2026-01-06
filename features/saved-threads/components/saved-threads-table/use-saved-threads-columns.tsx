/**
 * Saved Threads Table Columns
 */

import { useMemo, useRef } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { SavedThread } from '../../logic/storage'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getFidIconStyles } from '@/lib/fid-icons'
import { cn } from '@/lib/utils'
import StickyNote from 'lucide-react/dist/esm/icons/sticky-note'
import { getSubforumInfo, formatRelativeTime } from './utils'

interface UseColumnsOptions {
	onOpenNoteEditor: (thread: SavedThread) => void
}

export function useSavedThreadsColumns({ onOpenNoteEditor }: UseColumnsOptions): ColumnDef<SavedThread, unknown>[] {
	const lastSelectedIdx = useRef<number | null>(null)

	return useMemo<ColumnDef<SavedThread, unknown>[]>(
		() => [
			{
				id: 'select',
				header: ({ table }) => (
					<div className="flex items-center justify-center">
						<Checkbox
							checked={table.getIsAllPageRowsSelected()}
							onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
							aria-label="Seleccionar todos"
						/>
					</div>
				),
				cell: ({ row, table }) => (
					<div className="flex items-center justify-center">
						<Checkbox
							checked={row.getIsSelected()}
							onCheckedChange={value => row.toggleSelected(!!value)}
							onClick={e => {
								if (e.shiftKey && lastSelectedIdx.current !== null) {
									const currentIdx = row.index
									const start = Math.min(lastSelectedIdx.current, currentIdx)
									const end = Math.max(lastSelectedIdx.current, currentIdx)
									const rows = table.getRowModel().rows
									const isChecking = !row.getIsSelected()

									for (let i = start; i <= end; i++) {
										rows[i].toggleSelected(isChecking)
									}
								}
								lastSelectedIdx.current = row.index
							}}
							aria-label="Seleccionar hilo"
						/>
					</div>
				),
				size: 32,
			},
			{
				id: 'subforum',
				header: () => null,
				cell: ({ row }) => {
					const info = getSubforumInfo(row.original.subforumId)
					const iconStyles = getFidIconStyles(info.iconId)
					return (
						<div className="flex items-center">
							<a href={row.original.subforumId} className="hover:opacity-80 transition-opacity" title={info.name}>
								<span style={iconStyles} />
							</a>
						</div>
					)
				},
			},
			{
				accessorKey: 'title',
				header: () => <span className="text-sm font-normal text-muted-foreground">Tema</span>,
				cell: ({ row }) => (
					<div className="py-1 text-left">
						<a
							href={row.original.id}
							className="text-[#ff5912] text-[15px] font-medium leading-snug line-clamp-1"
							title={row.original.title}
						>
							{row.original.title}
						</a>
					</div>
				),
			},
			{
				id: 'notes',
				header: () => <span className="text-sm font-normal text-muted-foreground block text-center">Nota</span>,
				cell: ({ row }) => {
					const hasNotes = !!row.original.notes
					return (
						<div className="flex justify-center">
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon"
										className={cn(
											'h-8 w-8 transition-colors',
											hasNotes
												? 'text-[#ff5912] hover:text-[#ff5912]/80 hover:bg-[#ff5912]/10'
												: 'text-muted-foreground/30 hover:text-muted-foreground hover:bg-white/5'
										)}
										onClick={() => onOpenNoteEditor(row.original)}
									>
										<StickyNote className={cn('h-4 w-4', hasNotes && 'fill-current/20')} />
									</Button>
								</TooltipTrigger>
								{hasNotes ? (
									<TooltipContent className="max-w-[250px] bg-popover border-border">
										<p className="text-sm text-popover-foreground">{row.original.notes}</p>
									</TooltipContent>
								) : (
									<TooltipContent>
										<p>Añadir nota</p>
									</TooltipContent>
								)}
							</Tooltip>
						</div>
					)
				},
				size: 60,
			},
			{
				accessorKey: 'savedAt',
				header: () => <span className="text-sm font-normal text-muted-foreground block text-center">Guardado</span>,
				cell: ({ getValue }) => (
					<div className="text-center">
						<span
							className="text-xs text-muted-foreground whitespace-nowrap"
							title={new Date(getValue() as number).toLocaleString()}
						>
							{formatRelativeTime(getValue() as number)}
						</span>
					</div>
				),
				size: 100,
			},
		],
		[onOpenNoteEditor]
	)
}
