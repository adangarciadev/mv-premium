/**
 * Editor Feature
 *
 * Provides a rich text editing experience with BBCode formatting,
 * image uploading, code highlighting, and drafts.
 */

// Components
export { CodeEditorToolbar } from './components/code-editor-toolbar'

// Toolbar components
export {
	ApiKeyDialog,
	CodeToolbarButton,
	FeatureToolbarButtons,
	FormattingToolbarButtons,
	ImageDropzone,
	ImageToolbarButton,
	ListToolbarButton,
	ToastMessages,
} from './components/toolbar'

// Hooks
export { useImageUpload, useListFormatting, useTextInsertion } from './hooks'

// Logic (content script injection)
export { injectEditorToolbar } from './logic/editor-toolbar'
