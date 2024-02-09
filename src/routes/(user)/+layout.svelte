<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="stylesheet" href="https://use.typekit.net/dpg0jya.css" />
</svelte:head>

<div class="app-frame">
	<main>
		<div class="surface">
			<slot />
		</div>
	</main>
</div>

<style lang="scss" global>
	.app-frame {
		@apply bg-gray-200 min-h-screen flex items-center justify-center;
	}

	main {
		@apply flex-grow w-full max-w-xl;
	}

	.surface {
		@apply bg-white rounded-lg shadow-xl p-8;
	}

	:global {
		* {
			font-variation-settings: initial;
		}

		h1 {
			@apply font-sans text-xl lg:text-2xl font-semibold;
			font-variation-settings: initial;
		}

		p {
			@apply text-base text-gray-500;
		}

		label {
			@apply block mb-2 text-lg font-semibold text-gray-700;
		}

		input[type='text'],
		input[type='email'],
		input[type='password'] {
			@apply mb-6 p-4 box-border block w-full border border-gray-300 rounded-md shadow-sm text-base text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500;
		}

		input[type='submit'],
		button[type='submit'] {
			@apply py-4 px-6 block w-full border border-transparent rounded-md text-lg font-bold text-white bg-gray-700 hover:bg-primary focus:outline-none;
		}
	}
</style>
