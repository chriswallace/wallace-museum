<script>
	import Header from '$lib/components/Header.svelte';
	import '../../app.css';
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
</svelte:head>

<div class="page-container">
	<div class="content">
		<slot />
	</div>

	<footer class="site-footer">
		<div class="footer-content">
			<div class="copyright">
				<p class="text-white font-bold">Wallace Museum</p>
				<p>
					{new Date().getFullYear()} &copy; Chris Wallace. All rights reserved. All artworks remain the
					property of their respective creators.
				</p>
			</div>
			<div class="social-links">
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
	</footer>
</div>

<style lang="scss" global>
	body {
		@apply p-0 m-0;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.85em;
	}

	a {
		color: rgb(29, 199, 74);

		&:hover {
			color: rgb(68, 240, 114);
		}
	}

	.page-container {
		@apply min-h-screen flex flex-col relative;
	}

	.content {
		@apply flex-grow;
	}

	.site-footer {
		@apply py-4 md:px-8 mt-16 border-t border-gray-800 relative z-10;
		background: rgba(0, 0, 0, 0.95);
	}

	.footer-content {
		@apply max-w-full mx-auto px-4 text-sm md:flex	justify-between;
	}

	.copyright {
		@apply text-base text-gray-600 tracking-tight;
	}

	.copyright p {
		@apply m-0 mb-1 text-base;
	}

	.artists-copyright {
		@apply text-xs;
	}

	.social-links {
		@apply mt-6;
	}

	.social-link {
		@apply font-bold text-gray-600 no-underline hover:underline transition-colors first:mr-4;
	}
</style>
