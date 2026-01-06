import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./tests/setup.ts'],
		include: ['**/*.{test,spec}.{ts,tsx}'],
		exclude: ['node_modules', '.output', 'dist', '.wxt'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['lib/**', 'features/**', 'hooks/**', 'services/**'],
			exclude: ['**/*.d.ts', '**/index.ts', '**/*.test.ts', '**/*.spec.ts'],
			reportsDirectory: './coverage',
		},
		alias: {
			'@': resolve(__dirname, './'),
		},
		// Timeouts
		testTimeout: 10000,
		hookTimeout: 10000,
	},
})
