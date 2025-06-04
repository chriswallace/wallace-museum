<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteToast } from '@zerodevx/svelte-toast';
	import { onMount } from 'svelte';

	let currentPage: string = '';

	onMount(() => {
		// We no longer need to manually set dark mode - Tailwind will handle it
	});

	page.subscribe(($page) => {
		currentPage = $page.url.pathname;
	});

	import '../../../admin.css';

	// Dark mode toast theme options
	$: toastTheme = {
		'--toastBackground': 'var(--background-without-opacity)',
		'--toastColor': 'var(--text-color)',
		'--toastBarBackground': 'var(--color-primary)',
		'--toastBorderRadius': 'var(--border-radius-sm)'
	};
</script>

<div class="ui-frame bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-200">
	<div class="ui-header bg-white dark:bg-primary">
		<nav>
			<a class="medici" href="/">Medici.</a>

			<div class="primary-nav">
				<a href="/admin/collections" class={currentPage === '/admin/collections' ? 'selected' : ''}
					>Collections</a
				>
				<a href="/admin/artworks" class={currentPage === '/admin/artworks' ? 'selected' : ''}
					>Artworks</a
				>
				<a href="/admin/artists" class={currentPage === '/admin/artists' ? 'selected' : ''}
					>Artists</a
				>
				<a href="/admin/import" class={currentPage === '/admin/import' ? 'selected' : ''}>Import</a>
			</div>

			<form action="/logout" method="POST">
				<button type="submit">Log out</button>
			</form>
		</nav>
	</div>
	<div class="ui-content bg-white dark:bg-gray-900">
		<slot />
	</div>
</div>

<SvelteToast options={{ theme: toastTheme, duration: 4000, pausable: true }} />

<style lang="scss">
	.ui-frame {
		@apply grid grid-cols-1 md:grid-cols-3 gap-4 min-h-screen auto-rows-min;
	}

	.ui-header {
		@apply col-span-1 md:col-span-3 p-6;

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
			@apply text-gray-800 dark:text-white font-normal px-2 py-3 transition duration-300 ease-in-out decoration-2 underline-offset-8 underline decoration-transparent;
			font-variation-settings: initial;
		}

		.selected {
			@apply decoration-white;
		}
	}

	.ui-content {
		@apply w-full max-w-[1600px] col-span-1 md:col-span-3 p-6 mx-auto;
	}

	:global(body) {
		@apply bg-gray-100 dark:bg-gray-900 font-sans;
	}

	:global(h1),
	:global(h2),
	:global(h3),
	:global(h4),
	:global(h5),
	:global(h6),
	:global(label) {
		@apply font-sans dark:text-gray-100;
		font-variation-settings: initial;
	}

	:global(h1 button) {
		@apply align-middle text-sm border border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300 ml-4 px-2 py-1 rounded-sm hover:bg-primary hover:border-primary hover:text-white dark:hover:text-black;
	}

	:global(.back-btn) {
		@apply inline-block px-2 py-1 mb-6 uppercase text-sm border border-transparent rounded-sm text-gray-500 dark:text-gray-300 hover:text-primary hover:border-primary dark:hover:text-primary dark:hover:border-primary font-semibold no-underline transition duration-300 ease-in-out;
	}

	:global(.pagination) {
		@apply text-center py-16;
	}

	:global(.pagination button) {
		@apply inline-block px-4 py-3 mx-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600;
		border-radius: 4px;
		text-decoration: none;
	}

	:global(.pagination .selected) {
		@apply bg-primary text-white dark:text-black border-primary;
	}

	:global(.selected) {
		font-weight: bold;
	}

	:global(table) {
		@apply relative w-full;
		border-collapse: collapse;
	}

	:global(thead) {
		@apply bg-gray-100 dark:bg-gray-800;
	}

	:global(th),
	:global(td) {
		@apply text-left p-2 border-b border-gray-200 dark:border-gray-700;
	}

	:global(tr) {
		@apply dark:bg-gray-900;
	}

	:global(tr:nth-child(even)) {
		@apply dark:bg-gray-800;
	}

	:global(th) {
		@apply font-bold text-gray-600 dark:text-gray-300 uppercase text-sm py-4 border-b-2 border-gray-300 dark:border-gray-600;
	}

	:global(th.sortable) {
		@apply cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300;
	}

	:global(tr:hover td) {
		@apply dark:bg-gray-800;
	}

	:global(td button) {
		@apply block hover:underline;
	}

	:global(.image) {
		@apply p-0 w-12 h-12 m-0;
	}

	:global(.actions) {
		@apply max-w-[10px];
	}

	:global(.edit) {
		@apply text-primary border-2 border-primary hover:bg-primary hover:text-white dark:hover:text-black hover:no-underline rounded-sm text-sm uppercase no-underline font-bold px-3 py-2 m-0 mx-1;
	}

	:global(.flex-table) {
		width: 100%;
		border-collapse: collapse; /* Clean up table borders */
	}

	:global(.flex-table thead) {
		/* Ensures the header is not scrollable */
		display: table;
		width: 100%;
		table-layout: fixed;
	}

	:global(.flex-table tbody) {
		display: block;
		max-height: 400px; /* Adjust based on your needs */
		overflow-y: auto;
		width: 100%;
	}

	:global(.flex-table tr) {
		width: 100%;
		display: table;
	}

	:global(.flex-table th),
	:global(.flex-table td) {
		border: 1px solid #ddd;
		text-align: left;
		padding: 3px 8px; /* Adjust padding for visual appeal */
		@apply dark:border-gray-700;
	}

	:global(.flex-table th:first-child),
	:global(.flex-table td:first-child) {
		width: 35%;
	}

	:global(.flex-table th:nth-child(2)),
	:global(.flex-table td:nth-child(2)) {
		width: 40%;
	}

	:global(.flex-table th:last-child),
	:global(.flex-table td:last-child) {
		width: 25%;
	}

	:global(.flex-table th) {
		position: sticky;
		top: 0; /* Keeps the header on top */
		background-color: #f9f9f9; /* Gives a different color to distinguish the header */
		@apply dark:bg-gray-800;
	}

	:global(.flex-table button) {
		display: inline-block;
	}

	:global(.search) {
		@apply w-full float-right text-lg px-4 py-3 mb-8 rounded-sm;
	}

	:global(.artwork) {
		@apply w-24;
	}
</style>
