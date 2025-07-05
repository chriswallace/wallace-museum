<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import { onMount } from 'svelte';
	import { SquareLibrary, Image, UsersRound, Import } from 'lucide-svelte';

	let currentPage: string = '';
	let sidebarOpen = false;
	let sidebarCollapsed = false;
	let userDropdownOpen = false;

	onMount(() => {
		// Close sidebar when switching to desktop view
		const mediaQuery = window.matchMedia('(min-width: 768px)');
		const handleMediaChange = () => {
			if (mediaQuery.matches) {
				sidebarOpen = false;
			}
		};
		mediaQuery.addEventListener('change', handleMediaChange);
		
		// Close dropdown when clicking outside
		const handleClickOutside = (event: MouseEvent) => {
			if (userDropdownOpen && !(event.target as Element)?.closest('.user-dropdown-container')) {
				userDropdownOpen = false;
			}
		};
		document.addEventListener('click', handleClickOutside);
		
		return () => {
			mediaQuery.removeEventListener('change', handleMediaChange);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	page.subscribe(($page) => {
		currentPage = $page.url.pathname;
	});

	import '../../../admin.css';

	// Responsive toast theme that adapts to light/dark mode
	$: toastTheme = {
		'--toastBorderRadius': '8px'
	};

	function toggleSidebar() {
		sidebarOpen = !sidebarOpen;
	}

	function closeSidebar() {
		sidebarOpen = false;
	}

	function toggleSidebarCollapse() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleUserDropdown() {
		userDropdownOpen = !userDropdownOpen;
	}

	function closeUserDropdown() {
		userDropdownOpen = false;
	}

	// Navigation items with Lucide icon components
	const navItems = [
		{ href: '/admin/collections', label: 'Collections', icon: SquareLibrary },
		{ href: '/admin/artworks', label: 'Artworks', icon: Image },
		{ href: '/admin/artists', label: 'Artists', icon: UsersRound },
		{ href: '/admin/import', label: 'Import', icon: Import }
	];
</script>

<!-- App Container -->
<div class="flex h-screen bg-gray-50 dark:bg-gray-900">
	<!-- Mobile header -->
	<div class="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between h-16 px-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
		<a href="/" class="flex items-center">
			<img src="/images/app-icon.png" alt="Wallace Museum" class="h-8 w-8" />
		</a>
		<button
			on:click={toggleSidebar}
			class="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
			aria-label="Open sidebar"
		>
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
			</svg>
		</button>
	</div>

	<!-- Sidebar backdrop (mobile) -->
	{#if sidebarOpen}
		<div class="fixed inset-0 z-40 md:hidden">
			<div class="fixed inset-0 bg-gray-600 bg-opacity-75" on:click={closeSidebar}></div>
		</div>
	{/if}

	<!-- Sidebar -->
	<div class="fixed inset-y-0 left-0 z-50 {sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 transform {sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-all duration-300 ease-in-out md:translate-x-0 md:relative md:z-0 flex flex-col">
		<!-- Sidebar header -->
		<div class="flex items-center h-16 {sidebarCollapsed ? 'px-4' : 'px-6'} flex-shrink-0">
			<a href="/" class="flex items-center {sidebarCollapsed ? 'justify-center w-full' : 'space-x-3'}">
				<img src="/images/app-icon.png" alt="Wallace Museum" class="h-8 w-8 flex-shrink-0" />
			</a>
			
			{#if !sidebarCollapsed}
				<!-- Desktop collapse toggle -->
				<button
					on:click={toggleSidebarCollapse}
					class="hidden md:block ml-auto p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
					title="Collapse sidebar"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
					</svg>
				</button>
				
				<!-- Mobile close button -->
				<button
					on:click={closeSidebar}
					class="md:hidden ml-auto p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
		
		<!-- Collapsed sidebar expand button -->
		{#if sidebarCollapsed}
			<div class="px-2 pb-2">
				<button
					on:click={toggleSidebarCollapse}
					class="hidden md:flex w-full items-center justify-center p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
					title="Expand sidebar"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
					</svg>
				</button>
			</div>
		{/if}

		<!-- Navigation -->
		<nav class="flex-1 px-0 py-6 space-y-2 overflow-y-auto">
			{#each navItems as item}
				<a
					href={item.href}
					on:click={closeSidebar}
					class="flex items-center no-underline {sidebarCollapsed ? 'px-4 justify-center' : 'px-6'} py-2 text-sm font-medium transition-colors duration-200 {currentPage === item.href 
						? 'bg-yellow-400 text-black hover:text-black' 
						: 'text-gray-900 dark:text-gray-100 hover:text-gray-950 dark:hover:text-white'}"
					title={sidebarCollapsed ? item.label : ''}
				>
					<svelte:component this={item.icon} class="w-4 h-4 {sidebarCollapsed ? '' : 'mr-3'} flex-shrink-0" />
					{#if !sidebarCollapsed}
						<span class="truncate">{item.label}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<!-- Sidebar footer with user dropdown -->
		{#if !sidebarCollapsed}
			<div class="border-t border-gray-200 dark:border-gray-700 p-4 flex-shrink-0 relative user-dropdown-container">
				<button
					class="w-full flex items-center px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
					on:click={toggleUserDropdown}
				>
					<div class="flex-shrink-0">
						<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
							<span class="text-white text-sm font-medium">A</span>
						</div>
					</div>
					<div class="ml-3 flex-1">
						<p class="text-sm font-medium text-gray-900 dark:text-white truncate">Admin User</p>
						<p class="text-xs text-gray-500 dark:text-gray-400 truncate">Administrator</p>
					</div>
					<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 transform {userDropdownOpen ? 'rotate-180' : ''} transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7"></path>
					</svg>
				</button>
				
				<!-- Dropdown menu -->
				{#if userDropdownOpen}
					<div class="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
						<form action="/logout" method="POST">
							<button
								type="submit"
								class="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
							>
								<svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"></path>
								</svg>
								Sign out
							</button>
						</form>
					</div>
				{/if}
			</div>
		{:else}
			<div class="border-t border-gray-200 dark:border-gray-700 p-2 flex-shrink-0 flex justify-center relative user-dropdown-container">
				<button
					class="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
					title="User menu"
					on:click={toggleUserDropdown}
				>
					<div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
						<span class="text-white text-xs font-medium">A</span>
					</div>
				</button>
				
				<!-- Collapsed dropdown menu -->
				{#if userDropdownOpen}
					<div class="absolute bottom-full left-2 right-2 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
						<div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
							<p class="text-xs font-medium text-gray-900 dark:text-white">Admin User</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
						</div>
						<form action="/logout" method="POST">
							<button
								type="submit"
								class="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
							>
								<svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"></path>
								</svg>
								Sign out
							</button>
						</form>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Main content -->
	<div class="flex-1 flex flex-col overflow-hidden md:pt-0 pt-16">
		<main class="flex-1 overflow-y-auto">
			<div class="py-6 px-4 sm:px-6 lg:px-8">
				<slot />
			</div>
		</main>
	</div>
</div>

<SvelteToast options={{ 
	theme: toastTheme, 
	duration: 4000, 
	pausable: true,
	reversed: true,
	intro: { x: 256 }
}} />

<style lang="scss">
	/* Layout-specific global styles */
	:global(html),
	:global(body) {
		@apply h-full font-sans;
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

	/* Custom toast container positioning */
	:global(.toastContainer) {
		top: 1rem !important;
		right: 1rem !important;
		bottom: auto !important;
		left: auto !important;
		width: auto !important;
		max-width: 400px !important;
	}

	/* Enhanced toast styling */
	:global(.toast) {
		background: #ffffff !important;
		color: #1f2937 !important;
		border: 1px solid #e5e7eb !important;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
		backdrop-filter: blur(8px) !important;
	}

	:global(.toast .pe) {
		background: #3b82f6 !important;
	}

	/* Dark mode adjustments */
	@media (prefers-color-scheme: dark) {
		:global(.toast) {
			background: #1f2937 !important;
			color: #f9fafb !important;
			border: 1px solid #374151 !important;
			box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2) !important;
			backdrop-filter: blur(12px) !important;
		}

		:global(.toast .pe) {
			background: #60a5fa !important;
		}
	}
</style>
