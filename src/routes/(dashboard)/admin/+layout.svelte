<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { SvelteToast } from '@zerodevx/svelte-toast';

	let currentPage;

	if (browser) {
		page.subscribe(($page) => {
			currentPage = $page.url.pathname;
		});
	}

	onMount(() => {});
</script>

<div class="ui-frame">
	<div class="ui-header">
		<nav>
			<a class="medici" href="/">Medici.</a>

			<div class="primary-nav">
				<a href="/admin" class={currentPage === '/admin' ? 'selected' : ''}>Dashboard</a>
				<a href="/admin/collections" class={currentPage === '/admin/collections' ? 'selected' : ''}
					>Collections</a
				>
				<a href="/admin/artworks" class={currentPage === '/admin/artworks' ? 'selected' : ''}
					>Artworks</a
				>
				<a href="/admin/import" class={currentPage === '/admin/import' ? 'selected' : ''}
					>Import NFTs</a
				>
			</div>

			<form action="/logout" method="POST">
				<button type="submit">Log out</button>
			</form>
		</nav>
	</div>
	<div class="ui-content">
		<slot />
	</div>
</div>

<SvelteToast />

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
			@apply text-gray-800 font-normal px-2 py-3 m-0 mx-1 transition duration-300 ease-in-out decoration-2 underline-offset-8 underline decoration-transparent;
			font-variation-settings: initial;
		}

		.selected {
			@apply decoration-primary;
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

		h1 button {
			@apply align-middle text-sm border border-gray-400 text-gray-600 ml-4 mt-0 px-2 py-1 rounded-sm hover:bg-primary hover:border-primary hover:text-white;
		}

		.back-btn {
			@apply inline-block px-2 py-1 mb-6 uppercase text-sm border border-transparent rounded-sm text-gray-500 hover:text-primary hover:border-primary font-semibold no-underline transition duration-300 ease-in-out;
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

			&.sortable {
				@apply cursor-pointer text-blue-600 hover:text-blue-800;
			}
		}

		td div {
			@apply text-left w-full max-w-[220px] truncate;
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

		.actions {
			@apply max-w-[10px];
		}

		.edit {
			@apply text-primary border-2 border-primary hover:bg-primary hover:text-white hover:no-underline rounded-sm text-sm uppercase no-underline font-bold px-3 py-2 m-0 mx-1;
		}

		.search {
			@apply w-full float-right text-lg px-4 py-3 mb-8 rounded-sm border border-gray-300;
		}

		.artwork {
			@apply w-24;
		}

		.file-uploader {
			@apply grid grid-cols-1 content-center justify-center bg-gray-200 border-2 border-dashed border-gray-300 rounded-sm p-6 aspect-square;

			input {
				@apply w-auto align-middle mx-auto border border-gray-500 border-dashed;
			}

			label {
				@apply text-center text-gray-500 italic text-sm;
			}
		}

		label,
		input,
		select,
		textarea {
			@apply block mb-4 w-full p-3;
		}

		label {
			@apply px-0 mb-0 font-semibold;
		}

		textarea {
			@apply h-32;
		}

		.cta {
			@apply inline-block w-[100%] mt-2 px-4 py-3 bg-primary rounded-sm text-white font-semibold;

			&.delete {
				@apply bg-red-500;
			}
		}

		.error {
			color: red;
		}

		.additional-meta {
			@apply py-4 px-8 bg-gray-200 border rounded-md text-sm;
		}

		.non-editable {
			@apply my-3;

			label {
				@apply m-0 p-0 font-bold;
			}

			p {
				@apply m-0;
			}
		}
	}
</style>
