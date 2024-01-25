<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';

	let currentPage;

	if (browser) {
		// Subscribe to $page store to force rerunning the load function
		page.subscribe(($page) => {
			currentPage = $page.url.pathname;
		});
	}

	onMount(() => {
		// Logic that depends on currentPage, if necessary
	});
</script>

<div class="ui-frame">
	<div class="ui-header">
		<nav>
			<a class="medici" href="/">Medici.</a>

			<div class="primary-nav">
				<a href="/admin">Dashboard</a>
				<a href="/admin/collections">Collections</a>
				<a href="/admin/artworks">Artworks</a>
				<a href="/admin/import">Import NFTs</a>
			</div>

			{#if $page.data.user}
				<form action="/logout" method="POST">
					<button type="submit">Log out</button>
				</form>
			{/if}
		</nav>
	</div>
	<div class="ui-content">
		<slot />
	</div>
</div>

<style lang="scss">
	.ui-frame {
		@apply grid grid-cols-1 md:grid-cols-3 gap-4 min-h-screen auto-rows-min;
	}

	.ui-header {
		@apply col-span-1 md:col-span-3 bg-white p-6;

		nav {
			@apply justify-center items-center flex w-full;
		}

		.primary-nav {
			@apply flex-grow text-center;
		}

		form {
			@apply inline-block justify-self-end;
		}

		a,
		button {
			@apply text-gray-800 no-underline font-normal px-2 py-3 m-0 mx-1;
			font-variation-settings: initial;
		}
	}

	.ui-content {
		@apply w-full max-w-[1600px] col-span-1 md:col-span-3 p-12 mx-auto;
	}

	:global {
		body {
			@apply bg-gray-100 font-sans;
		}

		h1,
		h2,
		h3,
		h4,
		h5,
		h6,
		label {
			@apply font-sans;
			font-variation-settings: initial;
		}

		.pagination {
			@apply text-center py-16;

			button {
				@apply inline-block px-4 py-3 mx-1;
				border: 1px solid #ccc;
				border-radius: 4px;
				text-decoration: none;
				color: #333;
			}

			.selected {
				@apply bg-primary text-white border-primary;
			}
		}

		.selected {
			font-weight: bold;
		}

		table {
			@apply relative w-full;
			border-collapse: collapse;
		}

		thead {
			@apply sticky top-0 bg-gray-100;
		}

		th,
		td {
			@apply text-left p-2 border-b border-gray-200;
		}

		th {
			@apply font-bold text-gray-600 uppercase text-sm py-4 border-b-2 border-gray-300;
		}

		td div {
			@apply w-full max-w-[220px] truncate;
		}

		.actions {
			@apply max-w-[10px];
		}

		tr td {
			@apply transition duration-200 ease-in-out;
		}

		td button {
			@apply block hover:underline;
		}

		tr:hover td {
			@apply bg-white;
		}

		.edit {
			@apply text-primary border-2 border-primary hover:bg-primary hover:text-white hover:no-underline rounded-sm text-sm uppercase no-underline font-bold px-3 py-2 m-0 mx-1;
		}

		.artwork {
			@apply w-24;
		}
	}
</style>
