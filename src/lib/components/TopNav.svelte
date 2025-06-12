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

	function handleNavClick(path: string) {
		goto(path);
	}

	function handleTitleClick() {
		goto('/');
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
		}
	}

	onMount(() => {
		if (!browser) return;
		
		// Set initial scroll position
		lastScrollY = window.scrollY;
		
		// Add event listeners
		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleResize);
		
		// Handle initial screen size
		handleResize();
	});

	onDestroy(() => {
		if (!browser) return;
		
		// Clean up event listeners
		window.removeEventListener('scroll', handleScroll);
		window.removeEventListener('resize', handleResize);
	});
</script>

<nav class="top-nav" class:nav-hidden={!isNavVisible}>
	<!-- Museum Title - positioned at left edge -->
	<button 
		class="page-title"
		on:click={handleTitleClick}
		aria-label="Return to homepage"
	>
		The Wallace Museum
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
</nav>

<style lang="scss">
	.top-nav {
		@apply bg-black/80 backdrop-blur-sm border-b border-gray-700;
		height: var(--navbar-height);
	}

	.top-nav.nav-hidden {
		// Only hide on small screens
		@media (max-width: 767px) {
			transform: translateY(-100%);
		}
	}

	.page-title {
		@apply invisible md:visible m-0 p-0 text-yellow-500 text-sm font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-yellow-400 transition-colors duration-200 focus:text-yellow-400 focus:outline-none;
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
		@apply px-6 py-2 font-semibold text-gray-500 hover:text-white transition-colors duration-200 text-sm;
		@apply bg-none border-none cursor-pointer outline-none;
		@apply relative flex items-center;
		height: var(--navbar-height);
	}

	.nav-tab.active {
		@apply text-yellow-500;
	}

	.nav-tab.active::after {
		@apply absolute left-0 right-0 h-0.5 bg-yellow-500;
		content: '';
		bottom: -1px; /* Position it to overlap with the border */
	}

	.nav-tab:hover:not(.active) {
		@apply text-gray-100;
	}
</style> 