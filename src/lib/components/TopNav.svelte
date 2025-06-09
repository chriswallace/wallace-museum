<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

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

	function handleNavClick(path: string) {
		goto(path);
	}

	function handleTitleClick() {
		goto('/');
	}
</script>

<nav class="top-nav">
	<!-- Museum Title - positioned at left edge -->
	<button 
		class="museum-title"
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
		@apply fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm;
		@apply relative;
	}

	.museum-title {
		@apply hidden md:block m-0 p-0 text-yellow-500 text-sm font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer hover:text-yellow-400 transition-colors duration-200 focus:text-yellow-400 focus:outline-none;
		@apply absolute left-4 top-0 h-12 flex items-center z-10;
	}

	.nav-container {
		@apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center h-12;
	}

	.nav-center {
		@apply flex items-center justify-center h-12;
	}

	.nav-tabs {
		@apply flex space-x-8;
	}

	.nav-tab {
		@apply px-3 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200;
		@apply bg-none border-none cursor-pointer outline-none;
		@apply relative h-12 flex items-center;
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

	@media (max-width: 768px) {
		.museum-title {
			@apply hidden;
		}

		.nav-container {
			@apply px-4;
		}

		.nav-tabs {
			@apply space-x-4;
		}

		.nav-tab {
			@apply px-2 py-1 text-xs;
		}
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.nav-container {
			@apply px-6;
		}

		.nav-tabs {
			@apply space-x-6;
		}
	}
</style> 