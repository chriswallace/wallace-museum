<script lang="ts">
	import { page } from '$app/stores';

	let online: boolean;
</script>

<svelte:head>
	<title>Error {$page.status}</title>
</svelte:head>

<svelte:window bind:online />

<div class="error">
	<h1>{$page.status}</h1>
	<p>{$page.error?.message}</p>
</div>

<style lang="scss">
	html {
		font-size: 16px;
	}

	body {
		margin: 0;
		padding: 0;
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
		background-color: #eee;
	}
	
	.error {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		text-align: center;
	}

	h1 {
		font-weight: normal;
		color: #333;
		font-size: 2.5rem;
		border-right: 1px solid #999;
		margin-right: 16px;
		padding-right: 16px;
		padding-top: 0;
		padding-bottom: 0;
		margin-top: 0;
		margin-bottom: 0;
		line-height: 1;
	}

	p {
		color: #666;
		font-size: 1rem;
	}
</style>
