/**
 * EditorDialogs Component
 * All dialog components used by the draft editor
 */

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
import { ApiKeyDialog } from '@/features/editor/components/toolbar'
import { UrlDialog } from '@/features/editor/components/url-dialog'
import { PollCreatorDialog } from '@/features/editor/components/poll-creator-dialog'
import { TableEditorDialog, type TableInitialData } from '@/features/table-editor/components/table-editor-dialog'
import { MovieTemplateDialog } from '@/features/cine/components/movie-template-dialog'
import { IndexCreatorDialog } from '@/features/editor/components/index-creator-dialog'
import { CreateFolderDialog } from '@/features/drafts/components/create-folder-dialog'
import { InsertTemplateDialog } from '@/features/drafts/components/insert-template-dialog'
import type { UseDialogManagerReturn } from '@/hooks/use-dialog-manager'

interface TableEditData {
	initialData: TableInitialData
	tableStart: number
	tableEnd: number
}

interface EditorDialogsProps {
	docType: 'draft' | 'template'
	dialogs: UseDialogManagerReturn
	// API Key dialog
	apiKeyValue: string
	onApiKeyChange: (value: string) => void
	onApiKeySave: () => Promise<void>
	// Table dialog
	tableEditData: TableEditData | null
	onClearTableEditData: () => void
	onInsertTable: (markdown: string) => void
	// URL dialog
	onInsertUrl: (url: string, displayText: string) => void
	// Poll dialog
	onInsertPoll: (bbcode: string) => void
	// Movie dialog
	onInsertMovieTemplate: (template: string) => void
	// Index dialog
	onInsertIndex: (bbcode: string) => void
	// Folder dialog
	onCreateFolder: (name: string, icon: string, type: 'draft' | 'template') => Promise<void>
	// Clear dialog
	onClearConfirm: () => void
	// Template dialog
	title: string
	category: string
	onInsertTemplateContent: (content: string, title?: string, category?: string) => void
}

export function EditorDialogs({
	docType,
	dialogs,
	apiKeyValue,
	onApiKeyChange,
	onApiKeySave,
	tableEditData,
	onClearTableEditData,
	onInsertTable,
	onInsertUrl,
	onInsertPoll,
	onInsertMovieTemplate,
	onInsertIndex,
	onCreateFolder,
	onClearConfirm,
	title,
	category,
	onInsertTemplateContent,
}: EditorDialogsProps) {
	return (
		<>
			{/* API Key Dialog */}
			<ApiKeyDialog
				open={dialogs.isOpen('apiKey')}
				onOpenChange={open => (open ? dialogs.open('apiKey') : dialogs.close())}
				apiKey={apiKeyValue}
				onApiKeyChange={onApiKeyChange}
				onSave={onApiKeySave}
			/>

			{/* Poll Creator Dialog */}
			<PollCreatorDialog isOpen={dialogs.isOpen('poll')} onClose={dialogs.close} onInsert={onInsertPoll} />

			{/* Table Editor Dialog */}
			<TableEditorDialog
				isOpen={dialogs.isOpen('table')}
				onClose={() => {
					dialogs.close()
					onClearTableEditData()
				}}
				onInsert={onInsertTable}
				initialData={tableEditData?.initialData}
			/>

			{/* URL Dialog */}
			<UrlDialog
				open={dialogs.isOpen('url')}
				onOpenChange={open => (open ? dialogs.open('url') : dialogs.close())}
				onInsert={onInsertUrl}
				initialDisplayText={(dialogs.dialogData.urlSelection as string) || ''}
			/>

			{/* Create Folder Dialog */}
			<CreateFolderDialog
				open={dialogs.isOpen('folder')}
				onOpenChange={open => (open ? dialogs.open('folder') : dialogs.close())}
				onCreate={onCreateFolder}
				folderType={docType}
			/>

			{/* Clear Content Dialog */}
			<AlertDialog open={dialogs.isOpen('clear')} onOpenChange={open => (open ? dialogs.open('clear') : dialogs.close())}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Limpiar todo el contenido?</AlertDialogTitle>
						<AlertDialogDescription>
							Esta acción eliminará todo el texto del editor. No se puede deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={onClearConfirm}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Limpiar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Movie Template Dialog */}
			<MovieTemplateDialog isOpen={dialogs.isOpen('movie')} onClose={dialogs.close} onInsert={onInsertMovieTemplate} />

			{/* Index Creator Dialog */}
			<IndexCreatorDialog isOpen={dialogs.isOpen('index')} onClose={dialogs.close} onInsert={onInsertIndex} />

			{/* Insert Template Dialog */}
			<InsertTemplateDialog
				open={dialogs.isOpen('template')}
				onOpenChange={open => (open ? dialogs.open('template') : dialogs.close())}
				onInsert={(insertContent, insertTitle, insertCategory) => {
					onInsertTemplateContent(insertContent, insertTitle, insertCategory)
				}}
			/>
		</>
	)
}
