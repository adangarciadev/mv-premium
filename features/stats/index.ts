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
export { RhythmClock } from './components/rhythm-clock'
export { ActivityViewToggle } from './components/activity-view-toggle'

// Content Script Utils
export { setupPostTracker, completePendingThreadCreation, completePendingPostEdit, completePendingReply } from './post-tracker'

// Rhythm model + Time Tracker runtime
export {
	accumulateRhythm,
	createEmptyRhythm,
	getDayKey,
	getWeekKey,
	getWeekStart,
	normalizeRhythm,
	prepareRhythmStatsForStorage,
	type RhythmStats,
} from './logic/rhythm-model'
export {
	clearRhythmStats,
	generateRandomRhythm,
	getRhythmStats,
	getTimeStats,
	initTimeTracker,
	seedRandomRhythmStats,
	timeStatsStorage,
	watchRhythmStats,
	watchTimeStats,
	type TimeStats,
} from './logic/time-tracker'

// Activity view-mode preference + rhythm insights
export {
	getActivityViewMode,
	setActivityViewMode,
	type ActivityViewMode,
} from './logic/activity-view'
export {
	getTotalRhythmMs,
	hasEnoughRhythmData,
	getAverageRhythmHours,
	getRhythmDailyAverageHours,
	getRhythmDailyAverageMs,
	getRhythmAverageWeekdays,
	getAverageSubforumTimes,
	getRhythmTopDailySubforum,
	getPeakHour,
	getPeakHours,
	getPeakWeekday,
	getArchetype,
	getActiveBand,
	getRhythmWeeklySeries,
	getRhythmCalendarWeeks,
	getRhythmWeekDays,
	hasWeeklyData,
	getTopSubforumsForHour,
	getSubforumTotals,
	getWeekdaySubforums,
	getActiveDayCount,
	getWeekdayCounts,
	type Archetype,
	type WeekBucket,
	type DayBucket,
	type SubforumTime,
} from './logic/rhythm-insights'
