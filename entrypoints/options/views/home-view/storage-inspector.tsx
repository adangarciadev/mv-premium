/**
 * Storage Inspector - Dialog for inspecting local storage
 */
import { useState } from 'react'
import Database from 'lucide-react/dist/esm/icons/database'
import Package from 'lucide-react/dist/esm/icons/package'
import Eye from 'lucide-react/dist/esm/icons/eye'
import { browser } from 'wxt/browser'
import { formatBytes } from '@/lib/format-utils'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { type StorageItem, analyzeStorageValue, CATEGORY_LABELS, CATEGORY_ICONS } from './constants'

interface StorageInspectorProps {
	triggerButton: React.ReactNode
}

export function StorageInspector({ triggerButton }: StorageInspectorProps) {
	const [items, setItems] = useState<StorageItem[] | null>(null)
	const [loading, setLoading] = useState(false)

	async function loadDetails() {
		// Only show loading if we don't have cached data
		if (!items) {
			setLoading(true)
		}
		try {
			const rawItems = await browser.storage.local.get(null)
			const analyzed = Object.entries(rawItems).map(([key, value]) => analyzeStorageValue(key, value))
			setItems(analyzed)
		} finally {
			setLoading(false)
		}
	}

	// Calculate summary stats
	const totalSize = items?.reduce((sum, item) => sum + item.compressedSize, 0) ?? 0
	const compressedCount = items?.filter(item => item.isCompressed).length ?? 0
	const estimatedSavings =
		items?.reduce((sum, item) => {
			if (!item.isCompressed || item.originalSize === null || !Number.isFinite(item.originalSize)) {
				return sum
			}

			const savings = item.originalSize - item.compressedSize
			if (savings > 0) return sum + savings

			return sum
		}, 0) ?? 0

	// Group items by category
	const groupedItems = items?.reduce(
		(acc, item) => {
			if (!acc[item.category]) acc[item.category] = []
			acc[item.category].push(item)
			return acc
		},
		{} as Record<string, StorageItem[]>
	)

	return (
		<Dialog onOpenChange={open => open && loadDetails()}>
			<DialogTrigger asChild>{triggerButton}</DialogTrigger>
			<DialogContent className="max-w-2xl max-h-[85vh]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Database className="h-5 w-5" />
						Inspector de Almacenamiento
					</DialogTitle>
					<DialogDescription>Gestiona los datos guardados localmente por la extensión.</DialogDescription>
				</DialogHeader>

				{loading && !items ? (
					<div className="flex items-center justify-center h-40">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
					</div>
				) : (
					items && (
						<>
							{/* Stats Dashboard */}
							<div className="bg-muted/30 border border-border/50 rounded-xl p-4 mb-6 flex divide-x divide-border/50">
								<div className="flex-1 text-center px-4">
									<div className="text-2xl font-bold tracking-tight text-foreground">{formatBytes(totalSize)}</div>
									<div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
										Total Usado
									</div>
								</div>
								<div className="flex-1 text-center px-4">
									<div className="text-2xl font-bold tracking-tight text-primary">{compressedCount}</div>
									<div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
										Items Comprimidos
									</div>
								</div>
								<div className="flex-1 text-center px-4">
									<div className="text-2xl font-bold tracking-tight text-emerald-500">
										~{formatBytes(estimatedSavings)}
									</div>
									<div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1">
										Ahorro Estimado
									</div>
								</div>
							</div>

							{/* Items List - Ultra Premium Layout */}
							<ScrollArea className="h-[48vh] pr-4 -mr-3">
								<div className="space-y-4 pr-3 pb-2">
									{groupedItems &&
										Object.entries(groupedItems)
											.sort(([, a], [, b]) => {
												const sizeA = a.reduce((s, i) => s + i.compressedSize, 0)
												const sizeB = b.reduce((s, i) => s + i.compressedSize, 0)
												return sizeB - sizeA
											})
											.map(([category, categoryItems]) => {
												const Icon = CATEGORY_ICONS[category] || Package
												const categorySize = categoryItems.reduce((acc, i) => acc + i.compressedSize, 0)

												return (
													<div
														key={category}
														className="group/card rounded-xl border border-border/40 overflow-hidden bg-gradient-to-br from-card to-card/50 shadow-sm transition-all hover:border-border/60 hover:shadow-md"
													>
														{/* Category Header */}
														<div className="px-3 py-2.5 flex items-center justify-between bg-muted/20">
															<div className="flex items-center gap-2.5">
																<div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-inset ring-primary/5">
																	<Icon className="h-3.5 w-3.5" />
																</div>
																<span className="text-xs font-bold tracking-wide text-foreground uppercase opacity-80">
																	{CATEGORY_LABELS[category] || category}
																</span>
															</div>
															<span className="text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border border-border/30">
																{formatBytes(categorySize)}
															</span>
														</div>

														{/* Items List */}
														<div className="divide-y divide-border/20">
															{categoryItems
																.sort((a, b) => b.compressedSize - a.compressedSize)
																.map(item => (
																	<div
																		key={item.key}
																		className="px-3 py-2.5 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 group/item"
																	>
																		<div className="flex flex-col min-w-0 overflow-hidden">
																			<div className="flex items-center gap-2">
																				<span className="font-mono text-[11px] text-muted-foreground group-hover/item:text-foreground transition-colors truncate">
																					{item.key}
																				</span>
																				{item.isCompressed && (
																					<Badge
																						variant="secondary"
																						className="text-[9px] px-1 py-0 h-3.5 gap-0.5 shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium rounded-[4px]"
																					>
																						ZIP
																					</Badge>
																				)}
																			</div>
																		</div>

																		<div className="text-right shrink-0">
																			<span className="font-mono text-xs font-semibold text-foreground/90 block">
																				{formatBytes(item.compressedSize)}
																			</span>
																			{item.isCompressed &&
																				typeof item.originalSize === 'number' &&
																				Number.isFinite(item.originalSize) &&
																				item.originalSize > item.compressedSize && (
																				<span className="text-[9px] text-emerald-500/80 block -mt-0.5">
																					-{Math.round((1 - item.compressedSize / item.originalSize) * 100)}%
																				</span>
																			)}
																		</div>
																	</div>
																))}
														</div>
													</div>
												)
											})}
								</div>
							</ScrollArea>
						</>
					)
				)}
			</DialogContent>
		</Dialog>
	)
}

// Re-export the trigger button component for convenience
export function StorageInspectorButton() {
	return (
		<StorageInspector
			triggerButton={
				<button className="flex items-center justify-center gap-2 w-full p-2 mt-2 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-dashed border-primary/30">
					<Eye className="w-3 h-3" />
					Inspeccionar contenido
				</button>
			}
		/>
	)
}
