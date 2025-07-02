<script lang="ts">
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<svelte:head>
	<title>Reset password</title>
</svelte:head>

<h1>Reset password</h1>

<form action="?/reset" method="POST">
	<div>
		<label for="username">Email address</label>
		<input id="username" name="username" type="text" required />
	</div>

	{#if form?.invalid}
		<p class="error">Please enter a valid email address.</p>
	{/if}

	<button type="submit">Reset password</button>
</form>

<style lang="scss">
	h1 {
		@apply mb-8;
	}
</style>
