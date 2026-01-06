/**
 * Wiki Posts Table Columns
 */

import { useMemo, useRef } from 'react'
import type { ColumnDef, Table } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { getFidIconStyles } from '@/lib/fid-icons'
import { getUserProfileUrl } from '@/constants'
import { getSubforumInfo, formatRelativeTime, getPostUrl } from './utils'
import type { FlatPinnedPost } from './types'

export function useWikiPostsColumns(): ColumnDef<FlatPinnedPost, unknown>[] {
	const lastSelectedIdx = useRef<number | null>(null)

	return useMemo<ColumnDef<FlatPinnedPost, unknown>[]>(
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
							aria-label="Seleccionar post"
						/>
					</div>
				),
				size: 32,
			},
			{
				id: 'subforum',
				header: () => null,
				cell: ({ row }) => {
					const info = getSubforumInfo(row.original.subforum)
					const iconStyles = getFidIconStyles(info.iconId)
					return (
						<div className="flex items-center">
							<a href={`/foro/${info.slug}`} className="hover:opacity-80 transition-opacity" title={info.name}>
								<span style={iconStyles} />
							</a>
						</div>
					)
				},
			},
			{
				accessorKey: 'threadTitle',
				header: () => <span className="text-sm font-normal text-muted-foreground">Tema</span>,
				cell: ({ row }) => (
					<div className="py-1 text-left">
						<a
							href={getPostUrl(row.original.threadId, row.original.pageNum, row.original.num)}
							className="text-[#ff5912] text-[15px] font-medium leading-snug line-clamp-1"
							title={row.original.threadTitle}
						>
							{row.original.threadTitle}
						</a>
					</div>
				),
			},
			{
				accessorKey: 'preview',
				header: () => <span className="text-sm font-normal text-muted-foreground">Post</span>,
				cell: ({ row }) => (
					<div className="py-1">
						<span className="text-sm text-muted-foreground line-clamp-2 leading-snug">{row.original.preview}</span>
					</div>
				),
			},
			{
				accessorKey: 'author',
				header: () => <span className="text-sm font-normal text-muted-foreground block text-center">Autor</span>,
				cell: ({ row }) => (
					<div className="text-center">
						<a
							href={getUserProfileUrl(row.original.author)}
							className="text-sm text-[#b3c3d3] font-medium hover:opacity-80 transition-opacity"
						>
							{row.original.author}
						</a>
					</div>
				),
			},
			{
				accessorKey: 'timestamp',
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
				sortingFn: 'basic',
			},
		],
		[]
	)
}
