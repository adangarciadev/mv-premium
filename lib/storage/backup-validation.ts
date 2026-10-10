/** Runtime validation of persisted sections, including legacy optional fields. */
import { z } from 'zod'
import { draftsDataSchema } from '@/features/drafts/storage/schema'
import { settingsSchema } from '@/store/settings-schema'
import { DEFAULT_SETTINGS } from '@/store/settings-defaults'
const text = z.string()
const id = text.min(1)
const time = z.number().finite().nonnegative()
const textMap = z.record(text, text)
const timeMap = z.record(text, time)
export const movieReviewSchema = z.looseObject({
	imageId: id,
	imageUrl: text,
	title: text,
	rating: z.number().finite(),
	createdAt: time,
})
const blockSchema = z.discriminatedUnion('type', [
	z.looseObject({
		id, type: z.literal('field'), field: text, label: text.optional(), separator: text.optional(), wrapper: text.optional(), conditional: z.boolean().optional(), maxItems: time.optional(), addLineBreak: z.boolean().optional()
	}),
	z.looseObject({
		id, type: z.literal('section'), sectionTitle: text, contentField: text.optional(), addLineBreak: z.boolean().optional()
	}),
	z.looseObject({
		id, type: z.literal('raw'), rawText: text, addLineBreak: z.boolean().optional()
	}),
])
const mediaTemplateSchema = z.looseObject({
	id, type: z.enum(['movie', 'tvshow', 'season', 'game', 'mobile-game', 'anime', 'manga']),
	name: text, blocks: z.array(blockSchema), isDefault: z.boolean().optional(), version: time.optional(),
})
const extraSettingsValidators: Record<string, z.ZodType> = {
	shortcuts: z.record(text, text.nullable()),
	workModeOptions: z.record(text, z.boolean()),
	mediaTemplates: z.record(text, mediaTemplateSchema.nullable()),
}
const thread = z.looseObject({
	id, title: text, subforum: text, subforumId: text,
})
const subforum = z.looseObject({
	id, name: text, url: text, iconClass: text.optional(), description: text.optional()
})
const preset = z.looseObject({
	id, name: text, colors: textMap
})
const customization = z.looseObject({
	usernameCustom: text.optional(), usernameColour: text.optional(), badge: text.optional(),
	badgeColor: text.optional(), badgeTextColor: text.optional(), badgeStyle: z.enum(['badge', 'text']).optional(),
	isIgnored: z.boolean().optional(), avatarUrl: text.optional(), note: text.optional(),
	highlightColor: text.optional(), ignoreType: z.enum(['hide', 'mute']).optional(),
})
const sectionsSchema = z.looseObject({
	settings: z.record(text, z.unknown()).optional(),
	themes: z.looseObject({
		ui: z.looseObject({
			resolvedTheme: z.enum(['dark', 'light']).optional(), rawTheme: z.enum(['dark', 'light', 'system']).optional(),
			custom: z.looseObject({
				activePresetId: text, customColorsLight: textMap, customColorsDark: textMap, customRadius: text.optional()
			}).optional(),
			savedPresets: z.array(z.looseObject({
				id, name: text, colors: z.looseObject({
					light: textMap, dark: textMap
				})
			})).optional(),
			customFont: text.optional(), applyFontGlobally: z.boolean().optional(), postFontSize: z.number().finite().min(80).max(200).optional(),
		}).optional(),
		mediavida: z.looseObject({
			state: z.looseObject({
				enabled: z.boolean(), activePresetId: text, colorOverrides: textMap
			}).optional(),
			savedPresets: z.array(preset).optional(),
		}).optional(),
	}).optional(),
	content: z.looseObject({
		drafts: draftsDataSchema.optional(),
		savedThreads: z.array(thread.extend({
			savedAt: time, notes: text.optional()
		})).optional(),
		hiddenThreads: z.array(thread.extend({
			hiddenAt: time
		})).optional(),
		hiddenSubforums: z.array(subforum.extend({
			hiddenAt: time
		})).optional(),
		favoriteSubforums: z.array(subforum.extend({
			addedAt: time
		})).optional(),
		contentRules: z.array(z.looseObject({
			id, name: text, enabled: z.boolean(), action: z.enum(['hide', 'highlight']),
			matchTitle: text, matchAuthor: text, subforumIds: z.array(text), highlightColor: text.optional(), createdAt: time, updatedAt: time,
		})).optional(),
		userCustomizations: z.looseObject({
			users: z.record(text, customization), globalSettings: z.looseObject({
				adminColor: text.optional(), subadminColor: text.optional(), modColor: text.optional(), userColor: text.optional(),
			})
		}).optional(),
		threadClipperHistory: z.array(z.looseObject({
			id, title: text, sourceUrl: text, sourceTitle: text, subforum: text,
			template: z.enum(['news', 'article', 'video', 'review', 'deal', 'rumor']), body: text, createdAt: time,
		})).optional(),
		pinnedPosts: z.array(z.looseObject({
			threadId: id,
			metadata: z.looseObject({
				title: text, subforumSlug: text, subforumName: text
			}).optional(),
			posts: z.array(z.looseObject({
				num: z.number().int().positive(), author: text, avatarUrl: text.optional(), preview: text, timestamp: time, pageNum: z.number().int().positive()
			})),
		})).optional(),
	}).optional(),
	mediaffinity: z.looseObject({
		runtimes: timeMap.optional()
	}).optional(),
	preferences: z.looseObject({
		nativeLiveDelay: time.optional(), liveThreadDelay: time.optional()
	}).optional(),
	stats: z.looseObject({
		timeStats: timeMap.optional(),
		rhythmStats: z.looseObject({
			hours: z.array(time).length(24), weekdays: z.array(time).length(7), weeks: timeMap,
			hourSubforums: z.record(text, timeMap).optional(), weekdayHours: z.record(text, z.array(time).length(24)).optional(),
			weekdaySubforums: z.record(text, timeMap).optional(), days: timeMap.optional(), daySubforums: z.record(text, timeMap).optional(),
		}).optional(),
	}).optional(),
})
export function validateBackupSections(data: Record<string, unknown>): void {
	const result = sectionsSchema.safeParse(data)
	if (!result.success) {
		const issue = result.error.issues[0]
		throw new Error(`El backup no es válido: data.${issue.path.join('.')}.`)
	}
	// Validate provided settings individually, without filling defaults into a partial backup.
	for (const [key, value] of Object.entries(result.data.settings ?? {})) {
		const validator = Object.prototype.hasOwnProperty.call(settingsSchema.shape, key) ? settingsSchema.shape[key as keyof typeof settingsSchema.shape] : undefined
		const extraValidator = extraSettingsValidators[key]
		const defaultValue: unknown = Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key) ? DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] : undefined
		const wrongPrimitiveType = defaultValue !== undefined && typeof defaultValue !== 'object' && typeof value !== typeof defaultValue
		if (wrongPrimitiveType || (validator && !validator.safeParse(value).success) || (extraValidator && !extraValidator.safeParse(value).success)) {
			throw new Error(`El backup no es válido: data.settings.${key}.`)
		}
	}
}
