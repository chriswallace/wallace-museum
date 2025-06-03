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
					DEFAULT: 'rgb(184 92 40)',
					50: 'rgb(251 247 244)',
					100: 'rgb(247 237 230)',
					200: 'rgb(238 218 201)',
					300: 'rgb(229 199 172)',
					400: 'rgb(211 161 114)',
					500: 'rgb(184 92 40)',
					600: 'rgb(166 83 36)',
					700: 'rgb(138 69 30)',
					800: 'rgb(110 55 24)',
					900: 'rgb(92 46 20)',
					950: 'rgb(55 27 12)'
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
