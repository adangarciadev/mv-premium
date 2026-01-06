/**
 * Hooks Index - Central export for all custom hooks
 */

export { useActionFeedback } from './use-action-feedback'
export { useIsMobile } from './use-mobile'
export { useMutate, useStorageMutate, type UseMutateOptions, type UseMutateResult } from './use-mutate'
export { useStorage, useStorageTransform } from './use-storage'
export { useDialogManager, type DialogType, type DialogData, type UseDialogManagerReturn } from './use-dialog-manager'
export { useUploadState, type UseUploadStateOptions, type UseUploadStateReturn } from './use-upload-state'
export { useTextEditor } from './use-text-editor'
export { useThemeColors } from './use-theme-colors'

// Editor-specific hooks
export { useEditorHistory, useEditorSelection, useEditorShortcuts } from './editor'
