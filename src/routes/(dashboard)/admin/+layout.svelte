<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import { onMount } from 'svelte';

	let currentPage: string = '';
	let mobileMenuOpen = false;

	onMount(() => {
		// We no longer need to manually set dark mode - Tailwind will handle it
		
		// Close mobile menu when switching to desktop view
		const mediaQuery = window.matchMedia('(min-width: 1024px)');
		const handleMediaChange = () => {
			if (mediaQuery.matches) {
				closeMobileMenu();
			}
		};
		mediaQuery.addEventListener('change', handleMediaChange);
		
		return () => {
			mediaQuery.removeEventListener('change', handleMediaChange);
		};
	});

	page.subscribe(($page) => {
		currentPage = $page.url.pathname;
	});

	import '../../../admin.css';

	// Dark mode toast theme options
	$: toastTheme = {
		'--toastBackground': 'var(--background-without-opacity)',
		'--toastColor': 'var(--text-color)',
		'--toastBarBackground': 'var(--color-primary)',
		'--toastBorderRadius': 'var(--border-radius-sm)'
	};

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
		console.log('Mobile menu toggled:', mobileMenuOpen);
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<div class="ui-frame bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">
	<div class="ui-header bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
		<nav>
			<a class="logo-link" href="/">
				<img src="/images/app-icon.png" alt="Wallace Museum" class="logo-img" />
			</a>

			<!-- Mobile hamburger menu next to logo - ONLY visible on mobile -->
			<button class="mobile-menu-btn block lg:hidden ml-2" on:click={toggleMobileMenu}>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
				</svg>
			</button>

			<!-- Desktop Navigation - ONLY visible on desktop -->
			<div class="primary-nav hidden lg:flex">
				<a href="/admin/collections" class={currentPage === '/admin/collections' ? 'selected' : ''}
					>Collections</a
				>
				<a href="/admin/artworks" class={currentPage === '/admin/artworks' ? 'selected' : ''}
					>Artworks</a
				>
				<a href="/admin/artists" class={currentPage === '/admin/artists' ? 'selected' : ''}
					>Artists</a
				>
				<a href="/admin/import" class={currentPage === '/admin/import' ? 'selected' : ''}>Import</a>
			</div>

			<!-- Username display - ONLY visible on desktop -->
			<div class="user-info hidden lg:flex items-center">
				<span class="text-sm text-gray-600 dark:text-gray-300">Admin User</span>
			</div>
		</nav>

		<!-- Mobile Navigation Menu -->
		{#if mobileMenuOpen}
			<!-- Backdrop overlay -->
			<div class="mobile-nav-backdrop fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" on:click={closeMobileMenu}></div>
			
			<!-- Slide-in menu -->
			<div class="mobile-nav fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 shadow-xl z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
				<div class="p-0">
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
						<div class="flex flex-col">
							<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h2>
							<span class="text-sm text-gray-600 dark:text-gray-400">Admin User</span>
						</div>
						<button class="close-btn p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-yellow-400" on:click={closeMobileMenu}>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
							</svg>
						</button>
					</div>
					
					<nav class="space-y-0" style="display: flex; flex-direction: column;">
						<a href="/admin/collections" class={currentPage === '/admin/collections' ? 'selected' : ''} on:click={closeMobileMenu}
							style="display: block !important; width: 100% !important; margin: 0; padding: 16px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); border-radius: 0;">Collections</a
						>
						<a href="/admin/artworks" class={currentPage === '/admin/artworks' ? 'selected' : ''} on:click={closeMobileMenu}
							style="display: block !important; width: 100% !important; margin: 0; padding: 16px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); border-radius: 0;">Artworks</a
						>
						<a href="/admin/artists" class={currentPage === '/admin/artists' ? 'selected' : ''} on:click={closeMobileMenu}
							style="display: block !important; width: 100% !important; margin: 0; padding: 16px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); border-radius: 0;">Artists</a
						>
						<a href="/admin/import" class={currentPage === '/admin/import' ? 'selected' : ''} on:click={closeMobileMenu}
							style="display: block !important; width: 100% !important; margin: 0; padding: 16px 24px; border-bottom: 1px solid rgba(0, 0, 0, 0.05); border-radius: 0;">Import</a>
					</nav>
					
					<div class="border-t border-gray-200 dark:border-gray-700">
						<form action="/logout" method="POST">
							<button type="submit" class="logout-btn block mx-auto text-left px-0 py-2">Log out</button>
						</form>
					</div>
				</div>
			</div>
		{/if}
	</div>
	<div class="ui-content bg-white dark:bg-gray-900">
		<slot />
	</div>
</div>

<SvelteToast options={{ theme: toastTheme, duration: 4000, pausable: true }} />

<style lang="scss">
	.ui-frame {
		@apply grid grid-cols-1 md:grid-cols-3 gap-4 min-h-screen auto-rows-min;
	}

	.ui-header {
		@apply col-span-1 md:col-span-3 w-full relative;
		height: 64px;

		nav {
			@apply flex items-center justify-between w-full h-full;
		}

		/* Mobile-first approach - mobile menu button visible by default */
		.mobile-menu-btn {
			@apply text-gray-600 dark:text-gray-300 p-2 hover:text-gray-800 dark:hover:text-gray-100 flex items-center cursor-pointer;
			min-width: 44px;
			min-height: 44px;
		}

		/* Desktop navigation - hidden by default, shown on large screens */
		.primary-nav {
			@apply hidden items-center justify-center space-x-0;
		}

		/* User info - hidden by default, shown on large screens */
		.user-info {
			@apply hidden items-center px-4;
		}

		.user-info span {
			@apply font-medium;
		}

		/* Large screen styles */
		@media (min-width: 1024px) {
			.mobile-menu-btn {
				@apply hidden;
			}

			.primary-nav {
				@apply flex;
			}

			.user-info {
				@apply flex;
			}
		}

		/* Logo styles */
		.logo-link {
			@apply hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none flex items-center;
			text-decoration: none;
			height: 64px;
			padding: 0;
		}

		.logo-img {
			@apply w-auto;
			height: 64px;
		}

		/* Mobile menu styles */
		.mobile-nav {
			@apply transition-transform duration-300 ease-in-out;
		}

		.mobile-nav nav a {
			@apply block px-4 py-4 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-yellow-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors duration-200 w-full;
			display: block !important;
			width: 100% !important;
		}

		.mobile-nav nav a.selected {
			@apply text-gray-900 dark:text-yellow-400 font-medium bg-gray-100 dark:bg-gray-800;
		}

		.mobile-nav .logout-btn {
			@apply text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-3 rounded-md transition-colors duration-200;
		}

		.mobile-nav .close-btn {
			@apply rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 dark:hover:text-yellow-400;
		}

		.mobile-nav-backdrop {
			@apply transition-opacity duration-300 ease-in-out;
		}

		/* Navigation link styles */
		.primary-nav a {
			@apply text-gray-600 dark:text-gray-300 font-normal px-4 py-2 transition duration-300 ease-in-out flex items-center border-b-2 border-b-transparent;
			height: 64px;
			text-decoration: none;
		}

		.primary-nav a:hover {
			@apply text-gray-800 dark:text-yellow-300;
		}

		.primary-nav a.selected {
			@apply text-gray-800 dark:text-yellow-400 font-medium border-b-2 border-b-yellow-400;
		}
	}

	.ui-content {
		@apply w-full max-w-[1600px] col-span-1 md:col-span-3 mx-auto p-4 md:p-6;
	}

	/* Layout-specific global styles that need to stay here */
	:global(body) {
		@apply bg-gray-100 dark:bg-gray-900 font-sans;
	}

	:global(h1),
	:global(h2),
	:global(h3),
	:global(h4),
	:global(h5),
	:global(h6),
	:global(label) {
		@apply font-sans dark:text-gray-100;
		font-variation-settings: initial;
	}
</style>
