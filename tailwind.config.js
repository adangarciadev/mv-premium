import tailwindAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: [
		'./entrypoints/**/*.{ts,tsx,html}',
		'./components/**/*.{ts,tsx}',
		'./features/**/*.{ts,tsx}',
		'./lib/**/*.{ts,tsx}',
	],
	theme: {
		extend: {
			colors: {
				// Using var() directly to support both HSL values and hex colors from theme presets
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)',
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)',
				},
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)',
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)',
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)',
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)',
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)',
				},
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				chart: {
					1: 'var(--chart-1)',
					2: 'var(--chart-2)',
					3: 'var(--chart-3)',
					4: 'var(--chart-4)',
					5: 'var(--chart-5)',
				},
				sidebar: {
					DEFAULT: 'var(--sidebar)',
					foreground: 'var(--sidebar-foreground)',
					primary: 'var(--sidebar-primary)',
					'primary-foreground': 'var(--sidebar-primary-foreground)',
					accent: 'var(--sidebar-accent)',
					'accent-foreground': 'var(--sidebar-accent-foreground)',
					border: 'var(--sidebar-border)',
					ring: 'var(--sidebar-ring)',
				},
				mv: {
					'bg-primary': 'var(--mv-bg-primary)',
					'bg-secondary': 'var(--mv-bg-secondary)',
					'bg-tertiary': 'var(--mv-bg-tertiary)',
					'bg-hover': 'var(--mv-bg-hover)',
					'text-primary': 'var(--mv-text-primary)',
					border: 'var(--mv-border)',
					accent: 'var(--mv-accent)',
					blue: 'var(--mv-blue)',
					orange: 'var(--mv-orange)',
					danger: 'var(--mv-danger)',
				},
				table: {
					DEFAULT: 'var(--table)',
					header: 'var(--table-header)',
					row: 'var(--table-row)',
					'row-hover': 'var(--table-row-hover)',
					'row-selected': 'var(--table-row-selected)',
					border: 'var(--table-border)',
				},
			},
			borderRadius: {
				xl: 'calc(var(--radius) + 4px)',
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
			fontFamily: {
				sans: ['proxima-nova', 'Helvetica Neue', 'Arial', 'sans-serif'],
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' },
				},
				'gradient-x': {
					'0%, 100%': {
						'background-size': '200% 200%',
						'background-position': 'left center',
					},
					'50%': {
						'background-size': '200% 200%',
						'background-position': 'right center',
					},
				},
				'pulse-slow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'gradient-x': 'gradient-x 3s ease infinite',
				'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
			},
		},
	},
	plugins: [tailwindAnimate],
}
