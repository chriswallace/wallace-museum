<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TopNav from '$lib/components/TopNav.svelte';
	import '../../app.css';

	// PWA and iOS detection for layout adjustments
	let isPWA = false;
	let isIOS = false;

	// Detect PWA and iOS
	function detectPWAAndPlatform() {
		if (typeof window === 'undefined') return;

		// Detect if running as PWA
		isPWA = window.matchMedia('(display-mode: standalone)').matches || 
				 (window.navigator as any).standalone === true ||
				 document.referrer.includes('android-app://');

		// Detect iOS
		isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	}

	onMount(() => {
		// Prevent automatic scroll restoration
		if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}

		// Detect PWA and platform
		detectPWAAndPlatform();

		// Listen for display mode changes (PWA installation/uninstallation)
		const mediaQuery = window.matchMedia('(display-mode: standalone)');
		const handleDisplayModeChange = () => detectPWAAndPlatform();
		mediaQuery.addEventListener('change', handleDisplayModeChange);

		return () => {
			mediaQuery.removeEventListener('change', handleDisplayModeChange);
		};
	});

	// Ensure we start at the top on navigation
	$: if ($page) {
		if (typeof window !== 'undefined') {
			window.scrollTo(0, 0);
		}
	}
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
	
	<!-- Favicon and App Icons -->
	<link rel="icon" type="image/png" href="/images/app-icon.png" />
	<link rel="apple-touch-icon" href="/images/app-icon.png" />
	<link rel="shortcut icon" href="/images/app-icon.png" />
	
	<!-- Web App Manifest -->
	<link rel="manifest" href="/manifest.json" />
	
	<!-- DNS Prefetch for Performance -->
	<link rel="dns-prefetch" href="//use.typekit.net" />
	<link rel="preconnect" href="https://use.typekit.net" crossorigin="anonymous" />
</svelte:head>

<TopNav />

<div class="page-container" class:pwa-ios={isPWA && isIOS}>
	<div class="content">
		<slot />
	</div>

	<footer class="site-footer">
		<div class="footer-content">
			<div class="copyright">
				<div class="font-bold">The Wallace Museum</div>
				<div>
					<div class="mb-12">
						{new Date().getFullYear()} &copy; Chris Wallace.
					</div>
					<div class="social-links inline">
						<a
							href="https://twitter.com/chriswallace"
							target="_blank"
							rel="noopener noreferrer"
							class="social-link"
						>
							@chriswallace
						</a>
						<a
							href="https://chriswallace.net"
							target="_blank"
							rel="noopener noreferrer"
							class="social-link"
						>
							chriswallace.net
						</a>
					</div>
				</div>
			</div>
		</div>
	</footer>
</div>

<style lang="scss" global>
	:root {
		--navbar-height: 64px;
	}

	body {
		@apply p-0 m-0;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.85em;
	}

	a {
		@apply text-primary;

		&:hover {
			@apply text-primary/80;
		}
	}

	/* Dark mode link colors */
	@media (prefers-color-scheme: dark) {
		a {
			@apply text-primary-dark;

			&:hover {
				@apply text-primary-dark/80;
			}
		}
	}

	.page-container {
		@apply min-h-screen flex flex-col relative;
		
		/* Mobile-first padding */
		padding-top: var(--navbar-height);
		
		/* Ensure proper spacing on mobile */
		@media (max-width: 768px) {
			padding-top: var(--navbar-height);
			/* Add a small buffer for mobile to prevent tight spacing */
			min-height: calc(100vh - var(--navbar-height));
		}
	}

	/* PWA iOS specific layout adjustments */
	.page-container.pwa-ios {
		/* Account for both navbar height and iOS status bar */
		padding-top: calc(var(--navbar-height) + env(safe-area-inset-top));
		
		/* Ensure proper spacing on mobile PWA */
		@media (max-width: 768px) {
			padding-top: calc(var(--navbar-height) + env(safe-area-inset-top));
			min-height: calc(100vh - var(--navbar-height) - env(safe-area-inset-top));
		}
	}

	.content {
		@apply flex-grow;
		
		/* Mobile-first approach */
		@media (max-width: 768px) {
			/* Ensure content doesn't get cut off */
			min-height: calc(100vh - var(--navbar-height) - 200px); /* 200px for footer */
			padding-bottom: 1rem;
		}
		
		@media (min-width: 769px) {
			padding-bottom: 2rem;
		}
	}

	.site-footer {
		@apply border-t border-gray-200 dark:border-gray-800 relative z-10;
		
		/* Mobile-first padding */
		padding-top: 2rem;
		padding-bottom: 2rem;
		
		@media (max-width: 768px) {
			padding-left: 1rem;
			padding-right: 1rem;
		}
		
		@media (min-width: 769px) {
			padding-top: 4rem;
			padding-bottom: 4rem;
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}

	.footer-content {
		@apply max-w-full mx-auto text-sm;
		
		/* Mobile-first layout */
		padding-left: 1rem;
		padding-right: 1rem;
		
		@media (max-width: 768px) {
			text-align: center;
		}
		
		@media (min-width: 769px) {
			@apply md:flex;
			padding-left: 2rem;
			padding-right: 2rem;
		}
	}

	.copyright {
		@apply text-sm text-gray-600 tracking-tight;
		
		/* Mobile-first spacing */
		@media (max-width: 768px) {
			margin-bottom: 1rem;
		}
	}

	.copyright p {
		@apply m-0 text-sm;
		
		/* Mobile-first spacing */
		@media (max-width: 768px) {
			margin-bottom: 0.5rem;
		}
	}

	.copyright p.text-white {
		@apply text-base font-bold;
	}

	.artists-copyright {
		@apply text-sm;
	}

	.social-link {
		@apply font-bold text-gray-600 no-underline hover:underline transition-colors text-sm;
		
		/* Mobile-first spacing */
		@media (max-width: 768px) {
			display: inline-block;
			margin-right: 1rem;
			margin-bottom: 0.5rem;
		}
		
		@media (min-width: 769px) {
			@apply first:mr-4;
		}
	}
</style>
