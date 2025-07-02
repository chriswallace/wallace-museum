<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		html,
		body {
			margin: 0 !important;
			padding: 0 !important;
			font-family:
				system-ui,
				-apple-system,
				BlinkMacSystemFont,
				'Segoe UI',
				Roboto,
				Oxygen,
				Ubuntu,
				Cantarell,
				'Open Sans',
				'Helvetica Neue',
				sans-serif;
		}
	</style>
</svelte:head>

<div class="app-frame">
	<main>
		<div class="surface">
			<div class="text-center">
				<img class="logo" src="/images/app-icon.png" alt="Wallace Museum" width="60" height="60" />
			</div>
			<slot />
		</div>
	</main>
</div>

<style lang="scss" global>
	:global(.app-frame) {
		@apply bg-gray-200 dark:bg-[#21401F] text-gray-700 dark:text-gray-400 min-h-screen flex items-start justify-start;
	}

	:global(main) {
		@apply flex-grow w-full min-h-[100svh] max-w-xl;
	}

	:global(.surface) {
		@apply min-h-[100svh] bg-white dark:bg-gray-900/40 rounded-lg px-12;
	}

	:global(*) {
		font-variation-settings: initial;
	}

	:global(.logo) {
		@apply my-12;
	}

	:global(h1) {
		@apply font-sans text-xl lg:text-2xl dark:text-gray-50 font-semibold;
		font-variation-settings: initial;
	}

	:global(p) {
		@apply text-base text-gray-500;
	}

	:global(label) {
		@apply block mb-2 text-lg font-semibold text-gray-700 dark:text-gray-400;
	}

	:global(input[type='text']),
	:global(input[type='email']),
	:global(input[type='password']),
	:global(textarea) {
		@apply mb-6 p-4 box-border dark:bg-gray-900/0 block w-full border border-white/40 dark:border-gray-600 rounded-[8px] text-base text-gray-700 dark:text-white/70 placeholder-gray-400/60 focus:outline-none focus:ring-[#C57142] focus:border-[#C57142];
		appearance: none;
		-webkit-appearance: none;
		-moz-appearance: none;
		box-shadow: none;
		border-style: solid;
	}

	:global(input[type='submit']),
	:global(button[type='submit']) {
		@apply py-4 px-6 block w-full border border-transparent rounded-[8px] transition transition-colors duration-200 text-lg font-bold text-white hover:text-black bg-[#C57142] hover:bg-white focus:outline-none;
	}
</style>
