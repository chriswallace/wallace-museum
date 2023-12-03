<script>
	import Header from '$lib/header/Header.svelte';
	import '../app.css';
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

<style type="scss" global>
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
		@apply flex h-screen min-w-[800px];
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
</style>
