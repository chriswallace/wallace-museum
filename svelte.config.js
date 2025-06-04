import vercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';

const config = {
	// Use the modern vite preprocessor instead of svelte-preprocess
	preprocess: vitePreprocess(),

	extensions: ['.svelte'], // Add this

	kit: {
		adapter: vercel({
			// default options are shown. On some platforms
			// these options are set automatically — see below
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false
		})
	},
	vite: {
		server: {
			hmr: {
				clientPort: process.env.HMR_HOST ? 443 : 24678,
				host: process.env.HMR_HOST ? process.env.HMR_HOST.substring('https://'.length) : 'localhost'
			}
		}
	}
};

export default config;
