<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// Define navigation items
	const navItems = [
		{ label: 'Home', path: '/' },
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

	// Mobile menu state
	let isMobileMenuOpen = false;

	// PWA detection state
	let isPWA = false;
	let isIOS = false;

	// Touch handling for swipe-to-close
	let touchStartX = 0;
	let touchStartY = 0;
	let isDragging = false;

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

	// Handle escape key to close mobile menu
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isMobileMenuOpen) {
			closeMobileMenu();
		}
	}

	// Detect PWA and iOS
	function detectPWAAndPlatform() {
		if (!browser) return;

		// Detect if running as PWA
		isPWA = window.matchMedia('(display-mode: standalone)').matches || 
				 (window.navigator as any).standalone === true ||
				 document.referrer.includes('android-app://');

		// Detect iOS
		isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
				(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
	}

	// Touch event handlers for swipe-to-close
	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.touches[0].clientX;
		touchStartY = event.touches[0].clientY;
		isDragging = false;
	}

	function handleTouchMove(event: TouchEvent) {
		if (!touchStartX || !touchStartY) return;

		const touchCurrentX = event.touches[0].clientX;
		const touchCurrentY = event.touches[0].clientY;
		
		const deltaX = touchCurrentX - touchStartX;
		const deltaY = touchCurrentY - touchStartY;
		
		// Only consider horizontal swipes (more horizontal than vertical)
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			isDragging = true;
			// Swipe right to close (positive deltaX)
			if (deltaX > 50) {
				closeMobileMenu();
			}
		}
	}

	function handleTouchEnd() {
		touchStartX = 0;
		touchStartY = 0;
		isDragging = false;
	}

	onMount(() => {
		if (!browser) return;
		
		// Detect PWA and platform
		detectPWAAndPlatform();
		
		// Add event listeners
		window.addEventListener('keydown', handleKeydown);
		
		// Listen for display mode changes (PWA installation/uninstallation)
		const mediaQuery = window.matchMedia('(display-mode: standalone)');
		const handleDisplayModeChange = () => detectPWAAndPlatform();
		mediaQuery.addEventListener('change', handleDisplayModeChange);
		
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			mediaQuery.removeEventListener('change', handleDisplayModeChange);
		};
	});

	onDestroy(() => {
		if (!browser) return;
		
		// Clean up event listeners
		window.removeEventListener('keydown', handleKeydown);
	});
</script>

<nav class="top-nav" class:pwa-ios={isPWA && isIOS}>
	<!-- Mobile Layout (small screens) -->
	<div class="mobile-nav md:hidden">
		<!-- Museum Logo -->
		<a
			href="/"
			class="mobile-logo"
			aria-label="Wallace Museum"
		>
			<img src="/images/app-icon.png" alt="Wallace Museum" class="logo-img" />
		</a>

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
		<a
			href="/"
			class="page-logo"
			aria-label="Wallace Museum"
		>
			<img src="/images/app-icon.png" alt="Wallace Museum" class="logo-img" />
		</a>

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
	<div 
		class="mobile-menu-panel md:hidden"
		on:touchstart={handleTouchStart}
		on:touchmove={handleTouchMove}
		on:touchend={handleTouchEnd}
	>
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
		/* Ensure consistent behavior across devices */
		min-height: var(--navbar-height);
	}

	/* PWA iOS specific styles - extend behind status bar */
	.top-nav.pwa-ios {
		/* Use solid white background for better iOS integration */
		@apply bg-white;
		/* Extend the background behind the status bar */
		top: calc(-1 * env(safe-area-inset-top));
		/* Adjust height to include the status bar area */
		height: calc(var(--navbar-height) + env(safe-area-inset-top));
		min-height: calc(var(--navbar-height) + env(safe-area-inset-top));
	}

	/* Mobile nav positioning - add top padding to push content below status bar */
	.top-nav.pwa-ios .mobile-nav {
		height: var(--navbar-height);
		/* Add padding to push content below status bar */
		padding-top: env(safe-area-inset-top);
		min-height: calc(var(--navbar-height) + env(safe-area-inset-top));
	}

	/* Desktop nav positioning - add top padding to push content below status bar */
	.top-nav.pwa-ios .desktop-nav {
		height: var(--navbar-height);
		/* Add padding to push content below status bar */
		padding-top: env(safe-area-inset-top);
		min-height: calc(var(--navbar-height) + env(safe-area-inset-top));
	}

	.top-nav.pwa-ios .page-logo {
		/* Logo positioned normally within the content area */
		height: var(--navbar-height);
		/* Position logo below the status bar */
		top: env(safe-area-inset-top);
	}

	.top-nav.pwa-ios .nav-container {
		/* Nav container positioned normally within the content area */
		height: var(--navbar-height);
		/* Add top margin to account for status bar */
		margin-top: env(safe-area-inset-top);
	}

	.top-nav.pwa-ios .nav-center {
		/* Keep nav center height normal */
		height: var(--navbar-height);
	}

	.top-nav.pwa-ios .nav-tab {
		/* Keep nav tab height normal */
		height: var(--navbar-height);
	}

	/* Mobile Navigation Styles */
	.mobile-nav {
		@apply flex items-center justify-between;
		height: var(--navbar-height);
		min-height: var(--navbar-height);
		
		/* Mobile-first padding */
		padding-left: 1rem;
		padding-right: 1rem;
		
		/* Ensure it's hidden on medium screens and above */
		@media (min-width: 768px) {
			display: none !important;
		}
	}

	.mobile-logo {
		@apply bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none;
		/* Ensure logo doesn't get cut off */
		flex-shrink: 0;
	}

	.logo-img {
		@apply h-8 w-auto;
		/* Ensure consistent sizing */
		min-height: 2rem;
		max-height: 2rem;
	}

	.hamburger-button {
		@apply bg-transparent border-none cursor-pointer p-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-50 rounded-sm;
		/* Ensure button doesn't get cut off */
		flex-shrink: 0;
		/* Improve touch target */
		min-width: 44px;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
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
		min-height: var(--navbar-height);
		
		/* Ensure it's hidden on small screens */
		@media (max-width: 767px) {
			display: none !important;
		}
	}

	.page-logo {
		@apply m-0 p-0 bg-transparent border-none cursor-pointer hover:opacity-80 transition-opacity duration-200 focus:opacity-80 focus:outline-none;
		@apply absolute left-4 top-0 flex items-center z-10;
		height: var(--navbar-height);
		min-height: var(--navbar-height);
	}

	.nav-container {
		@apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center;
		height: var(--navbar-height);
		min-height: var(--navbar-height);
	}

	.nav-center {
		@apply flex items-center justify-center;
		height: var(--navbar-height);
		min-height: var(--navbar-height);
	}

	.nav-tabs {
		@apply flex space-x-0;
	}

	.nav-tab {
		@apply px-6 py-2 font-semibold text-gray-600 hover:text-gray-900 transition-colors duration-200 text-sm;
		@apply bg-none border-none cursor-pointer outline-none;
		@apply relative flex items-center;
		height: var(--navbar-height);
		min-height: var(--navbar-height);
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
		/* Ensure overlay covers the entire screen including status bar */
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.mobile-menu-panel {
		@apply fixed top-0 right-0 h-full bg-white/95 backdrop-blur-md border-l border-gray-200 z-50;
		animation: slideIn 0.25s ease-in-out;
		padding: 0;
		
		/* Mobile-first width */
		width: 280px;
		max-width: 85vw;
		
		/* Ensure panel covers full height including status bar on iOS */
		height: 100vh;
		height: 100dvh; /* Dynamic viewport height for better mobile support */
	}

	.mobile-menu-nav {
		@apply flex flex-col space-y-0;
		display: flex !important;
		flex-direction: column !important;
		
		/* Mobile-first padding */
		padding: 1rem;
		padding-top: calc(var(--navbar-height) + 1rem);
		
		/* Account for iOS safe areas */
		padding-top: calc(var(--navbar-height) + env(safe-area-inset-top) + 1rem);
	}

	.mobile-nav-item {
		@apply w-full text-left font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 bg-transparent border-none cursor-pointer focus:outline-none focus:ring-0 block;
		display: block !important;
		width: 100% !important;
		flex: none !important;
		margin: 0 !important;
		border-radius: 0.5rem !important;
		border-bottom: 1px solid rgba(0, 0, 0, 0.05);
		
		/* Mobile-first padding and sizing */
		padding: 1rem 1.5rem;
		font-size: 1rem;
		line-height: 1.4;
		
		/* Improve touch targets */
		min-height: 48px;
		display: flex !important;
		align-items: center;
	}

	.mobile-nav-item.active {
		@apply text-primary bg-primary/10;
	}

	/* Dark mode styles */
	@media (prefers-color-scheme: dark) {
		.top-nav {
			@apply bg-black/40 border-gray-900;
		}

		/* PWA iOS dark mode - use solid black background */
		.top-nav.pwa-ios {
			@apply bg-black;
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

		.mobile-nav-item {
			@apply text-gray-300 hover:text-white hover:bg-gray-800/50 focus:ring-0;
			border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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