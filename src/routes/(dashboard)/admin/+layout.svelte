<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import { onMount } from 'svelte';

	let currentPage: string = '';
	let mobileMenuOpen = false;

	onMount(() => {
		// We no longer need to manually set dark mode - Tailwind will handle it
		
		// Close mobile menu when switching to desktop view
		const mediaQuery = window.matchMedia('(min-width: 768px)');
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
			<div class="flex items-center">
				<a class="logo-link" href="/">
					<img src="/images/wallace-museum-red.svg" alt="Wallace Museum" class="logo-svg logo-light" />
					<img src="/images/wallace-museum-yellow.svg" alt="Wallace Museum" class="logo-svg logo-dark" />
				</a>

				<!-- Mobile hamburger menu next to logo -->
				<button class="mobile-menu-btn md:hidden ml-2" on:click={toggleMobileMenu}>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
					</svg>
				</button>
			</div>

			<!-- Desktop Navigation -->
			<div class="primary-nav hidden md:flex">
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

			<!-- Username display (replaces logout button) -->
			<div class="user-info flex items-center">
				<span class="text-sm text-gray-600 dark:text-gray-300">Admin User</span>
			</div>
		</nav>

		<!-- Mobile Navigation Menu -->
		{#if mobileMenuOpen}
			<!-- Backdrop overlay -->
			<div class="mobile-nav-backdrop fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" on:click={closeMobileMenu}></div>
			
			<!-- Slide-in menu -->
			<div class="mobile-nav fixed top-0 left-0 h-full w-80 bg-white dark:bg-gray-900 shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
				<div class="p-0">
					<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Menu</h2>
						<button class="close-btn p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" on:click={closeMobileMenu}>
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
					
					<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
						<form action="/logout" method="POST">
							<button type="submit" class="logout-btn w-full text-left px-0 py-2">Log out</button>
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
		@apply col-span-1 md:col-span-3 relative;
		height: 64px;

		nav {
			@apply justify-between items-stretch flex w-full h-full;
		}

		.primary-nav {
			@apply flex-grow text-center flex items-stretch justify-center;
		}

		/* Mobile layout: only logo and hamburger */
		@media (max-width: 767px) {
			nav {
				@apply justify-between;
			}
			
			.primary-nav {
				@apply hidden;
			}
		}

		.mobile-menu-btn {
			@apply text-gray-600 dark:text-gray-300 p-2 hover:text-gray-800 dark:hover:text-gray-100 flex items-center cursor-pointer;
			min-width: 44px;
			min-height: 44px;
		}

		.mobile-nav {
			@apply transition-transform duration-300 ease-in-out;
		}

		.mobile-nav nav a {
			@apply block px-4 py-4 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors duration-200 w-full;
			display: block !important;
			width: 100% !important;
		}

		.mobile-nav nav a.selected {
			@apply text-gray-900 dark:text-gray-100 font-medium bg-gray-100 dark:bg-gray-800;
		}

		.mobile-nav .logout-btn {
			@apply text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-3 rounded-md transition-colors duration-200;
		}

		.mobile-nav .close-btn {
			@apply rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200;
		}

		.mobile-nav-backdrop {
			@apply transition-opacity duration-300 ease-in-out;
		}

		.logo-link {
			@apply hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none flex items-center;
			text-decoration: none;
			height: 64px;
			padding: 0;
		}

		.logo-svg {
			@apply w-auto;
			height: 64px;
		}

		/* Show red logo in light mode, hide yellow logo */
		.logo-light {
			display: block;
		}

		.logo-dark {
			display: none;
		}

		/* Show yellow logo in dark mode, hide red logo */
		@media (prefers-color-scheme: dark) {
			.logo-light {
				display: none;
			}

			.logo-dark {
				display: block;
			}
		}

		.primary-nav .selected {
			@apply text-gray-800 dark:text-gray-100 font-medium border-b-2;
			text-decoration: none;
			border-bottom-color: var(--color-primary);
		}

		.primary-nav a:hover:not(.logo-link) {
			@apply text-gray-800 dark:text-gray-100;
		}

		.primary-nav a,
		.primary-nav button {
			@apply text-gray-600 dark:text-gray-300 font-normal px-4 transition duration-300 ease-in-out decoration-2 underline-offset-8 underline decoration-transparent flex items-center border-b-2 border-b-transparent;
			font-variation-settings: initial;
		}

		.user-info {
			@apply px-4;
		}

		.user-info span {
			@apply font-medium;
		}
	}

	.ui-content {
		@apply w-full max-w-[1600px] col-span-1 md:col-span-3 p-6 mx-auto;
	}

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

	:global(h1 button) {
		@apply align-middle text-sm border border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300 ml-4 px-2 py-1 rounded-sm hover:bg-gray-100 hover:border-gray-500 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-gray-100;
	}

	:global(.back-btn) {
		@apply inline-block px-2 py-1 mb-6 uppercase text-sm border border-transparent rounded-sm text-gray-500 dark:text-gray-300 hover:text-gray-700 hover:border-gray-300 dark:hover:text-gray-100 dark:hover:border-gray-500 font-semibold no-underline transition duration-300 ease-in-out;
	}

	:global(.pagination) {
		@apply text-center py-16;
	}

	:global(.pagination button) {
		@apply inline-block px-4 py-3 mx-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600;
		border-radius: 4px;
		text-decoration: none;
	}

	:global(.pagination .selected) {
		@apply bg-primary text-white dark:text-black border-primary;
	}

	:global(.selected) {
		font-weight: bold;
	}

	:global(table) {
		@apply relative w-full;
		border-collapse: collapse;
	}

	:global(thead) {
		@apply bg-gray-100 dark:bg-gray-800;
	}

	:global(th),
	:global(td) {
		@apply text-left p-2 border-b border-gray-200 dark:border-gray-700;
	}

	:global(tr) {
		@apply dark:bg-gray-900;
	}

	:global(tr:nth-child(even)) {
		@apply dark:bg-gray-800;
	}

	:global(th) {
		@apply font-bold text-gray-600 dark:text-gray-300 uppercase text-sm py-4 border-b-2 border-gray-300 dark:border-gray-600;
	}

	:global(th.sortable) {
		@apply cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300;
	}

	:global(tr:hover td) {
		@apply dark:bg-gray-800;
	}

	:global(td button) {
		@apply block hover:underline;
	}

	:global(.image) {
		@apply p-0 w-12 h-12 m-0;
	}

	:global(.actions) {
		@apply max-w-[10px];
	}

	:global(.edit) {
		@apply text-primary border-2 border-primary hover:bg-primary hover:text-white dark:hover:text-black hover:no-underline rounded-sm text-sm uppercase no-underline font-bold px-3 py-2 m-0 mx-1;
	}

	:global(.flex-table) {
		width: 100%;
		border-collapse: collapse; /* Clean up table borders */
	}

	:global(.flex-table thead) {
		/* Ensures the header is not scrollable */
		display: table;
		width: 100%;
		table-layout: fixed;
	}

	:global(.flex-table tbody) {
		display: block;
		max-height: 400px; /* Adjust based on your needs */
		overflow-y: auto;
		width: 100%;
	}

	:global(.flex-table tr) {
		width: 100%;
		display: table;
	}

	:global(.flex-table th),
	:global(.flex-table td) {
		border: 1px solid #ddd;
		text-align: left;
		padding: 3px 8px; /* Adjust padding for visual appeal */
		@apply dark:border-gray-700;
	}

	:global(.flex-table th:first-child),
	:global(.flex-table td:first-child) {
		width: 35%;
	}

	:global(.flex-table th:nth-child(2)),
	:global(.flex-table td:nth-child(2)) {
		width: 40%;
	}

	:global(.flex-table th:last-child),
	:global(.flex-table td:last-child) {
		width: 25%;
	}

	:global(.flex-table th) {
		position: sticky;
		top: 0; /* Keeps the header on top */
		background-color: #f9f9f9; /* Gives a different color to distinguish the header */
		@apply dark:bg-gray-800;
	}

	:global(.flex-table button) {
		display: inline-block;
	}

	:global(.search) {
		@apply w-full float-right text-lg px-4 py-3 mb-8 rounded-sm;
	}

	:global(.artwork) {
		@apply w-24;
	}
</style>
