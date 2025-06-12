<script lang="ts">
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<svelte:head>
	<title>Log in</title>
</svelte:head>

<h1>Log in</h1>

<form action="?/login" method="POST">
	<div>
		<label for="username">Username</label>
		<input id="username" name="username" type="text" required />
	</div>

	<div>
		<label for="password">Password</label>
		<input id="password" name="password" type="password" required />
	</div>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<button type="submit">Log in</button>
</form>

<style lang="scss">
	h1 {
		@apply mb-8;
	}
</style>
