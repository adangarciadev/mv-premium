export type ColumnAlignment = 'left' | 'center' | 'right'

export interface TableInitialData {
	cells: string[][]
	alignments: ColumnAlignment[]
}

export interface TableEditorDialogProps {
	isOpen: boolean
	onClose: () => void
	onInsert: (markdown: string) => void
	initialData?: TableInitialData
}

export interface TableState {
	cells: string[][]
	alignments: ColumnAlignment[]
	selectedCol: number | null
	selectedRow: number | null
}

export interface TableActions {
	updateCell: (row: number, col: number, value: string) => void
	setTableSize: (rows: number, cols: number) => void
	addRow: () => void
	removeRow: () => void
	addColumn: () => void
	removeColumn: () => void
	clearTable: () => void
	resetTable: () => void
	setColumnAlignment: (col: number, alignment: ColumnAlignment) => void
	setSelectedCol: (col: number | null) => void
	setSelectedRow: (row: number | null) => void
	// New actions for column/row manipulation
	insertRowAbove: (row: number) => void
	insertRowBelow: (row: number) => void
	deleteRow: (row: number) => void
	moveRowUp: (row: number) => void
	moveRowDown: (row: number) => void
	insertColumnLeft: (col: number) => void
	insertColumnRight: (col: number) => void
	deleteColumn: (col: number) => void
	moveColumnLeft: (col: number) => void
	moveColumnRight: (col: number) => void
	generateMarkdown: () => string
}
