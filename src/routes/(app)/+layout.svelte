<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import TopNav from '$lib/components/TopNav.svelte';
	import '../../app.css';

	onMount(() => {
		// Prevent automatic scroll restoration
		if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}
	});

	// Ensure we start at the top on navigation
	$: if ($page) {
		if (typeof window !== 'undefined') {
			window.scrollTo(0, 0);
		}
	}
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
</svelte:head>

<TopNav />

<div class="page-container">
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
		padding-top: var(--navbar-height);
	}

	.content {
		@apply flex-grow;
	}

	.site-footer {
		@apply py-16 md:px-4 border-t border-gray-200 dark:border-gray-800 relative z-10;
	}

	.footer-content {
		@apply max-w-full mx-auto px-8 text-sm md:flex;
	}

	.copyright {
		@apply text-sm text-gray-600 tracking-tight;
	}

	.copyright p {
		@apply m-0 mb-0 text-sm;
	}

	.copyright p.text-white {
		@apply text-base font-bold;
	}

	.artists-copyright {
		@apply text-sm;
	}

	.social-link {
		@apply font-bold text-gray-600 no-underline hover:underline transition-colors first:mr-4 text-sm;
	}
</style>
