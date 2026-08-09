import { initRelatedThreadsDisplay, teardownRelatedThreadsDisplay } from '@/features/related-threads'

export function initMobileLiteRelatedThreads(): void {
	initRelatedThreadsDisplay()
}

export function teardownMobileLiteRelatedThreads(): void {
	teardownRelatedThreadsDisplay()
}
