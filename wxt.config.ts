import { defineConfig } from 'wxt'
import path from 'path'

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	imports: false, // Disable auto-imports to avoid duplicated imports warnings

	manifest: {
		permissions: ['storage', 'scripting', 'activeTab', 'contextMenus'],
		host_permissions: [
			'*://*.mediavida.com/*',
			'*://store.steampowered.com/*',
			'https://api.giphy.com/*',
			'https://generativelanguage.googleapis.com/*',
			'https://catbox.moe/*',
			'https://api.imgbb.com/*',
		],
		name: 'MV Premium',
		description: 'Mejoras de calidad de vida para Mediavida',
		web_accessible_resources: [
			{
				resources: ['icon/*.png', 'assets/*.css'],
				matches: ['*://*.mediavida.com/*'],
			},
		],
		// --- CSP (hardened) ---
		content_security_policy: {
			extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' https://*.mediavida.com https://api.giphy.com https://generativelanguage.googleapis.com https://store.steampowered.com https://api.imgbb.com https://catbox.moe https://api.themoviedb.org https://image.tmdb.org ${
				process.env.NODE_ENV === 'development'
					? 'ws://localhost:3000 http://localhost:3000 ws://localhost:3001 http://localhost:3001'
					: ''
			}; img-src 'self' data: blob: https://*.mediavida.com https://giphy.com https://*.giphy.com https://image.tmdb.org https://www.themoviedb.org https://i.ytimg.com https://store.steampowered.com https://catbox.moe https://files.catbox.moe https://api.imgbb.com https://i.ibb.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;`,
		},
	},
	webExt: {
		disabled: true,
	},

	// analysis: {
	// 	enabled: true,
	// 	template: 'treemap',
	// 	open: true,
	// },

	vite: () => ({
		// Worker format must be 'es' for code-splitting compatibility
		worker: {
			format: 'es',
		},
		resolve: {
			dedupe: ['react', 'react-dom', 'react-router-dom'],
			alias: {
				'@': path.resolve(__dirname, './'),
			},
		},
		optimizeDeps: {
			include: ['react', 'react-dom'],
		},
		build: {
			sourcemap: false,
			// Use Terser only in production for aggressive minification
			// esbuild is 3x faster but produces slightly larger bundles
			minify: process.env.NODE_ENV === 'production' ? 'terser' : 'esbuild',
			terserOptions: {
				compress: {
					// Remove console.* calls in production
					drop_console: process.env.NODE_ENV === 'production',
					// Remove debugger statements
					drop_debugger: true,
					// Multiple compression passes
					passes: 3,
					// Dead code elimination
					dead_code: true,
					// Aggressive function inlining
					inline: 3,
					// Remove unreachable code
					unused: true,
					// Collapse simple sequences
					sequences: true,
					// Evaluate constant expressions
					evaluate: true,
					// Join consecutive simple statements
					join_vars: true,
					// Collapse single-use variables
					collapse_vars: true,
					// Remove pure function calls with no side effects
					pure_getters: true,
					// Reduce conditional expressions
					conditionals: true,
					// Optimize booleans
					booleans: true,
					// Optimize comparisons
					comparisons: true,
					// Remove redundant if/else
					if_return: true,
					// Hoist function declarations
					hoist_funs: true,
					// Hoist properties
					hoist_props: true,
					// Keep fnames false for better mangling
					keep_fnames: false,
					// Keep class names false for better mangling
					keep_classnames: false,
				},
				format: {
					// Remove all comments
					comments: false,
					// ASCII only output (smaller in some cases)
					ascii_only: true,
				},
				mangle: {
					// Mangle local variables (safe)
					toplevel: false,
					// Don't mangle properties - breaks React/library internals
					properties: false,
				},
			},
		},
	}),
})
