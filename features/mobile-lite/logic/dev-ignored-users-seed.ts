import { getUserCustomizations, saveUserCustomizations } from '@/features/user-customizations/storage'

const DEV_IGNORED_USERS = {
	ClaudeS: {
		isIgnored: true,
		ignoreType: 'hide' as const,
	},
	SilentMike: {
		isIgnored: true,
		ignoreType: 'mute' as const,
	},
}

export async function seedMobileLiteIgnoredUsersForDev(): Promise<void> {
	const data = await getUserCustomizations()

	await saveUserCustomizations({
		...data,
		users: {
			...data.users,
			...DEV_IGNORED_USERS,
		},
	})
}
