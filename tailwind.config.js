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
					// Light mode: Red theme
					DEFAULT: '#FF1111',
					50: '#FFF5F5',
					100: '#FFE3E3',
					200: '#FFC9C9',
					300: '#FFA8A8',
					400: '#FF8787',
					500: '#FF1111',
					600: '#E60E0E',
					700: '#CC0C0C',
					800: '#B30A0A',
					900: '#990808',
					950: '#660505'
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
					DEFAULT: '#FF1111', // Red for light mode
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
