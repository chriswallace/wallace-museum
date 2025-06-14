<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Define navigation items
	const navItems = [
		{ label: 'Feed', path: '/' },
		{ label: 'Artists', path: '/artists' },
		{ label: 'About', path: '/about' }
	];

	// Make active state reactive to page changes
	$: currentPath = $page.url.pathname;

	// Create reactive active states for each nav item
	$: activeStates = navItems.map(item => {
		if (item.path === '/') {
			return currentPath === '/';
		}
		return currentPath.startsWith(item.path);
	});

	// Scroll hiding state - only for small screens
	let isNavVisible = true;
	let lastScrollY = 0;
	let ticking = false;

	// Mobile menu state
	let isMobileMenuOpen = false;

	function handleNavClick(path: string) {
		goto(path);
		// Close mobile menu after navigation
		isMobileMenuOpen = false;
	}

	function handleTitleClick() {
		goto('/');
		// Close mobile menu after navigation
		isMobileMenuOpen = false;
	}

	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	function closeMobileMenu() {
		isMobileMenuOpen = false;
	}

	function handleScroll() {
		if (!ticking) {
			requestAnimationFrame(updateNavVisibility);
			ticking = true;
		}
	}

	function updateNavVisibility() {
		if (!browser) return;
		
		const currentScrollY = window.scrollY;
		const scrollDifference = currentScrollY - lastScrollY;
		
		// Only apply scroll hiding on small screens (below md breakpoint - 768px)
		if (window.innerWidth < 768) {
			// Show navbar when scrolling up or at top of page
			if (scrollDifference < 0 || currentScrollY < 10) {
				isNavVisible = true;
			}
			// Hide navbar when scrolling down and past initial threshold
			else if (scrollDifference > 0 && currentScrollY > 100) {
				isNavVisible = false;
			}
		} else {
			// Always show navbar on medium screens and larger
			isNavVisible = true;
		}
		
		lastScrollY = currentScrollY;
		ticking = false;
	}

	function handleResize() {
		if (!browser) return;
		
		// Ensure navbar is always visible on medium screens and larger
		if (window.innerWidth >= 768) {
			isNavVisible = true;
			// Close mobile menu on resize to larger screen
			isMobileMenuOpen = false;
		}
	}

	// Handle escape key to close mobile menu
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isMobileMenuOpen) {
			closeMobileMenu();
		}
	}

	onMount(() => {
		if (!browser) return;
		
		// Set initial scroll position
		lastScrollY = window.scrollY;
		
		// Add event listeners
		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleResize);
		window.addEventListener('keydown', handleKeydown);
		
		// Handle initial screen size
		handleResize();
	});

	onDestroy(() => {
		if (!browser) return;
		
		// Clean up event listeners
		window.removeEventListener('scroll', handleScroll);
		window.removeEventListener('resize', handleResize);
		window.removeEventListener('keydown', handleKeydown);
	});
</script>

<nav class="top-nav" class:nav-hidden={!isNavVisible}>
	<!-- Mobile Layout (small screens) -->
	<div class="mobile-nav md:hidden">
		<!-- Museum Logo -->
		<button 
			class="mobile-logo"
			on:click={handleTitleClick}
			aria-label="Return to homepage"
		>
			<img src="/images/wallace-museum-red.svg" alt="Wallace Museum" class="logo-svg logo-light" />
			<img src="/images/wallace-museum-yellow.svg" alt="Wallace Museum" class="logo-svg logo-dark" />
		</button>

		<!-- Hamburger Menu Button -->
		<button 
			class="hamburger-button"
			on:click={toggleMobileMenu}
			aria-label="Toggle navigation menu"
			aria-expanded={isMobileMenuOpen}
		>
			<div class="hamburger-lines" class:open={isMobileMenuOpen}>
				<span></span>
				<span></span>
				<span></span>
			</div>
		</button>
	</div>

	<!-- Desktop Layout (medium screens and up) -->
	<div class="desktop-nav hidden md:flex">
		<!-- Museum Logo - positioned at left edge -->
		<button 
			class="page-logo"
			on:click={handleTitleClick}
			aria-label="Return to homepage"
		>
			<img src="/images/wallace-museum-red.svg" alt="Wallace Museum" class="logo-svg logo-light" />
			<img src="/images/wallace-museum-yellow.svg" alt="Wallace Museum" class="logo-svg logo-dark" />
		</button>

		<div class="nav-container">
			<!-- Center - Navigation tabs -->
			<div class="nav-center">
				<div class="nav-tabs">
					{#each navItems as item, index}
						<button
							type="button"
							class="nav-tab"
							class:active={activeStates[index]}
							on:click={() => handleNavClick(item.path)}
							aria-label={`Navigate to ${item.label}`}
						>
							{item.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</nav>

<!-- Mobile Menu Overlay -->
{#if isMobileMenuOpen}
	<!-- Background overlay with fade effect -->
	<div 
		class="mobile-menu-overlay md:hidden"
		on:click={closeMobileMenu}
		on:keydown={(e) => e.key === 'Enter' && closeMobileMenu()}
		role="button"
		tabindex="0"
		aria-label="Close navigation menu"
	></div>

	<!-- Slide-out menu panel -->
	<div class="mobile-menu-panel md:hidden">
		<div class="mobile-menu-header">
			<button 
				class="mobile-menu-close"
				on:click={closeMobileMenu}
				aria-label="Close navigation menu"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
		
		<nav class="mobile-menu-nav">
			{#each navItems as item, index}
				<button
					type="button"
					class="mobile-nav-item"
					class:active={activeStates[index]}
					on:click={() => handleNavClick(item.path)}
				>
					{item.label}
				</button>
			{/each}
		</nav>
	</div>
{/if}

<style lang="scss">
	.top-nav {
		@apply bg-white/90 backdrop-blur-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40;
		height: var(--navbar-height);
		transition: transform 0.3s ease-in-out;
	}

	.top-nav.nav-hidden {
		// Only hide on small screens
		@media (max-width: 767px) {
			transform: translateY(-100%);
		}
	}

	/* Mobile Navigation Styles */
	.mobile-nav {
		@apply flex items-center justify-between px-4;
		height: var(--navbar-height);
		
		/* Ensure it's hidden on medium screens and above */
		@media (min-width: 768px) {
			display: none !important;
		}
	}

	.mobile-logo {
		@apply bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none;
	}

	.logo-svg {
		@apply h-8 w-auto;
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

	.hamburger-button {
		@apply bg-transparent border-none cursor-pointer p-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 rounded-sm;
	}

	.hamburger-lines {
		@apply flex flex-col justify-center items-center w-6 h-6 relative;
		
		span {
			@apply block w-6 h-0.5 bg-gray-600 transition-all duration-300 ease-in-out;
			
			&:nth-child(1) {
				transform: translateY(-6px);
			}
			
			&:nth-child(2) {
				transform: translateY(0);
			}
			
			&:nth-child(3) {
				transform: translateY(6px);
			}
		}
		
		&.open {
			span {
				&:nth-child(1) {
					transform: rotate(45deg) translateY(0);
				}
				
				&:nth-child(2) {
					opacity: 0;
				}
				
				&:nth-child(3) {
					transform: rotate(-45deg) translateY(0);
				}
			}
		}
	}

	/* Desktop Navigation Styles */
	.desktop-nav {
		@apply w-full relative;
		height: var(--navbar-height);
		
		/* Ensure it's hidden on small screens */
		@media (max-width: 767px) {
			display: none !important;
		}
	}

	.page-logo {
		@apply m-0 p-0 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none;
		@apply absolute left-4 top-0 flex items-center z-10;
		height: var(--navbar-height);
	}

	.nav-container {
		@apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center;
		height: var(--navbar-height);
	}

	.nav-center {
		@apply flex items-center justify-center;
		height: var(--navbar-height);
	}

	.nav-tabs {
		@apply flex space-x-0;
	}

	.nav-tab {
		@apply px-6 py-2 font-semibold text-gray-600 hover:text-gray-900 transition-colors duration-200 text-sm;
		@apply bg-none border-none cursor-pointer outline-none;
		@apply relative flex items-center;
		height: var(--navbar-height);
	}

	.nav-tab.active {
		@apply text-primary;
	}

	.nav-tab.active::after {
		@apply absolute left-0 right-0 h-0.5 bg-primary;
		content: '';
		bottom: -1px;
	}

	.nav-tab:hover:not(.active) {
		@apply text-gray-800;
	}

	/* Mobile Menu Overlay and Panel */
	.mobile-menu-overlay {
		@apply fixed inset-0 bg-black/60 backdrop-blur-sm z-50;
		animation: fadeIn 0.25s ease-in-out;
	}

	.mobile-menu-panel {
		@apply fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white/95 backdrop-blur-md border-l border-gray-200 z-50;
		animation: slideIn 0.25s ease-in-out;
	}

	.mobile-menu-header {
		@apply flex items-center justify-between p-6;
	}

	.mobile-menu-title {
		@apply text-lg font-semibold text-gray-900 m-0;
	}

	.mobile-menu-close {
		@apply bg-transparent border-none text-gray-600 hover:text-gray-900 cursor-pointer p-2 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50;
	}

	.mobile-menu-nav {
		@apply flex flex-col p-6 space-y-2;
	}

	.mobile-nav-item {
		@apply w-full text-left px-4 py-3 text-lg font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50;
	}

	.mobile-nav-item.active {
		@apply text-primary bg-primary/10;
	}

	/* Dark mode styles */
	@media (prefers-color-scheme: dark) {
		.top-nav {
			@apply bg-black/40 border-gray-900;
		}

		.hamburger-button {
			@apply focus:ring-primary-dark;
		}

		.hamburger-lines span {
			@apply bg-white/40;
		}

		.nav-tab {
			@apply text-gray-300 hover:text-white;
		}

		.nav-tab.active {
			@apply text-primary-dark;
		}

		.nav-tab.active::after {
			@apply bg-primary-dark;
		}

		.nav-tab:hover:not(.active) {
			@apply text-gray-100;
		}

		.mobile-menu-panel {
			@apply bg-black/95 border-gray-700;
		}

		.mobile-menu-title {
			@apply text-white;
		}

		.mobile-menu-close {
			@apply text-gray-400 hover:text-white focus:ring-primary-dark;
		}

		.mobile-nav-item {
			@apply text-gray-300 hover:text-white hover:bg-gray-800/50 focus:ring-primary-dark;
		}

		.mobile-nav-item.active {
			@apply text-primary-dark bg-primary-dark/10;
		}
	}

	/* Animations */
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}
</style> 