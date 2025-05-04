/// <reference types="vitest" />
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		// Add environment setup if needed, e.g., for DOM or testing library
		environment: 'jsdom', // Or 'happy-dom', or 'node'
		globals: true // Optional: Use if you want Vitest globals like expect, vi, etc.
	}
};

export default config;
