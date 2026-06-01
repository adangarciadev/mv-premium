export type ThreadActionsPresentation = 'none' | 'compact-menu' | 'classic-buttons'

export function getThreadActionsPresentation({
	hideEnabled,
	saveEnabled,
	contentRulesEnabled,
	classicActionsEnabled,
}: {
	hideEnabled: boolean
	saveEnabled: boolean
	contentRulesEnabled: boolean
	classicActionsEnabled: boolean
}): ThreadActionsPresentation {
	if (classicActionsEnabled) {
		return hideEnabled || saveEnabled ? 'classic-buttons' : 'none'
	}

	return hideEnabled || saveEnabled || contentRulesEnabled ? 'compact-menu' : 'none'
}
