/**
 * Centralized Z-Index Registry
 * 
 * Ensures consistent stacking context across the extension.
 * Prefer using these constants over magic numbers or Tailwind classes
 * when dealing with injected DOM elements.
 */

export const Z_INDEXES = {
	// Base Layers
	BASE: 1,
	
	// Feature Specific
	LIVE_EDITOR: 1,
	CHAR_COUNTER: 5,
	DRAFT_HOST: 10,
	FAVORITE_BTN_CONTAINER: 10,
	
	// Standard UI Layers
	DROPDOWN: 40,
	STICKY: 50,
	OVERLAY: 90,
	MODAL: 100,
	POPOVER: 110,
	TOAST: 120,
	TOOLTIP: 130,
	
	// Maximum
	MAX: 99999,
} as const
