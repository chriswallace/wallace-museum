<script>
	import Header from '$lib/header/Header.svelte';
	import '../../app.css';
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
</svelte:head>

<div class="page-grid">
	<div class="left-column">
		<Header />
	</div>

	<div class="main-column">
		<main>
			<slot />
		</main>
	</div>
</div>

<div class="mobile-notice">
	<img src="/images/wallace-museum.png" alt="Wallace Museum" />
	<p>
		This experience was designed for modern graphics processing hardware and wide-format displays.
		Please access it from a modern tablet, notebook, or PC for the optimal experience.<br /><br
		/><span>- Chris Wallace</span>
	</p>
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
	.page-grid {
		@apply h-screen min-w-[800px] md:flex;
	}

	.page-grid .left-column {
		@apply w-[380px] h-full;
	}

	.page-grid .left-column header {
		@apply h-full;
	}

	.page-grid .main-column {
		@apply flex-grow overflow-x-auto w-full;
	}

	.mobile-notice {
		@apply md:hidden flex flex-col bg-gray-200 w-screen text-black justify-center items-center h-screen font-display text-2xl p-6 sm:p-12 mx-auto;

		font-variation-settings:
			'wght' 500,
			'wdth' 80,
			'CUTT' 80;

		img {
			@apply max-w-[220px] mb-12 mr-auto;
		}

		p {
			@apply mr-12;
		}

		span {
			@apply uppercase text-xl ml-4;
			font-variation-settings:
				'wght' 400,
				'wdth' 40,
				'CUTT' 80;
		}
	}

	@media (prefers-color-scheme: dark) {
		.mobile-notice {
			background-color: black;
			color: white;
		}
	}
</style>
