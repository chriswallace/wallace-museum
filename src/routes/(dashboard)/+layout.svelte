<script>
	import '../../admin.css';
</script>

<svelte:head>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
	<link
		href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="admin">
	<main>
		<slot />
	</main>
</div>
