import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

/**
 * Prevent keyboard events from bubbling to parent page
 * Useful for inputs inside dialogs on Mediavida
 */
export const stopKeyboardPropagation = (e: React.KeyboardEvent) => {
	e.stopPropagation()
}

// NOTE: sanitizeHTML and createSanitizedMarkup have been moved to '@/lib/sanitize'
// Import directly from there to avoid bundling DOMPurify (~20KB) in unrelated modules