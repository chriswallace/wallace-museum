<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import { getTwitterUrl, getInstagramUrl, formatSocialHandle } from '$lib/utils/socialMediaUtils';
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
		return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
	}

	function getProfileUrl(address: string, blockchain: string): string {
		if (blockchain.toLowerCase() === 'tezos') {
			return `https://objkt.com/profile/${address}`;
		} else if (blockchain.toLowerCase() === 'ethereum') {
			return `https://opensea.io/${address}`;
		}
		return '';
	}

	function getProfileLinkText(blockchain: string): string {
		if (blockchain.toLowerCase() === 'tezos') {
			return 'Objkt.com Profile';
		} else if (blockchain.toLowerCase() === 'ethereum') {
			return 'OpenSea Profile';
		}
		return 'View Profile';
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

	// Get the primary description (bio or description as fallback)
	$: primaryDescription = data.artist?.bio || data.artist?.description || '';
	$: shouldShowReadMore = shouldTruncateDescription(primaryDescription);
	$: truncatedDescription = getTruncatedDescription(primaryDescription);

	// SEO constants
	$: siteUrl = 'https://wallace-collection.vercel.app'; // Update this to your actual domain
	$: artistImageUrl = data.artist?.avatarUrl || `${siteUrl}/images/wallace-museum.png`;
	$: artistDescription = data.artist 
		? `${data.artist.name} - ${primaryDescription || 'Digital artist at the Wallace Museum showcasing innovative computational and algorithmic art.'}`
		: 'Artist profile at the Wallace Museum';
	$: artworkCount = data.artist?.artworks?.length || 0;
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{pageTitle}</title>
	<meta name="title" content={pageTitle} />
	<meta name="description" content={artistDescription} />
	<meta name="keywords" content="digital artist, {data.artist?.name || 'artist'}, computational art, generative art, algorithmic art, NFT artist, Wallace Museum" />
	<meta name="author" content="Chris Wallace" />
	<meta name="robots" content="index, follow" />
	{#if data.artist}
		<link rel="canonical" href="{siteUrl}/artist/{data.artist.id}" />
	{/if}

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="profile" />
	{#if data.artist}
		<meta property="og:url" content="{siteUrl}/artist/{data.artist.id}" />
	{/if}
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={artistDescription} />
	<meta property="og:image" content={artistImageUrl} />
	<meta property="og:image:width" content="400" />
	<meta property="og:image:height" content="400" />
	<meta property="og:image:alt" content="{data.artist?.name || 'Artist'} - Wallace Museum" />
	<meta property="og:site_name" content="Wallace Museum" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary" />
	{#if data.artist}
		<meta property="twitter:url" content="{siteUrl}/artist/{data.artist.id}" />
	{/if}
	<meta property="twitter:title" content={pageTitle} />
	<meta property="twitter:description" content={artistDescription} />
	<meta property="twitter:image" content={artistImageUrl} />
	<meta property="twitter:image:alt" content="{data.artist?.name || 'Artist'} - Wallace Museum" />
	<meta property="twitter:site" content="@chriswallace" />
	<meta property="twitter:creator" content="@chriswallace" />

	<!-- Structured Data (JSON-LD) -->
	{#if data.artist}
		<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "Person",
				"name": "{data.artist.name}",
				"description": "{primaryDescription || 'Digital artist showcasing innovative computational and algorithmic art'}",
				"url": "{siteUrl}/artist/{data.artist.id}",
				{#if data.artist.avatarUrl}
				"image": "{data.artist.avatarUrl}",
				{/if}
				{#if data.artist.websiteUrl}
				"mainEntityOfPage": "{data.artist.websiteUrl}",
				{/if}
				"jobTitle": "Digital Artist",
				"worksFor": {
					"@type": "Organization",
					"name": "Wallace Museum",
					"url": "{siteUrl}"
				},
				{#if data.artist.twitterHandle || data.artist.instagramHandle || data.artist.websiteUrl}
				"sameAs": [
					{#if data.artist.twitterHandle}
					"https://twitter.com/{data.artist.twitterHandle.replace('@', '')}",
					{/if}
					{#if data.artist.instagramHandle}
					"https://instagram.com/{data.artist.instagramHandle.replace('@', '')}",
					{/if}
					{#if data.artist.websiteUrl}
					"{data.artist.websiteUrl}"
					{/if}
				],
				{/if}
				"hasOfferCatalog": {
					"@type": "OfferCatalog",
					"name": "Artworks by {data.artist.name}",
					"numberOfItems": {artworkCount}
				}
			}
		</script>
	{/if}
</svelte:head>

{#if !data.artist && data.error}
	<div class="page-container" transition:fade>
		<div class="error-container">
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
									format="auto"
									quality={90}
									className="artist-avatar"
									fallbackSrc="/images/medici-image.png"
								/>
							</div>
						{/if}

						<div class="artist-title">
							<h1>
								{data.artist.name}{#if data.artist.displayName && data.artist.displayName !== data.artist.name}&nbsp;<span class="display-name">{data.artist.displayName}</span>{/if}
							</h1>
						</div>
						{#if primaryDescription}
							<div class="bio-section">
								<p>
									{shouldShowReadMore ? truncatedDescription : primaryDescription}
									{#if shouldShowReadMore}
										<button 
											class="read-more-button"
											on:click={openDescriptionModal}
										>
											Read more
										</button>
									{/if}
								</p>
							</div>
						{/if}
						<!-- Social Icons -->
						{#if data.artist.websiteUrl || data.artist.twitterHandle || data.artist.instagramHandle}
							<div class="social-icons">
								{#if data.artist.websiteUrl}
									<a href={data.artist.websiteUrl} target="_blank" rel="noopener noreferrer" class="social-icon-button" title="Website">
										<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.875" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
									</a>
								{/if}
								{#if data.artist.twitterHandle}
									<a href={getTwitterUrl(data.artist.twitterHandle)} target="_blank" rel="noopener noreferrer" class="social-icon-button" title="Twitter/X">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
											<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
										</svg>
									</a>
								{/if}
								{#if data.artist.instagramHandle}
									<a href={getInstagramUrl(data.artist.instagramHandle)} target="_blank" rel="noopener noreferrer" class="social-icon-button" title="Instagram">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
											<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
										</svg>
									</a>
								{/if}
							</div>
						{/if}
					</div>

					<div class="detail-sections-grid">
						<!-- Wallets -->
						{#if data.artist.profileUrl || walletAddresses.length > 0}
							<div class="detail-section">
								<h3>Known Wallets</h3>
								<div class="links-combined">									
									<!-- Wallet Addresses -->
									{#each walletAddresses as wallet}
										{#if getProfileUrl(wallet.address, wallet.blockchain)}
											<a
												href={getProfileUrl(wallet.address, wallet.blockchain)}
												target="_blank"
												rel="noopener noreferrer"
												class="wallet-link"
												title={getProfileLinkText(wallet.blockchain)}
											>
												<div class="wallet-item">
													<div class="wallet-info">
														<div class="chain-icon">
															{#if getChainIcon(wallet.blockchain) === 'ethereum'}
																<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
																	<path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
																</svg>
															{:else if getChainIcon(wallet.blockchain) === 'tezos'}
																<svg height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1169.87 1593" fill="currentColor"><g id="Layer_2" data-name="Layer 2"><path d="M755.68,1593q-170.51,0-248.91-82.14a253.6,253.6,0,0,1-78.15-177,117.39,117.39,0,0,1,13.69-58.5A101.21,101.21,0,0,1,479.64,1238a130.22,130.22,0,0,1,116.24,0A99.55,99.55,0,0,1,633,1275.36a115,115,0,0,1,14.18,58.5,111.73,111.73,0,0,1-19.91,68.45a92.78,92.78,0,0,1-47.31,34.62,129.18,129.18,0,0,0,74.67,46.55,370,370,0,0,0,101.8,14.68,226.91,226.91,0,0,0,128.19-38.33,224,224,0,0,0,83.63-113.25,492,492,0,0,0,27.38-169.5,465.07,465.07,0,0,0-29.87-176.23,217.54,217.54,0,0,0-86.37-109.52,229.68,229.68,0,0,0-124.43-35.59,236.75,236.75,0,0,0-107.78,36.59L567.26,932.4V892.33L926.43,410.5H428.62v500A178.9,178.9,0,0,0,456,1012.8a94.34,94.34,0,0,0,83.63,40.07a139.85,139.85,0,0,0,82.63-29.12,298.38,298.38,0,0,0,69.2-71.19a24.86,24.86,0,0,1,9-11.94,18.4,18.4,0,0,1,12-4.48a41.55,41.55,0,0,1,23.4,9.95,49.82,49.82,0,0,1,12.69,33.85a197.86,197.86,0,0,1-4.48,24.89a241,241,0,0,1-85.38,106,211.78,211.78,0,0,1-119.76,36.38q-161.67,0-224-63.72A238.67,238.67,0,0,1,253.2,909.25V410.5H0V317.6H254.38V105.78L196.14,47.5V0h169l63.48,32.86V317.6l657.6-2,65.47,65.71L748.46,786.5a271,271,0,0,1,76.16-18.42A330.1,330.1,0,0,1,972,810.15a302.7,302.7,0,0,1,126.95,113.29a399.78,399.78,0,0,1,57.25,136.65a575.65,575.65,0,0,1,13.69,117,489.39,489.39,0,0,1-49.78,216.79a317.92,317.92,0,0,1-149.35,149.35A483.27,483.27,0,0,1,755.68,1593Z"/></g></svg>
															{:else}
																<div class="unknown-chain"></div>
															{/if}
														</div>
														<code class="wallet-address">{formatWalletAddress(wallet.address)}</code>
													</div>
												</div>
											</a>
										{:else}
											<div class="wallet-item">
												<div class="wallet-info">
													<div class="chain-icon">
														{#if getChainIcon(wallet.blockchain) === 'ethereum'}
															<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
																<path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
															</svg>
														{:else if getChainIcon(wallet.blockchain) === 'tezos'}
															<svg height="16" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1169.87 1593" fill="currentColor"><g id="Layer_2" data-name="Layer 2"><path d="M755.68,1593q-170.51,0-248.91-82.14a253.6,253.6,0,0,1-78.15-177,117.39,117.39,0,0,1,13.69-58.5A101.21,101.21,0,0,1,479.64,1238a130.22,130.22,0,0,1,116.24,0A99.55,99.55,0,0,1,633,1275.36a115,115,0,0,1,14.18,58.5,111.73,111.73,0,0,1-19.91,68.45a92.78,92.78,0,0,1-47.31,34.62,129.18,129.18,0,0,0,74.67,46.55,370,370,0,0,0,101.8,14.68,226.91,226.91,0,0,0,128.19-38.33a224,224,0,0,0,83.63-113.25a492,492,0,0,0,27.38-169.5,465.07,465.07,0,0,0-29.87-176.23,217.54,217.54,0,0,0-86.37-109.52,229.68,229.68,0,0,0-124.43-35.59a236.75,236.75,0,0,0-107.78,36.59L567.26,932.4V892.33L926.43,410.5H428.62v500A178.9,178.9,0,0,0,456,1012.8a94.34,94.34,0,0,0,83.63,40.07a139.85,139.85,0,0,0,82.63-29.12a298.38,298.38,0,0,0,69.2-71.19a24.86,24.86,0,0,1,9-11.94,18.4,18.4,0,0,1,12-4.48a41.55,41.55,0,0,1,23.4,9.95,49.82,49.82,0,0,1,12.69,33.85a197.86,197.86,0,0,1-4.48,24.89a241,241,0,0,1-85.38,106,211.78,211.78,0,0,1-119.76,36.38q-161.67,0-224-63.72A238.67,238.67,0,0,1,253.2,909.25V410.5H0V317.6H254.38V105.78L196.14,47.5V0h169l63.48,32.86V317.6l657.6-2,65.47,65.71L748.46,786.5a271,271,0,0,1,76.16-18.42A330.1,330.1,0,0,1,972,810.15a302.7,302.7,0,0,1,126.95,113.29a399.78,399.78,0,0,1,57.25,136.65a575.65,575.65,0,0,1,13.69,117,489.39,489.39,0,0,1-49.78,216.79a317.92,317.92,0,0,1-149.35,149.35A483.27,483.27,0,0,1,755.68,1593Z"/></g></svg>
															{:else}
																<div class="unknown-chain"></div>
															{/if}
													</div>
													<code class="wallet-address">{formatWalletAddress(wallet.address)}</code>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>
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
												format="auto"
												quality={70}
												className="thumbnail-image"
												fallbackSrc="/images/medici-image.png"
												mimeType={artwork.mime}
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
	<button 
		class="modal-backdrop"
		on:click={handleModalBackdropClick}
		on:keydown={handleModalKeydown}
		transition:fade={{ duration: 200 }}
		aria-label="Close modal"
	>
		<div 
			class="modal-content"
			transition:scale={{ duration: 300, easing: quintOut, start: 0.9 }}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-artist-name"
		>
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
								format="auto"
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
	</button>
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
		@apply flex flex-col md:flex-row md:mb-12;
	}

	.artist-sidebar {
		@apply w-full md:w-60 lg:w-80 md:flex-shrink-0 space-y-6 py-8;
	}

	.artist-header {
		@apply flex flex-col items-center text-center gap-2 md:gap-4 mb-0;
		@apply sm:items-start sm:text-left;
	}

	.artist-title {
		@apply flex flex-col items-center gap-2;
		@apply sm:items-start;
	}

	.social-icons {
		@apply flex items-center justify-center gap-3 mt-3;
		@apply sm:justify-start;
	}

	.avatar-container {
		@apply w-16 h-16 rounded-sm overflow-hidden flex-shrink-0 mb-2 lg:mb-0;
	}

	.artist-avatar {
		@apply w-full h-full object-cover;
	}

	.artist-title h1 {
		@apply text-lg font-semibold mb-0 lg:inline;
	}

	.display-name {
		@apply text-gray-500;
	}

	.verification-badge {
		@apply text-blue-600 ml-1 text-sm;
	}

	.ens-name {
		@apply text-gray-400;
	}

	.description-section {
		@apply mb-4;
	}

	.bio-section p {
		@apply text-sm text-gray-900 leading-snug mb-3;
	}

	.read-more-button {
		@apply bg-transparent border-none text-red-500 cursor-pointer text-sm p-0 underline;
		@apply hover:text-red-500/80 transition-colors duration-200;
		@apply inline ml-1;
	}

	.description-section p {
		@apply mt-0 text-xs text-gray-300 leading-relaxed;
	}

	.detail-section {
		@apply mb-4 text-center sm:text-left;
	}

	.detail-section h3 {
		@apply text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2;
	}

	.links-combined {
		@apply flex flex-wrap justify-center gap-2 sm:justify-start;
	}

	.link-item {
		@apply flex items-center gap-2 text-black/60 hover:text-black text-xs transition-colors duration-200;
		text-decoration: none;
	}

	.link-icon {
		@apply w-4 h-4 text-gray-600;
	}

	.wallet-item {
		@apply flex items-center text-xs;
	}

	.wallet-link {
		@apply text-black/60 hover:text-black text-xs transition-colors duration-200;
		text-decoration: none;
	}

	.wallet-info {
		@apply flex items-center gap-2;
	}

	.chain-icon {
		@apply w-4 h-4 text-gray-600;
	}

	.wallet-address {
		@apply text-xs font-mono bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-sm transition-colors duration-200;
	}

	.unknown-chain {
		@apply w-4 h-4 bg-gray-300 rounded-sm;
	}

	.artworks-main {
		@apply flex-1 min-h-0;
		@apply px-0 md:px-8 py-0 lg:py-8;
	}

	.artworks-header {
		@apply lg:px-0 mb-6 md:pt-8 lg:pt-0;
	}

	.artworks-header h2 {
		@apply text-lg font-bold;
	}

	.artworks-grid {
		@apply grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4;
	}

	.artwork-container {
		@apply cursor-pointer bg-transparent border-none p-0;
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
		@apply text-base leading-relaxed m-0 text-left;
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

		.bio-section p {
			@apply text-gray-100;
		}

		.display-name {
			@apply text-gray-400;
		}

		.description-section p {
			@apply text-gray-300;
		}

		.read-more-button {
			@apply text-yellow-400 hover:text-yellow-400/80;
			color: #FCED1C; /* Use exact yellow from logo */
		}

		.read-more-button:hover {
			color: #FFF075; /* Lighter yellow on hover */
		}

		.detail-section h3 {
			@apply text-gray-400;
		}

		.links-combined a {
			@apply text-white/60 hover:text-white;
		}

		.link-icon {
			@apply text-gray-400;
		}

		.chain-icon {
			@apply text-gray-400;
		}

		.wallet-address {
			@apply bg-gray-800 hover:bg-gray-700 text-gray-300;
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

		.social-icon-button {
			@apply text-gray-400 hover:text-white hover:bg-gray-800;
		}

		.wallet-link {
			@apply text-white/60 hover:text-white;
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

		.artist-header {
			@apply gap-1;
		}

		.bio-section p {
			@apply mb-2;
		}
	}

	.detail-sections-grid {
		@apply space-y-4 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 lg:block lg:space-y-6;
	}

	.social-icons {
		@apply flex items-center gap-2 mt-2;
	}

	.social-icon-button {
		@apply w-10 h-10 flex items-center justify-center text-gray-600 hover:text-black transition-colors duration-200 rounded-md hover:bg-gray-100;
		text-decoration: none;
	}
</style>
