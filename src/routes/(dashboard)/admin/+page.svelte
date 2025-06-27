<script>
	import { showToast } from '$lib/toastHelper';

	function showDemoToast() {
		showToast('Welcome to your new admin interface!', 'success');
	}
</script>

<svelte:head>
	<title>Dashboard | Wallace Museum Admin</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">Welcome to your redesigned admin interface</p>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
		<!-- Collections Card -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Collections</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">Manage Collections</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 dark:bg-gray-700 px-5 py-3">
				<div class="text-sm">
					<a href="/admin/collections" class="font-medium text-blue-600 hover:text-blue-500">View all collections</a>
				</div>
			</div>
		</div>

		<!-- Artworks Card -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Artworks</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">Manage Artworks</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 dark:bg-gray-700 px-5 py-3">
				<div class="text-sm">
					<a href="/admin/artworks" class="font-medium text-green-600 hover:text-green-500">View all artworks</a>
				</div>
			</div>
		</div>

		<!-- Artists Card -->
		<div class="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
			<div class="p-5">
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<svg class="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
						</svg>
					</div>
					<div class="ml-5 w-0 flex-1">
						<dl>
							<dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Artists</dt>
							<dd class="text-lg font-medium text-gray-900 dark:text-white">Manage Artists</dd>
						</dl>
					</div>
				</div>
			</div>
			<div class="bg-gray-50 dark:bg-gray-700 px-5 py-3">
				<div class="text-sm">
					<a href="/admin/artists" class="font-medium text-purple-600 hover:text-purple-500">View all artists</a>
				</div>
			</div>
		</div>
	</div>

	<!-- New Interface Features -->
	<div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">New Interface Features</h2>
		<div class="space-y-4">
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-gray-700 dark:text-gray-300"><strong>Left sidebar navigation</strong> - Modern web app feel with persistent navigation</p>
				</div>
			</div>
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-gray-700 dark:text-gray-300"><strong>Mobile-optimized</strong> - Tap to open sidebar menu on mobile devices</p>
				</div>
			</div>
			<div class="flex items-start">
				<div class="flex-shrink-0">
					<svg class="h-5 w-5 text-green-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
						<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
					</svg>
				</div>
				<div class="ml-3">
					<p class="text-gray-700 dark:text-gray-300"><strong>Improved notifications</strong> - Clean, cohesive toast styling like Tailwind UI</p>
				</div>
			</div>
		</div>
		
		<div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
			<button 
				on:click={showDemoToast}
				class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
			>
				<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				Test New Toast Style
			</button>
		</div>
	</div>
</div>

<style lang="scss">
	h1 {
		@apply mb-12;
	}
</style>
