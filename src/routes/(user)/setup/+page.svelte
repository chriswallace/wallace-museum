<script lang="ts">
	import type { ActionData } from './$types';

	export let form: ActionData;
</script>

<svelte:head>
	<title>Admin Setup</title>
</svelte:head>

<h1>Admin Setup</h1>
<p>Create a username and password that will be used to log in and administer your website.</p>

<form action="?/register" method="POST">
	<div>
		<label for="username">Username</label>
		<input id="username" name="username" type="text" required />
	</div>

	<div>
		<label for="email">Email address</label>
		<input id="email" name="email" type="email" required />
	</div>

	<div>
		<label for="password">Password</label>
		<input id="password" name="password" type="password" required />
	</div>

	{#if form?.error}
		<p class="error">{form.error}</p>
	{/if}

	<button type="submit">Register</button>
</form>

<style lang="scss">
	h1 {
		@apply mb-2;
	}

	p {
		@apply text-xl mb-8;
	}
</style>
