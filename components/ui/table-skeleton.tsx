/**
 * TableSkeleton - Skeleton loading state for tables
 * 
 * Renders a placeholder table with animated skeleton rows
 * while data is being fetched.
 */
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from './table'

interface TableSkeletonProps {
	/** Number of skeleton rows to display */
	rows?: number
	/** Column configuration: array of widths (e.g., ['5%', '30%', '45%', '12%', '8%']) */
	columns?: string[]
	/** Whether to show a checkbox column */
	showCheckbox?: boolean
	/** Additional class name for the container */
	className?: string
}

const DEFAULT_COLUMNS = ['5%', '30%', '45%', '12%', '8%']
const DEFAULT_ROWS = 10

export function TableSkeleton({
	rows = DEFAULT_ROWS,
	columns = DEFAULT_COLUMNS,
	showCheckbox = true,
	className,
}: TableSkeletonProps) {
	const effectiveColumns = showCheckbox
		? ['5%', ...columns.slice(1)]
		: columns

	return (
		<div className={cn('rounded-lg border border-border overflow-hidden', className)}>
			<Table>
				<TableHeader className="bg-[#272d30] border-b border-border">
					<TableRow className="hover:bg-transparent border-none h-10">
						{effectiveColumns.map((width, i) => (
							<TableHead
								key={i}
								style={{ width }}
								className="px-2"
							>
								{i === 0 && showCheckbox ? (
									<Skeleton className="h-4 w-4 rounded" />
								) : (
									<Skeleton className="h-4 w-16" />
								)}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: rows }).map((_, rowIdx) => (
						<TableRow
							key={rowIdx}
							className="h-12 border-b border-[#30353a] bg-[#39464c]"
						>
							{effectiveColumns.map((width, colIdx) => (
								<TableCell
									key={colIdx}
									style={{ width }}
									className="px-2 py-1"
								>
									{colIdx === 0 && showCheckbox ? (
										<Skeleton className="h-4 w-4 rounded" />
									) : colIdx === 1 ? (
										// Thread title - wider skeleton
										<Skeleton className="h-4 w-3/4" />
									) : colIdx === 2 ? (
										// Preview - two-line skeleton
										<div className="space-y-1">
											<Skeleton className="h-3 w-full" />
											<Skeleton className="h-3 w-2/3" />
										</div>
									) : (
										// Other columns
										<Skeleton className="h-4 w-12 mx-auto" />
									)}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
