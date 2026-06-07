import { defineConfig } from 'wxt'
import path from 'path'

const FIREFOX_ANDROID_MIN_VERSION = '120.0'
const ENABLE_FIREFOX_ANDROID = process.env.MVP_ENABLE_FIREFOX_ANDROID === 'true'

function getBrowserSpecificSettings() {
	const geckoSettings = {
		gecko: {
			id: 'mv-premium@adan-dev',
			data_collection_permissions: {
				required: ['none'],
			},
		},
	}

	if (!ENABLE_FIREFOX_ANDROID) {
		return geckoSettings
	}

	return {
		...geckoSettings,
		gecko_android: {
			strict_min_version: FIREFOX_ANDROID_MIN_VERSION,
		},
	}
}

// See https://wxt.dev/api/config.html
export default defineConfig({
	modules: ['@wxt-dev/module-react'],
	imports: false, // Disable auto-imports to avoid duplicated imports warnings
	hooks: {
		'build:manifestGenerated': (_, manifest) => {
			if (!ENABLE_FIREFOX_ANDROID) return

			delete manifest.options_page
			delete manifest.options_ui
		},
	},

	manifest: {
		permissions: ['storage', 'activeTab', 'contextMenus', 'scripting', 'declarativeNetRequest'],
		host_permissions: [
			'*://*.mediavida.com/*',
			'https://platform.twitter.com/*',
			'*://store.steampowered.com/*',
			'https://api.giphy.com/*',
			'https://generativelanguage.googleapis.com/*',
			'https://api.imgbb.com/*',
			'https://freeimage.host/*',
			'https://api.isthereanydeal.com/*',
			'https://assets.isthereanydeal.com/*',
			'https://dbxce1spal1df.cloudfront.net/*',
			'https://publish.twitter.com/*',
			'https://cdn.syndication.twimg.com/*',
			'https://graphql.anilist.co/*',
			'https://s4.anilist.co/*',
			'*://api.igdb.com/*',
			'*://id.twitch.tv/*',
		],
		name: 'MV Premium',
		description:
			'La experiencia definitiva para Mediavida. Potencia el foro con herramientas modernas, navegación fluida y personalización total.',
		// @ts-ignore: Firefox exposes newer browser_specific_settings fields before WXT types catch up.
		browser_specific_settings: getBrowserSpecificSettings(),
		web_accessible_resources: [
			{
				resources: ['icon/*.png', 'assets/*.css'],
				matches: ['*://*.mediavida.com/*'],
			},
		],
		// --- CSP (hardened) ---
		content_security_policy: {
			extension_pages: `script-src 'self'; object-src 'self'; connect-src 'self' https://*.mediavida.com https://api.giphy.com https://generativelanguage.googleapis.com https://store.steampowered.com https://api.imgbb.com https://freeimage.host https://api.isthereanydeal.com https://assets.isthereanydeal.com https://dbxce1spal1df.cloudfront.net https://publish.twitter.com https://cdn.syndication.twimg.com https://graphql.anilist.co https://s4.anilist.co https://api.themoviedb.org https://image.tmdb.org https://id.twitch.tv https://api.igdb.com ${
				process.env.NODE_ENV === 'development'
					? 'ws://localhost:3000 http://localhost:3000 ws://localhost:3001 http://localhost:3001'
					: ''
			}; img-src 'self' data: blob: https: http:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;`,
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
					// Remove console.* calls in production?
					// NO: We use pure_funcs to only remove specific ones, keeping console.table/group for mvpDebug
					drop_console: false,
					pure_funcs: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
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
