module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}', './static/collection/*.html'],
	darkMode: 'media',
	theme: {
		borderRadius: {
			none: 0,
			sm: 'var(--border-radius-sm)',
			md: 'var(--border-radius-md)',
			lg: 'var(--border-radius-lg)',
			full: '500px'
		},
		extend: {
			colors: {
				primary: {
					// Light mode: Cool gray theme
					DEFAULT: '#6B7280',
					50: '#F9FAFB',
					100: '#F3F4F6',
					200: '#E5E7EB',
					300: '#D1D5DB',
					400: '#9CA3AF',
					500: '#6B7280',
					600: '#4B5563',
					700: '#374151',
					800: '#1F2937',
					900: '#111827',
					950: '#030712'
				},
				'primary-dark': {
					// Dark mode: Yellow theme
					DEFAULT: '#FCED1C',
					50: '#FFFEF0',
					100: '#FFFCE0',
					200: '#FFF9C2',
					300: '#FFF59E',
					400: '#FFF075',
					500: '#FCED1C',
					600: '#E6D419',
					700: '#CCBB16',
					800: '#B3A213',
					900: '#998910',
					950: '#66590A'
				},
				// Add utility classes for theme-aware colors
				'theme-primary': {
					DEFAULT: '#424242', // Cool gray for light mode
					dark: '#FCED1C' // Yellow for dark mode
				},
				secondary: 'var(--color-secondary)',
				success: 'var(--color-background-success)',
				success_text: 'var(--color-text-success)',
				error: 'var(--color-background-error)',
				error_text: 'var(--color-text-error)',
				gray: {
					100: '#F5F5F5',
					200: '#E0E0E0',
					300: '#BDBDBD',
					400: '#9E9E9E',
					500: '#7E7E7E',
					600: '#616161',
					700: '#424242',
					800: '#303030',
					900: '#222222',
					950: '#1C1C1C'
				}
			},
			fontFamily: {
				display: ['var(--serif-font-family)', 'serif'],
				sans: ['var(--font-family)', 'sans-serif'],
				body: ['var(--serif-font-family)', 'sans-serif']
			}
		}
	},
	plugins: [require('@tailwindcss/typography')]
};
