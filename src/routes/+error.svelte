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
