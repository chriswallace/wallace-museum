<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

	export let data: { artist?: any; error?: string };

	// Modal state for description
	let isDescriptionModalOpen = false;

	// Character limit for truncating descriptions
	const DESCRIPTION_LIMIT = 200;

	function formatDate(dateStr: string | Date | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}

	function formatSocialHandle(handle: string | null): string {
		if (!handle) return '';
		return handle.startsWith('@') ? handle : `@${handle}`;
	}

	function parseWalletAddresses(addresses: any): Array<{blockchain: string, address: string}> {
		if (!addresses) return [];
		if (Array.isArray(addresses)) return addresses;
		try {
			const parsed = JSON.parse(addresses);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	function parseSocialLinks(links: any): Record<string, string> {
		if (!links) return {};
		if (typeof links === 'object') return links;
		try {
			const parsed = JSON.parse(links);
			return typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}

	// New utility functions for wallet display
	function formatWalletAddress(address: string): string {
		if (!address || address.length <= 10) return address;
		return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
	}

	function getProfileUrl(address: string, blockchain: string): string {
		if (blockchain.toLowerCase() === 'tezos') {
			return `https://objkt.com/profile/${address}`;
		} else if (blockchain.toLowerCase() === 'ethereum') {
			return `https://opensea.io/${address}`;
		}
		return '';
	}

	function getChainIcon(blockchain: string): string {
		if (blockchain.toLowerCase() === 'tezos') {
			return 'tezos';
		} else if (blockchain.toLowerCase() === 'ethereum') {
			return 'ethereum';
		}
		return 'unknown';
	}

	function shouldTruncateDescription(description: string | null): boolean {
		return description ? description.length > DESCRIPTION_LIMIT : false;
	}

	function getTruncatedDescription(description: string | null): string {
		if (!description) return '';
		if (description.length <= DESCRIPTION_LIMIT) return description;
		return description.substring(0, DESCRIPTION_LIMIT).trim() + '...';
	}

	function openDescriptionModal() {
		isDescriptionModalOpen = true;
	}

	function closeDescriptionModal() {
		isDescriptionModalOpen = false;
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeDescriptionModal();
		}
	}

	function handleModalBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDescriptionModal();
		}
	}

	// Disable body scroll when modal is open
	$: if (typeof document !== 'undefined') {
		if (isDescriptionModalOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	// Clean up on component destroy
	onMount(() => {
		return () => {
			if (typeof document !== 'undefined') {
				document.body.style.overflow = '';
			}
		};
	});

	$: pageTitle = data.artist
		? `${data.artist.name} | Wallace Museum`
		: data.error
			? 'Artist Not Found | Wallace Museum'
			: 'Loading Artist | Wallace Museum';

	$: walletAddresses = data.artist ? parseWalletAddresses(data.artist.walletAddresses) : [];
	$: socialLinks = data.artist ? parseSocialLinks(data.artist.socialLinks) : {};

	// Get the primary description (bio or description)
	$: primaryDescription = data.artist?.bio || data.artist?.description || '';
	$: shouldShowReadMore = shouldTruncateDescription(primaryDescription);
	$: truncatedDescription = getTruncatedDescription(primaryDescription);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content={data.artist
			? `${data.artist.name} - ${data.artist.bio || 'Digital artist at the Wallace Museum'}`
			: 'Artist profile at the Wallace Museum'}
	/>
</svelte:head>

{#if !data.artist && data.error}
	<div class="page-container" transition:fade>
		<div class="error-container">
			<button class="close-button" on:click={() => goto('/')} aria-label="Return to homepage">×</button>
			<h2>Artist Not Found</h2>
			<p>{data.error}</p>
			<button class="return-button" on:click={() => goto('/')}>Return to Gallery</button>
		</div>
	</div>
{:else if !data.artist}
	<div class="page-container" transition:fade>
		<div class="loading-container">
			<div class="loader" />
			<p>Loading artist profile...</p>
		</div>
	</div>
{:else}
	<div class="page-container" transition:fade>
		<!-- Header Navigation -->
		<header class="header-nav">
			<button class="museum-link" on:click={() => goto('/')} aria-label="Return to homepage">
				The Wallace Museum
			</button>
		</header>

		<button class="close-button" on:click={() => goto('/')} aria-label="Return to homepage">×</button>

		<div class="content-container">
			<div class="layout-grid">
				<!-- Left Column - Artist Details -->
				<aside class="artist-sidebar">
					<div class="artist-header">
						{#if data.artist.avatarUrl}
							<div class="avatar-container">
								<OptimizedImage
									src={data.artist.avatarUrl}
									alt={data.artist.name}
									width={120}
									height={120}
									fit="crop"
									gravity="auto"
									format="webp"
									quality={90}
									className="artist-avatar"
									fallbackSrc="/images/medici-image.png"
								/>
							</div>
						{/if}

						<div class="artist-title">
							<h1>
								{data.artist.displayName || data.artist.name}
								{#if data.artist.isVerified}
									<span class="verification-badge" title="Verified Artist">✓</span>
								{/if}
							</h1>
							{#if data.artist.ensName}
								<p class="ens-name">{data.artist.ensName}</p>
							{/if}
						</div>
						{#if primaryDescription}
							<div class="bio-section">
								<p>{shouldShowReadMore ? truncatedDescription : primaryDescription}</p>
								{#if shouldShowReadMore}
									<button 
										class="read-more-button"
										on:click={openDescriptionModal}
									>
										Read more
									</button>
								{/if}
							</div>
						{/if}
						{#if data.artist.description && data.artist.description !== data.artist.bio && !primaryDescription.includes(data.artist.description)}
							<div class="description-section">
								<p>{data.artist.description}</p>
							</div>
						{/if}
					</div>

					<!-- Social Links -->
					{#if data.artist.websiteUrl || data.artist.twitterHandle || data.artist.instagramHandle || data.artist.profileUrl}
						<div class="detail-section">
							<h3>Links</h3>
							<ul class="links-list">
								{#if data.artist.websiteUrl}
									<li><a href={data.artist.websiteUrl} target="_blank" rel="noopener noreferrer">Website</a></li>
								{/if}
								{#if data.artist.twitterHandle}
									<li><a href={data.artist.twitterHandle} target="_blank" rel="noopener noreferrer">Twitter</a></li>
								{/if}
								{#if data.artist.instagramHandle}
									<li><a href={`https://instagram.com/${data.artist.instagramHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer">Instagram {formatSocialHandle(data.artist.instagramHandle)}</a></li>
								{/if}
								{#if data.artist.profileUrl}
									<li><a href={data.artist.profileUrl} target="_blank" rel="noopener noreferrer">Profile</a></li>
								{/if}
							</ul>
						</div>
					{/if}

					<!-- Wallet Addresses -->
					{#if walletAddresses.length > 0}
						<div class="detail-section">
							<h3>Wallets</h3>
							<ul class="wallets-list">
								{#each walletAddresses as wallet}
									<li class="wallet-item">
										<div class="wallet-info">
											<div class="chain-icon">
												{#if getChainIcon(wallet.blockchain) === 'ethereum'}
													<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
														<path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
													</svg>
												{:else if getChainIcon(wallet.blockchain) === 'tezos'}
													<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
														<path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.066 9.645c.183 4.04-2.83 8.544-8.164 8.544-5.334 0-9.92-4.504-9.737-8.544C.348 5.645 5.718 3.321 12 3.321s11.652 2.324 6.066 6.324z"/>
													</svg>
												{:else}
													<div class="unknown-chain"></div>
												{/if}
											</div>
											<code class="wallet-address">{formatWalletAddress(wallet.address)}</code>
										</div>
										{#if getProfileUrl(wallet.address, wallet.blockchain)}
											<a
												href={getProfileUrl(wallet.address, wallet.blockchain)}
												target="_blank"
												rel="noopener noreferrer"
												class="profile-link"
											>
												View
											</a>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</aside>

				<!-- Right Column - Artworks -->
				<main class="artworks-main">
					{#if data.artist.artworks && data.artist.artworks.length > 0}
						<div class="artworks-header">
							<h2>Artworks ({data.artist.artworks.length})</h2>
						</div>
						<div class="artworks-grid">
							{#each data.artist.artworks as artwork}
								<button class="artwork-container" on:click={() => goto(`/artist/${data.artist.id}/${artwork.id}`)}>
									<div class="artwork-thumbnail">
										{#if artwork.image_url}
											<OptimizedImage
												src={artwork.image_url}
												alt={artwork.title}
												width={800}
												height={800}
												fit="contain"
												format="webp"
												quality={70}
												className="thumbnail-image"
												fallbackSrc="/images/medici-image.png"
											/>
										{:else}
											<div class="thumbnail-placeholder">
												<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
													<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
												</svg>
											</div>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{:else}
						<div class="no-artworks">
							<p>No artworks available for this artist.</p>
						</div>
					{/if}
				</main>
			</div>
		</div>
	</div>
{/if}

<!-- Description Modal -->
{#if isDescriptionModalOpen}
	<div 
		class="modal-backdrop"
		on:click={handleModalBackdropClick}
		on:keydown={handleModalKeydown}
		transition:fade={{ duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-artist-name"
		tabindex="-1"
	>
		<div 
			class="modal-content"
			transition:scale={{ duration: 300, easing: quintOut, start: 0.9 }}
		>
			<!-- Close Button -->
			<button 
				class="modal-close-button"
				on:click={closeDescriptionModal}
				aria-label="Close description"
			>
				×
			</button>

			<!-- Modal Content -->
			<div class="modal-scroll">
				<!-- Artist Header -->
				<div class="modal-artist-header">
					{#if data.artist.avatarUrl}
						<div class="modal-avatar-container">
							<OptimizedImage
								src={data.artist.avatarUrl}
								alt={data.artist.name}
								width={120}
								height={120}
								fit="crop"
								gravity="auto"
								format="webp"
								quality={90}
								className="modal-artist-avatar"
								fallbackSrc="/images/medici-image.png"
							/>
						</div>
					{/if}
					<h2 id="modal-artist-name" class="modal-artist-name">{data.artist.displayName || data.artist.name}</h2>
				</div>

				<!-- Full Description -->
				<div class="modal-description">
					<p>{primaryDescription}</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.page-container {
		@apply min-h-screen bg-white text-black;
	}

	.header-nav {
		@apply p-4;
	}

	.museum-link {
		@apply text-sm font-medium text-gray-600 hover:text-black bg-transparent border-none cursor-pointer transition-colors duration-200;
	}

	.close-button {
		@apply text-2xl text-gray-400 hover:text-black bg-transparent border-none cursor-pointer absolute top-4 right-4 z-50 transition-colors duration-200;
	}

	.content-container {
		@apply w-full px-4;
	}

	.layout-grid {
		@apply flex flex-col lg:flex-row;
	}

	.artist-sidebar {
		@apply w-full lg:w-80 lg:flex-shrink-0 space-y-6 py-8;
	}

	.artist-header {
		@apply flex flex-col items-start text-left gap-4 mb-0;
	}

	.avatar-container {
		@apply w-16 h-16 rounded-sm overflow-hidden flex-shrink-0;
	}

	.artist-avatar {
		@apply w-full h-full object-cover;
	}

	.artist-title h1 {
		@apply text-base font-semibold mb-0;
	}

	.verification-badge {
		@apply text-blue-600 ml-1 text-sm;
	}

	.ens-name {
		@apply text-gray-600 text-xs;
	}

	.bio-section,
	.description-section {
		@apply mb-4;
	}

	.bio-section p {
		@apply mt-0 text-sm leading-relaxed;
	}

	.read-more-button {
		@apply text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-transparent border-none cursor-pointer mt-2 transition-colors duration-200;
		text-decoration: underline;
	}

	.description-section p {
		@apply mt-0 text-xs text-gray-700 leading-relaxed;
	}

	.detail-section {
		@apply mb-4;
	}

	.detail-section h3 {
		@apply text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2;
	}

	.links-list,
	.wallets-list {
		@apply list-none p-0 space-y-1;
	}

	.links-list a {
		@apply text-black/60 hover:text-black text-xs transition-colors duration-200;
		text-decoration: none;
	}

	.wallets-list {
		@apply list-none p-0 space-y-1;
	}

	.wallet-item {
		@apply flex items-center justify-between text-xs;
	}

	.wallet-info {
		@apply flex items-center gap-2;
	}

	.chain-icon {
		@apply w-4 h-4 text-gray-600;
	}

	.wallet-address {
		@apply text-xs font-mono bg-gray-100 px-2 py-1 rounded-sm;
	}

	.profile-link {
		@apply text-black/60 hover:text-black text-xs transition-colors duration-200;
		text-decoration: none;
	}

	.unknown-chain {
		@apply w-4 h-4 bg-gray-300 rounded-sm;
	}

	.artworks-main {
		@apply flex-1 min-h-0;
		@apply px-0 lg:px-8 py-0 lg:py-8;
	}

	.artworks-header {
		@apply px-6 lg:px-0 mb-6 pt-8 lg:pt-0;
	}

	.artworks-header h2 {
		@apply text-2xl font-bold;
	}

	.artworks-grid {
		@apply grid gap-0 lg:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4;
	}

	.artwork-container {
		@apply cursor-pointer bg-transparent border-none p-0 w-full;
	}

	.artwork-thumbnail {
		@apply aspect-square bg-gray-50 overflow-hidden rounded-sm flex items-center justify-center;
	}

	.thumbnail-image {
		@apply w-full h-full object-cover;
	}

	.thumbnail-placeholder {
		@apply w-full h-full flex items-center justify-center;
	}

	.placeholder-icon {
		@apply w-8 h-8 text-gray-400;
	}

	.no-artworks {
		@apply flex items-center justify-center h-64 text-gray-500;
	}

	.error-container,
	.loading-container {
		@apply flex flex-col items-center justify-center min-h-screen p-8;
	}

	.return-button {
		@apply px-4 py-2 bg-black text-white font-medium hover:bg-gray-800 transition-colors duration-200;
	}

	.loader {
		@apply w-8 h-8 border-2 border-gray-300 border-t-black rounded-full;
		animation: spin 1s linear infinite;
	}

	/* Modal Styles */
	.modal-backdrop {
		@apply fixed inset-0 z-50 flex items-center justify-center p-4;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
	}

	.modal-content {
		@apply relative bg-white dark:bg-black rounded-sm shadow-2xl max-w-[600px];
		width: 100%;
		max-height: 82svh;
	}

	.modal-close-button {
		@apply absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-transparent border-none cursor-pointer rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;
		font-size: 20px;
		z-index: 10;
	}

	.modal-scroll {
		@apply overflow-y-auto p-6;
		max-height: calc(82svh - 2rem);
	}

	.modal-artist-header {
		@apply flex flex-col items-center text-center mb-6;
	}

	.modal-avatar-container {
		@apply mb-4 w-24 h-24 rounded-sm overflow-hidden flex-shrink-0;
	}

	.modal-artist-avatar {
		@apply w-full h-full object-cover;
	}

	.modal-artist-name {
		@apply text-2xl font-bold text-gray-900 dark:text-white m-0;
	}

	.modal-description {
		@apply text-gray-700 dark:text-gray-300 leading-relaxed;
	}

	.modal-description p {
		@apply text-base leading-relaxed m-0;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.page-container {
			@apply bg-black text-white;
		}

		.header-nav {
			@apply border-gray-800;
		}

		.artist-sidebar {
			@apply border-gray-800;
		}

		.museum-link {
			@apply text-gray-400 hover:text-white;
		}

		.close-button {
			@apply text-gray-400 hover:text-white;
		}

		.ens-name {
			@apply text-gray-400;
		}

		.description-section p {
			@apply text-gray-300;
		}

		.detail-section h3 {
			@apply text-gray-400;
		}

		.links-list a {
			@apply text-white/60 hover:text-white;
		}

		.chain-icon {
			@apply text-gray-400;
		}

		.wallet-address {
			@apply bg-gray-800 text-gray-300;
		}

		.profile-link {
			@apply text-white/60 hover:text-white;
		}

		.unknown-chain {
			@apply bg-gray-700;
		}

		.artwork-thumbnail {
			@apply bg-gray-900;
		}

		.no-artworks {
			@apply text-gray-400;
		}

		.return-button {
			@apply bg-white text-black hover:bg-gray-200;
		}

		.loader {
			@apply border-gray-700 border-t-white;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.modal-content {
			margin: 1rem;
			max-width: calc(100vw - 2rem);
		}
		
		.modal-scroll {
			@apply p-4;
		}
	}
</style>
