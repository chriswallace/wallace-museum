<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';

	export let data: { collection?: any; error?: string };

	// Modal state for description
	let isDescriptionModalOpen = false;
	
	// Modal state for artists
	let isArtistsModalOpen = false;

	// Character limit for truncating descriptions
	const DESCRIPTION_LIMIT = 300;
	
	// Maximum artists to show before showing "show more" button
	const MAX_ARTISTS_SHOWN = 3;

	function formatDate(dateStr: string | Date | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	}

	function formatNumber(num: number | null | undefined): string {
		if (num === null || num === undefined) return '';
		return new Intl.NumberFormat('en-US').format(num);
	}

	function formatPrice(price: number | null | undefined): string {
		if (price === null || price === undefined) return '';
		return `${price.toFixed(4)} ETH`;
	}

	function parseContractAddresses(addresses: any): string[] {
		if (!addresses) return [];
		if (Array.isArray(addresses)) return addresses;
		try {
			const parsed = JSON.parse(addresses);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
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

	function openArtistsModal() {
		isArtistsModalOpen = true;
	}

	function closeArtistsModal() {
		isArtistsModalOpen = false;
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeDescriptionModal();
			closeArtistsModal();
		}
	}

	function handleModalBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeDescriptionModal();
			closeArtistsModal();
		}
	}

	function isVideoUrl(url: string | null | undefined): boolean {
		if (!url) return false;
		const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
		const lowerUrl = url.toLowerCase();
		return videoExtensions.some(ext => lowerUrl.includes(ext));
	}

	function isVideoMimeType(mimeType: string | null | undefined): boolean {
		if (!mimeType) return false;
		return mimeType.startsWith('video/');
	}

	function handleArtistClick(artistId: number) {
		goto(`/artist/${artistId}`);
	}

	// Disable body scroll when modal is open
	$: if (typeof document !== 'undefined') {
		if (isDescriptionModalOpen || isArtistsModalOpen) {
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

	$: pageTitle = data.collection
		? `${data.collection.title} | Wallace Museum`
		: data.error
			? 'Collection Not Found | Wallace Museum'
			: 'Loading Collection | Wallace Museum';

	$: contractAddresses = data.collection ? parseContractAddresses(data.collection.contractAddresses) : [];

	// Get the primary description
	$: primaryDescription = data.collection?.description || data.collection?.curatorNotes || '';
	$: shouldShowReadMore = shouldTruncateDescription(primaryDescription);
	$: truncatedDescription = getTruncatedDescription(primaryDescription);

	// SEO constants
	$: siteUrl = 'https://wallace-collection.vercel.app';
	$: collectionImageUrl = data.collection?.imageUrl || data.collection?.bannerImageUrl || `${siteUrl}/images/wallace-museum.png`;
	$: collectionDescription = data.collection 
		? `${data.collection.title} - ${primaryDescription || 'A curated collection at the Wallace Museum showcasing innovative digital art.'}`
		: 'Collection at the Wallace Museum';
	$: artworkCount = data.collection?.artworks?.length || 0;
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{pageTitle}</title>
	<meta name="title" content={pageTitle} />
	<meta name="description" content={collectionDescription} />
	<meta name="keywords" content="digital art collection, {data.collection?.title || 'collection'}, generative art, algorithmic art, NFT collection, Wallace Museum" />
	<meta name="author" content="Chris Wallace" />
	<meta name="robots" content="index, follow" />
	{#if data.collection}
		<link rel="canonical" href="{siteUrl}/collection/{data.collection.slug}" />
	{/if}

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	{#if data.collection}
		<meta property="og:url" content="{siteUrl}/collection/{data.collection.slug}" />
	{/if}
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={collectionDescription} />
	<meta property="og:image" content={collectionImageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:site_name" content="Wallace Museum" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	{#if data.collection}
		<meta property="twitter:url" content="{siteUrl}/collection/{data.collection.slug}" />
	{/if}
	<meta property="twitter:title" content={pageTitle} />
	<meta property="twitter:description" content={collectionDescription} />
	<meta property="twitter:image" content={collectionImageUrl} />
	<meta property="twitter:site" content="@chriswallace" />
	<meta property="twitter:creator" content="@chriswallace" />

	<!-- Structured Data (JSON-LD) -->
	{#if data.collection}
		<script type="application/ld+json">
			{JSON.stringify({
				"@context": "https://schema.org",
				"@type": "Collection",
				"name": data.collection.title,
				"description": collectionDescription,
				"url": `${siteUrl}/collection/${data.collection.slug}`,
				"image": collectionImageUrl,
				"numberOfItems": artworkCount,
				"isPartOf": {
					"@type": "Museum",
					"name": "Wallace Museum",
					"url": siteUrl
				}
			})}
		</script>
	{/if}
</svelte:head>

{#if data.error}
	<div class="page-container">
		<div class="error-container">
			<h1>Collection Not Found</h1>
			<p>The collection you're looking for doesn't exist or has been removed.</p>
			<button class="return-button" on:click={() => goto('/')}>
				Return to Home
			</button>
		</div>
	</div>
{:else if !data.collection}
	<div class="page-container">
		<div class="loading-container">
			<div class="loader"></div>
			<p>Loading collection...</p>
		</div>
	</div>
{:else}
	<div class="page-container">
		<div class="content-container">
			<div class="layout-grid">
				<!-- Left Sidebar - Collection Info -->
				<aside class="collection-sidebar">
					<div class="collection-info">
						<!-- Collection Image -->
						{#if data.collection.imageUrl || data.collection.bannerImageUrl}
								<OptimizedImage
									src={data.collection.imageUrl || data.collection.bannerImageUrl}
									alt={data.collection.title}
									width={64}
									fit="cover"
									gravity="auto"
									format="auto"
									quality={70}
									className="collection-image"
									fallbackSrc="/images/medici-image.png"
								/>
						{/if}

						<!-- Collection Header -->
						<div class="collection-header">
							<h1 class="collection-title">{data.collection.title}</h1>
							{#if data.collection.isGenerativeArt}
								<span class="generative-badge">Generative Art</span>
							{/if}
						</div>

						<!-- Collection Stats -->
						<div class="collection-stats">
							<div class="stat">
								<span class="stat-label">Artworks</span>
								<span class="stat-value">{artworkCount}</span>
							</div>
							{#if data.collection.totalSupply}
								<div class="stat">
									<span class="stat-label">Total Supply</span>
									<span class="stat-value">{formatNumber(data.collection.totalSupply)}</span>
								</div>
							{/if}
							{#if data.collection.floorPrice}
								<div class="stat">
									<span class="stat-label">Floor Price</span>
									<span class="stat-value">{formatPrice(data.collection.floorPrice)}</span>
								</div>
							{/if}
						</div>

						<!-- Description -->
						{#if primaryDescription}
							<div class="description-section">
								<h3>About</h3>
								<p>
									{truncatedDescription}
									{#if shouldShowReadMore}
										<button class="read-more-button" on:click={openDescriptionModal}>
											Read More
										</button>
									{/if}
								</p>
							</div>
						{/if}

												<!-- Collection Dates -->
						{#if data.collection.mintStartDate || data.collection.mintEndDate}
							<div class="detail-section">
								<h3>Mint Period</h3>
								<div class="date-range">
									{#if data.collection.mintStartDate}
										<div class="date-item">
											<span class="date-label">Started:</span>
											<span class="date-value">{formatDate(data.collection.mintStartDate)}</span>
										</div>
									{/if}
									{#if data.collection.mintEndDate}
										<div class="date-item">
											<span class="date-label">Ended:</span>
											<span class="date-value">{formatDate(data.collection.mintEndDate)}</span>
										</div>
									{/if}
								</div>
							</div>
						{/if}

						<!-- External Links -->
						{#if data.collection.websiteUrl || data.collection.projectUrl || data.collection.discordUrl || data.collection.telegramUrl}
							<div class="detail-section">
								<h3>Links</h3>
								<div class="links-list">
									{#if data.collection.websiteUrl}
										<a href={data.collection.websiteUrl} target="_blank" rel="noopener noreferrer" class="external-link">
											<svg viewBox="0 0 24 24" fill="currentColor" class="link-icon">
												<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
											</svg>
											Website
										</a>
									{/if}
									{#if data.collection.projectUrl}
										<a href={data.collection.projectUrl} target="_blank" rel="noopener noreferrer" class="external-link">
											<svg viewBox="0 0 24 24" fill="currentColor" class="link-icon">
												<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
											</svg>
											Project
										</a>
									{/if}
									{#if data.collection.discordUrl}
										<a href={data.collection.discordUrl} target="_blank" rel="noopener noreferrer" class="external-link">
											<svg viewBox="0 0 24 24" fill="currentColor" class="link-icon">
												<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
											</svg>
											Discord
										</a>
									{/if}
									{#if data.collection.telegramUrl}
										<a href={data.collection.telegramUrl} target="_blank" rel="noopener noreferrer" class="external-link">
											<svg viewBox="0 0 24 24" fill="currentColor" class="link-icon">
												<path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
											</svg>
											Telegram
										</a>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Contract Info -->
						{#if contractAddresses.length > 0}
							<div class="detail-section">
								<h3>Contract{contractAddresses.length > 1 ? 's' : ''}</h3>
								<div class="contracts-list">
									{#each contractAddresses as contractAddress}
										<div class="contract-item">
											<a 
												href={getContractUrl(contractAddress, data.collection.chainIdentifier || 'ethereum')}
												target="_blank"
												rel="noopener noreferrer"
												class="contract-link"
											>
												<span class="contract-name">{getContractName(contractAddress) || 'Smart Contract'}</span>
												<code class="contract-address">{truncateAddress(contractAddress)}</code>
											</a>
										</div>
									{/each}
								</div>
							</div>
						{/if}
						
						<!-- Artists -->
						{#if data.collection.artists && data.collection.artists.length > 0}
							<div class="detail-section">
								<h3>Artist{data.collection.artists.length > 1 ? 's' : ''}</h3>
								<div class="artists-list">
									{#each data.collection.artists.slice(0, MAX_ARTISTS_SHOWN) as artist}
										<button 
											class="artist-card"
											on:click={() => handleArtistClick(artist.id)}
										>
											{#if artist.avatarUrl}
												<div class="artist-avatar">
													<OptimizedImage
														src={artist.avatarUrl}
														alt="{artist.name} avatar"
														width={32}
														height={32}
														fit="crop"
														gravity="auto"
														format="auto"
														quality={90}
														className="avatar-image"
														fallbackSrc="/images/medici-image.png"
													/>
												</div>
											{:else}
												<div class="artist-avatar-placeholder">
													<svg viewBox="0 0 24 24" fill="currentColor" class="avatar-icon">
														<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
													</svg>
												</div>
											{/if}
											<span class="artist-name">{artist.name}</span>
										</button>
									{/each}
									
									{#if data.collection.artists.length > MAX_ARTISTS_SHOWN}
										<button 
											class="show-more-artists-button"
											on:click={openArtistsModal}
										>
											<div class="show-more-icon">+</div>
											<span class="show-more-text">{data.collection.artists.length - MAX_ARTISTS_SHOWN} more</span>
										</button>
									{/if}
								</div>
							</div>
						{/if}


					</div>
				</aside>

				<!-- Right Column - Artworks -->
				<main class="artworks-main">
					{#if data.collection.artworks && data.collection.artworks.length > 0}
						<div class="artworks-header">
							<h2>Artworks ({data.collection.artworks.length})</h2>
						</div>
						<div class="artworks-grid">
							{#each data.collection.artworks as artwork}
								<button class="artwork-container" on:click={() => {
									if (artwork.artists && artwork.artists.length > 0) {
										goto(`/artist/${artwork.artists[0].id}/${artwork.id}`);
									}
								}}>
									<div class="artwork-thumbnail">
										{#if (isVideoMimeType(artwork.mime) || isVideoUrl(artwork.animation_url)) && artwork.animation_url}
											<!-- Prioritize video content: show animation_url when it's a video -->
											<video
												src={ipfsToHttpUrl(artwork.animation_url)}
												class="thumbnail-video"
												muted
												autoplay
												loop
												playsinline
												preload="metadata"
												on:error={() => {
													console.log('Video failed to load:', artwork.animation_url);
												}}
											>
												<!-- Fallback for browsers that don't support the video -->
												<div class="thumbnail-placeholder">
													<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
														<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
													</svg>
												</div>
											</video>
										{:else if artwork.image_url}
											{#if isVideoUrl(artwork.image_url)}
												<!-- Show video when image_url contains video content -->
												<video
													src={ipfsToHttpUrl(artwork.image_url)}
													class="thumbnail-video"
													muted
													autoplay
													loop
													playsinline
													preload="metadata"
													on:error={() => {
														console.log('Video failed to load:', artwork.image_url);
													}}
												>
													<!-- Fallback for browsers that don't support the video -->
													<div class="thumbnail-placeholder">
														<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
															<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
														</svg>
													</div>
												</video>
											{:else}
												<!-- Show image -->
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
											{/if}
										{:else if artwork.animation_url}
											<!-- Fallback: show animation_url as video when no image is available -->
											<video
												src={ipfsToHttpUrl(artwork.animation_url)}
												class="thumbnail-video"
												muted
												autoplay
												loop
												playsinline
												preload="metadata"
												on:error={() => {
													console.log('Video failed to load:', artwork.animation_url);
												}}
											>
												<!-- Fallback for browsers that don't support the video -->
												<div class="thumbnail-placeholder">
													<svg viewBox="0 0 24 24" fill="currentColor" class="placeholder-icon">
														<path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
													</svg>
												</div>
											</video>
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
							<p>No artworks available in this collection.</p>
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
			aria-labelledby="modal-collection-title"
		>
			<!-- Modal Content -->
			<button class="modal-close-button" on:click={closeDescriptionModal} aria-label="Close">
				×
			</button>
			<div class="modal-scroll">
				<!-- Collection Header -->
				<div class="modal-collection-header">
					{#if data.collection.imageUrl || data.collection.bannerImageUrl}
						<div class="modal-image-container">
							<OptimizedImage
								src={data.collection.imageUrl || data.collection.bannerImageUrl}
								alt={data.collection.title}
								width={120}
								height={120}
								fit="crop"
								gravity="auto"
								format="auto"
								quality={90}
								className="modal-collection-image"
								fallbackSrc="/images/medici-image.png"
							/>
						</div>
					{/if}
					<h2 id="modal-collection-title" class="modal-collection-title">{data.collection.title}</h2>
				</div>

				<!-- Full Description -->
				<div class="modal-description">
					<p>{primaryDescription}</p>
				</div>
			</div>
		</div>
	</button>
{/if}

<!-- Artists Modal -->
{#if isArtistsModalOpen}
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
			aria-labelledby="modal-artists-title"
		>
			<!-- Modal Content -->
			<button class="modal-close-button" on:click={closeArtistsModal} aria-label="Close">
				×
			</button>

			<div class="modal-scroll">
				<!-- Modal Header -->
				<div class="modal-collection-header">
					{#if data.collection.imageUrl || data.collection.bannerImageUrl}
						<div class="modal-image-container">
							<OptimizedImage
								src={data.collection.imageUrl || data.collection.bannerImageUrl}
								alt={data.collection.title}
								width={96}
								height={96}
								fit="cover"
								gravity="auto"
								format="auto"
								quality={90}
								className="modal-collection-image"
								fallbackSrc="/images/medici-image.png"
							/>
						</div>
					{/if}
					<h2 id="modal-artists-title" class="modal-collection-title">
						All Artists
						<span class="modal-artist-count">({data.collection.artists.length})</span>
					</h2>
				</div>

				<!-- All Artists List -->
				<div class="modal-artists-grid">
					{#each data.collection.artists as artist}
						<button 
							class="modal-artist-card"
							on:click={() => {
								closeArtistsModal();
								handleArtistClick(artist.id);
							}}
						>
							{#if artist.avatarUrl}
								<div class="modal-artist-avatar">
									<OptimizedImage
										src={artist.avatarUrl}
										alt="{artist.name} avatar"
										width={48}
										height={48}
										fit="crop"
										gravity="auto"
										format="auto"
										quality={90}
										className="avatar-image"
										fallbackSrc="/images/medici-image.png"
									/>
								</div>
							{:else}
								<div class="modal-artist-avatar-placeholder">
									<svg viewBox="0 0 24 24" fill="currentColor" class="modal-avatar-icon">
										<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
									</svg>
								</div>
							{/if}
							<span class="modal-artist-name">{artist.name}</span>
						</button>
					{/each}
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

	.content-container {
		@apply w-full px-4;
	}

	.layout-grid {
		@apply flex flex-col md:flex-row md:mb-12;
	}

	.collection-sidebar {
		@apply w-full md:w-60 lg:w-80 md:flex-shrink-0 space-y-6 py-8;
	}

	.collection-info {
		@apply space-y-6;
	}

	:global(.collection-image) {
		@apply mb-2 inline-block rounded-sm;
	}

	.collection-header {
		@apply space-y-2;
	}

	.collection-title {
		@apply text-lg font-semibold mb-0;
	}

	.generative-badge {
		@apply inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-sm;
	}

	.collection-stats {
		@apply grid grid-cols-2 gap-4;
	}

	.stat {
		@apply space-y-1;
	}

	.stat-label {
		@apply block text-xs font-medium text-gray-500 uppercase tracking-wide;
	}

	.stat-value {
		@apply block text-lg font-semibold text-gray-900;
	}

	.description-section {
		@apply space-y-2;
	}

	.description-section h3 {
		@apply text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2;
	}

	.description-section p {
		@apply text-gray-700 leading-relaxed m-0 text-sm;
	}

	.read-more-button {
		@apply bg-transparent border-none text-gray-500 cursor-pointer text-sm p-0 underline;
		@apply hover:text-gray-500/80 transition-colors duration-200;
		@apply inline ml-1;
	}

	.detail-section {
		@apply space-y-3;
	}

	.detail-section h3 {
		@apply text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2;
	}

	.artist-card {
		@apply w-full flex items-center gap-4 py-3 hover:px-3 transition-all duration-200 bg-transparent hover:bg-gray-50 rounded-sm cursor-pointer border-none text-left;
	}

	.artist-avatar {
		@apply w-8 h-8 rounded-sm overflow-hidden bg-gray-700 flex-shrink-0;
	}

	.artist-avatar-placeholder {
		@apply w-8 h-8 rounded-sm bg-gray-200 flex items-center justify-center flex-shrink-0;
	}

	.avatar-image {
		@apply w-full h-full object-cover;
	}

	.avatar-icon {
		@apply w-8 h-8 text-gray-400;
	}

	.artist-card .artist-name {
		@apply text-base font-semibold text-gray-900;
	}

	.show-more-artists-button {
		@apply w-full flex items-center gap-3 py-3 hover:px-3 transition-all duration-200 bg-transparent hover:bg-gray-50 rounded-sm cursor-pointer border-none text-left;
	}

	.show-more-icon {
		@apply w-8 h-8 rounded-sm bg-gray-200 flex items-center justify-center flex-shrink-0 text-gray-600 font-semibold;
	}

	.show-more-text {
		@apply text-sm font-medium text-gray-600;
	}

	.date-range {
		@apply space-y-1;
	}

	.date-item {
		@apply flex justify-between text-sm;
	}

	.date-label {
		@apply text-gray-500;
	}

	.date-value {
		@apply text-gray-900 font-medium;
	}

	.links-list {
		@apply space-y-2;
	}

	.external-link {
		@apply flex items-center gap-2 text-xs text-black/60 hover:text-black transition-colors duration-200;
		text-decoration: none;
	}

	.link-icon {
		@apply w-4 h-4 text-gray-600;
	}

	.contracts-list {
		@apply space-y-2;
	}

	.contract-item {
		@apply block;
	}

	.contract-link {
		@apply text-black/60 hover:text-black text-xs transition-colors duration-200;
		text-decoration: none;
	}

	.contract-name {
		@apply text-sm font-medium text-gray-900;
	}

	.contract-address {
		@apply text-xs font-mono bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-sm transition-colors duration-200;
	}

	.artworks-main {
		@apply flex-1 min-h-0 px-0 md:px-8 py-0 lg:py-8;
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
		@apply w-full h-full object-contain;
	}

	.thumbnail-video {
		@apply w-full h-full object-contain;
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
		@apply relative bg-white rounded-sm shadow-2xl max-w-[600px];
		width: 100%;
		max-height: 82svh;
	}

	.modal-close-button {
		@apply absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 bg-transparent border-none cursor-pointer rounded-full hover:bg-gray-100 transition-colors;
		font-size: 20px;
		z-index: 10;
	}

	.modal-scroll {
		@apply overflow-y-auto p-6;
		max-height: calc(82svh - 2rem);
	}

	.modal-collection-header {
		@apply flex flex-col items-center text-center mb-6;
	}

	.modal-image-container {
		@apply mb-4 w-24 h-24 rounded-sm overflow-hidden flex-shrink-0;
	}

	.modal-collection-image {
		@apply w-full h-full object-cover;
	}

	.modal-collection-title {
		@apply text-2xl font-bold text-gray-900 m-0;
	}

	.modal-description {
		@apply text-gray-700 leading-relaxed;
	}

	.modal-description p {
		@apply text-base leading-relaxed m-0 text-left;
	}

	/* Artists Modal Styles */
	.modal-artist-count {
		@apply text-gray-500 font-normal;
	}

	.modal-artists-grid {
		@apply grid grid-cols-1 sm:grid-cols-2 gap-3;
	}

	.modal-artist-card {
		@apply w-full flex items-center gap-4 p-4 bg-transparent hover:bg-gray-50 rounded-sm transition-colors cursor-pointer border-none text-left;
	}

	.modal-artist-avatar {
		@apply w-12 h-12 rounded-sm overflow-hidden bg-gray-700 flex-shrink-0;
	}

	.modal-artist-avatar-placeholder {
		@apply w-12 h-12 rounded-sm bg-gray-200 flex items-center justify-center flex-shrink-0;
	}

	.modal-avatar-icon {
		@apply w-6 h-6 text-gray-400;
	}

	.modal-artist-name {
		@apply text-base font-semibold text-gray-900;
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

		.museum-link {
			@apply text-gray-400 hover:text-white;
		}

		.collection-sidebar {
			@apply border-gray-800;
		}

		.collection-image-container {
			@apply bg-gray-900;
		}

		.generative-badge {
			@apply bg-blue-900 text-blue-200;
		}

		.stat-label {
			@apply text-gray-400;
		}

		.stat-value {
			@apply text-gray-100;
		}

		.description-section h3,
		.detail-section h3 {
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

		.artist-card {
			@apply hover:bg-gray-900;
		}

		.artist-avatar-placeholder {
			@apply bg-gray-700;
		}

		.artist-card .artist-name {
			@apply text-gray-100;
		}

		.show-more-artists-button {
			@apply hover:bg-gray-900;
		}

		.show-more-icon {
			@apply bg-gray-700 text-gray-300;
		}

		.show-more-text {
			@apply text-gray-300;
		}

		.modal-artist-count {
			@apply text-gray-400;
		}

		.modal-artist-card {
			@apply hover:bg-gray-900;
		}

		.modal-artist-avatar-placeholder {
			@apply bg-gray-700;
		}

		.modal-avatar-icon {
			@apply text-gray-400;
		}

		.modal-artist-name {
			@apply text-gray-100;
		}

		.date-label {
			@apply text-gray-400;
		}

		.date-value {
			@apply text-gray-100;
		}

		.external-link {
			@apply text-white/60 hover:text-white;
		}

		.link-icon {
			@apply text-gray-400;
		}

		.contract-link {
			@apply text-white/60 hover:text-white;
		}

		.contract-name {
			@apply text-gray-100;
		}

		.contract-address {
			@apply bg-gray-800 hover:bg-gray-700 text-gray-300;
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

		.modal-content {
			@apply bg-black;
		}

		.modal-close-button {
			@apply text-gray-400 hover:text-gray-200 hover:bg-gray-800;
		}

		.modal-collection-title {
			@apply text-white;
		}

		.modal-description {
			@apply text-gray-300;
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

		.collection-header {
			@apply space-y-1;
		}

		.collection-stats {
			@apply grid-cols-1 gap-2;
		}
	}
</style> 