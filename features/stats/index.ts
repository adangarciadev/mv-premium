/**
 * Stats Feature - Barrel Export
 */

// Storage
export {
	trackActivity,
	getActivityData,
	getActivityForDate,
	getCountForDate,
	clearActivityData,
	watchActivity,
	formatDateKey,
	parseDateKey,
	type ActivityData,
	type ActivityType,
	type ActivityEntry,
	type TrackActivityOptions,
} from './storage'

// Components
export { ActivityGraph, ActivityGraphSkeleton } from './components/activity-graph'

// Content Script Utils
export { setupPostTracker } from './post-tracker'

// Time Tracker
export * from './logic/time-tracker'
