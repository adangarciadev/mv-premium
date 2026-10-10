import { z } from 'zod'
const timestamp = z.number().finite().nonnegative()
export const draftSchema = z.looseObject({
	id: z.string().min(1), title: z.string(),
	content: z.string().nullish().transform(value => value ?? ''),
	type: z.enum(['draft', 'template']).default('draft'),
	subforum: z.string().optional(), category: z.string().optional(), categoryLabel: z.string().optional(),
	folderId: z.string().optional(), trigger: z.string().optional(),
	createdAt: timestamp.default(0), updatedAt: timestamp.default(0),
})
export const folderSchema = z.looseObject({
	id: z.string().min(1), name: z.string(), icon: z.string(), color: z.string().optional(),
	type: z.enum(['draft', 'template']).optional(), createdAt: timestamp.default(0),
})
export const draftsDataSchema = z.looseObject({
	drafts: z.array(draftSchema), folders: z.array(folderSchema),
}).superRefine((data, ctx) => {
	for (const field of ['drafts', 'folders'] as const) {
		const ids = data[field].map(item => item.id)
		if (new Set(ids).size !== ids.length)
			ctx.addIssue({
				code: 'custom', path: [field], message: 'IDs duplicados'
			})
	}
})
