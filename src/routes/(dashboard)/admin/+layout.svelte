<script lang="ts">
	import { page } from '$app/stores';
	import { SvelteToast } from '@zerodevx/svelte-toast';

	let currentPage;

	page.subscribe(($page) => {
		currentPage = $page.url.pathname;
	});

	import '../../../admin.css';
</script>

<div class="ui-frame">
	<div class="ui-header">
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
			@apply text-gray-800 font-normal px-2 py-3 transition duration-300 ease-in-out decoration-2 underline-offset-8 underline decoration-transparent;
			font-variation-settings: initial;
		}

		.selected {
			@apply decoration-primary;
		}
	}

	.ui-content {
		@apply w-full max-w-[1600px] col-span-1 md:col-span-3 p-6 mx-auto;
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
			@apply align-middle text-sm border border-gray-400 text-gray-600 ml-4 px-2 py-1 rounded-sm hover:bg-primary hover:border-primary hover:text-white;
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
			@apply bg-gray-100;
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

		tr td {
			@apply transition duration-200 ease-in-out;
		}

		td button {
			@apply block hover:underline;
		}

		.image {
			@apply p-0 w-12 h-12 m-0;
		}

		.actions {
			@apply max-w-[10px];
		}

		.edit {
			@apply text-primary border-2 border-primary hover:bg-primary hover:text-white hover:no-underline rounded-sm text-sm uppercase no-underline font-bold px-3 py-2 m-0 mx-1;
		}

		.flex-table {
			width: 100%;
			border-collapse: collapse; /* Clean up table borders */

			thead {
				/* Ensures the header is not scrollable */
				display: table;
				width: 100%;
				table-layout: fixed;
			}

			tbody {
				display: block;
				max-height: 400px; /* Adjust based on your needs */
				overflow-y: auto;
				width: 100%;
			}

			tr {
				width: 100%;
				display: table;
			}

			th,
			td {
				border: 1px solid #ddd;
				text-align: left;
				padding: 3px 8px; /* Adjust padding for visual appeal */
			}

			th:first-child,
			td:first-child {
				width: 35%;
			}

			th:nth-child(2),
			td:nth-child(2) {
				width: 40%;
			}

			th:last-child,
			td:last-child {
				width: 25%;
			}

			th {
				position: sticky;
				top: 0; /* Keeps the header on top */
				background-color: #f9f9f9; /* Gives a different color to distinguish the header */
			}

			button {
				display: inline-block;
			}
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

		.empty {
			@apply text-center pt-12 border-t-2 border-gray-200;

			p {
				@apply text-center mx-auto;
			}
		}
	}
</style>
