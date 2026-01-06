/**
 * Drafts View - Gestión completa de borradores
 * Refactored to use extracted hooks and components
 */

import Plus from 'lucide-react/dist/esm/icons/plus'
import HelpCircle from 'lucide-react/dist/esm/icons/help-circle'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CreateFolderDialog } from '@/features/drafts/components/create-folder-dialog'
import { DraftsSidebar } from '@/features/drafts/components/drafts-sidebar'
import { DraftsToolbar } from '@/features/drafts/components/drafts-toolbar'
import { DraftGrid } from '@/features/drafts/components/draft-grid'
import { DraftsEmptyState } from '@/features/drafts/components/drafts-empty-state'
import { SelectionBar } from '@/features/drafts/components/selection-bar'
import { useDraftsView } from './use-drafts-view'
import { DeleteDraftDialog, MoveDraftDialog, DeleteFolderDialog } from './drafts-dialogs'

// ============================================================================
// Main Component
// ============================================================================

interface DraftsViewProps {
	filterType?: 'draft' | 'template'
}

export function DraftsView({ filterType }: DraftsViewProps) {
	const {
		// Data
		folders,
		filteredDrafts,
		typeFilteredDrafts,
		foldersWithTypeCounts,
		isLoading,

		// Filters
		searchQuery,
		setSearchQuery,
		selectedFolder,
		setSelectedFolder,
		subforumFilter,
		setSubforumFilter,
		sortOrder,
		setSortOrder,
		hasActiveFilters,
		clearFilters,

		// Selection
		selectedIds,
		setSelectedIds,
		lastClickedId,
		setLastClickedId,
		clearSelection,
		selectAll,

		// Dialogs
		dialogs,
		openDeleteDialog,
		closeDeleteDialog,
		openMoveDialog,
		closeMoveDialog,
		openDeleteFolderDialog,
		closeDeleteFolderDialog,
		openCreateFolderDialog,
		closeCreateFolderDialog,

		// Handlers
		handleCreateDraft,
		handleEditDraft,
		handleDuplicateDraft,
		handleDeleteDraft,
		handleDeleteSelected,
		handleMoveSelected,
		handleMoveDraft,
		handleConvertDraft,
		handleCreateFolder,
		handleDragDrop,
		handleDeleteFolderConfirm,
	} = useDraftsView({ filterType })

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		)
	}

	return (
		<div className="flex flex-col lg:flex-row gap-6 h-full">
			{/* Sidebar - Folders */}
			<DraftsSidebar
				folders={foldersWithTypeCounts}
				selectedFolder={selectedFolder}
				onFolderSelect={setSelectedFolder}
				onDropToAll={draftId => handleDragDrop(draftId, undefined)}
				onDropToFolder={(draftId, folderId) => handleDragDrop(draftId, folderId)}
				onCreateFolderClick={openCreateFolderDialog}
				onFolderDelete={openDeleteFolderDialog}
				totalCount={typeFilteredDrafts.length}
				isTemplate={filterType === 'template'}
			/>

			{/* Main Content */}
			<main className="flex-1 min-w-0 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-start gap-3">
						<div>
							<h1 className="text-3xl font-bold tracking-tight">
								{filterType === 'template' ? 'Plantillas' : 'Borradores'}
							</h1>
							<p className="text-muted-foreground mt-1">
								{filterType === 'template'
									? 'Plantillas reutilizables para insertar rápidamente en tus mensajes.'
									: 'Guarda y organiza tus textos para reutilizarlos cuando quieras.'}
							</p>
						</div>
						{/* Help tooltip */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0 mt-1">
									<HelpCircle className="h-4 w-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" align="start" className="max-w-xs p-3">
								{filterType === 'template' ? (
									<div className="space-y-2 text-xs">
										<p className="font-medium">¿Qué son las plantillas?</p>
										<p>Las plantillas son textos reutilizables que puedes insertar rápidamente en cualquier editor.</p>
										<ul className="list-disc ml-4 space-y-1">
											<li>
												Define un <strong>atajo</strong> (ej: /saludo) para inserción rápida
											</li>
											<li>
												Usa{' '}
												<kbd className="px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded text-[10px] font-mono">
													Ctrl+Shift+T
												</kbd>{' '}
												para buscar plantillas
											</li>
											<li>
												Escribe{' '}
												<code className="px-1.5 py-0.5 bg-muted text-muted-foreground border border-border rounded text-[10px] font-mono">
													/atajo
												</code>{' '}
												+ Tab en el editor
											</li>
										</ul>
									</div>
								) : (
									<div className="space-y-2 text-xs">
										<p className="font-medium">¿Qué son los borradores?</p>
										<p>Los borradores son trabajos en progreso que puedes guardar y editar más tarde.</p>
										<ul className="list-disc ml-4 space-y-1">
											<li>Se guardan automáticamente mientras escribes en el foro</li>
											<li>Organízalos en carpetas para encontrarlos fácilmente</li>
											<li>Puedes convertir un borrador en plantilla cuando esté listo</li>
										</ul>
									</div>
								)}
							</TooltipContent>
						</Tooltip>
					</div>
					<Button onClick={handleCreateDraft}>
						<Plus className="mr-2 h-4 w-4" />
						{filterType === 'template' ? 'Nueva Plantilla' : 'Nuevo Borrador'}
					</Button>
				</div>

				{/* Toolbar */}
				<DraftsToolbar
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					subforumFilter={subforumFilter}
					onSubforumChange={setSubforumFilter}
					sortOrder={sortOrder}
					onSortChange={setSortOrder}
					isTemplate={filterType === 'template'}
					hasActiveFilters={hasActiveFilters}
					selectedFolder={selectedFolder}
					folders={folders}
					onClearFolder={() => setSelectedFolder(null)}
					onClearAllFilters={clearFilters}
				/>

				{/* Content */}
				{filteredDrafts.length > 0 ? (
					<>
						<DraftGrid
							drafts={filteredDrafts}
							selectedIds={selectedIds}
							onSelectionChange={setSelectedIds}
							lastClickedId={lastClickedId}
							onLastClickedChange={setLastClickedId}
							onEdit={handleEditDraft}
							onDuplicate={handleDuplicateDraft}
							onDelete={draft => setTimeout(() => openDeleteDialog([draft]), 100)}
							onMove={draft => setTimeout(() => openMoveDialog(draft), 100)}
							onConvert={handleConvertDraft}
						/>

						<p className="text-sm text-muted-foreground text-center">
							Mostrando {filteredDrafts.length} de {typeFilteredDrafts.length}{' '}
							{filterType === 'template' ? 'plantillas' : 'borradores'}
						</p>

						{/* Selection Action Bar */}
						<SelectionBar
							selectedCount={selectedIds.size}
							totalCount={filteredDrafts.length}
							folders={foldersWithTypeCounts}
							onMove={handleMoveSelected}
							onDelete={handleDeleteSelected}
							onDeselect={clearSelection}
							onSelectAll={selectAll}
						/>
					</>
				) : (
					<DraftsEmptyState
						hasFilters={hasActiveFilters}
						onCreateNew={handleCreateDraft}
						isTemplate={filterType === 'template'}
					/>
				)}
			</main>

			{/* Dialogs */}
			<CreateFolderDialog
				open={dialogs.createFolder}
				onOpenChange={open => (open ? openCreateFolderDialog() : closeCreateFolderDialog())}
				onCreate={handleCreateFolder}
				folderType={filterType}
			/>

			<DeleteDraftDialog
				open={dialogs.delete.open}
				onOpenChange={open => (open ? undefined : closeDeleteDialog())}
				draftTitle={
					dialogs.delete.drafts.length === 1
						? dialogs.delete.drafts[0]?.title || 'Sin título'
						: `${dialogs.delete.drafts.length} borradores`
				}
				onConfirm={handleDeleteDraft}
			/>

			<MoveDraftDialog
				open={dialogs.move.open}
				onOpenChange={open => (open ? undefined : closeMoveDialog())}
				folders={folders}
				currentFolderId={dialogs.move.draft?.folderId}
				onMove={handleMoveDraft}
			/>

			<DeleteFolderDialog
				open={dialogs.deleteFolder.open}
				onOpenChange={open => (open ? undefined : closeDeleteFolderDialog())}
				folder={dialogs.deleteFolder.folder}
				onConfirm={handleDeleteFolderConfirm}
			/>
		</div>
	)
}
