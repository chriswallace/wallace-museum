<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import { getContractUrl, getContractName, truncateAddress } from '$lib/utils';
	import { linear } from 'svelte/easing';
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
	import ArtworkDisplay from '$lib/components/ArtworkDisplay.svelte';
	import ArtistList from '$lib/components/ArtistList.svelte';

	export let data: { 
		artist?: any; 
		currentArtworkId?: string;
		currentIndex?: number;
		currentArtworkArtists?: any[];
		error?: string; 
	};

	interface Attribute {
		trait_type?: string;
		value: string;
	}

	let currentIndex = data.currentIndex || 0;
	let iframeEl: HTMLIFrameElement | null = null;
	let isInBrowserFullscreen = false;
	let keyboardHelpVisible = false;
	let fullscreenHintVisible = false;
	let fullscreenHintTimeout: ReturnType<typeof setTimeout>;
	let mainContainer: HTMLElement;
	let isDescriptionExpanded = false;

	// Track fullscreen state
	function handleFullscreenChange() {
		const wasFullscreen = isInBrowserFullscreen;
		isInBrowserFullscreen = !!document.fullscreenElement;
		
		// Show hint when entering fullscreen
		if (!wasFullscreen && isInBrowserFullscreen) {
			showFullscreenHint();
		}
		
		// Restore focus after fullscreen change
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus({ preventScroll: true });
			}
		}, 100);
	}

	function showFullscreenHint() {
		fullscreenHintVisible = true;
		clearTimeout(fullscreenHintTimeout);
		fullscreenHintTimeout = setTimeout(() => {
			fullscreenHintVisible = false;
		}, 3000);
	}

	// Ensure focus is maintained after navigation
	function restoreFocus() {
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus({ preventScroll: true });
			}
		}, 100);
	}

	onMount(() => {
		// Prevent automatic scroll restoration
		if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}

		// Listen for fullscreen changes
		document.addEventListener('fullscreenchange', handleFullscreenChange);
		
		// Set initial focus without scrolling
		setTimeout(() => {
			if (mainContainer) {
				mainContainer.focus({ preventScroll: true });
			}
		}, 100);

		// Initialize aspect ratio calculation
		calculateAspectRatio();
		setupMediaLoadDetection();
		
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			clearTimeout(fullscreenHintTimeout);
		};
	});

	function formatMintDate(dateStr: string | Date | undefined): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric',
			timeZoneName: 'short'
		}).format(date);
	}

	function closeOverlay() {
		goto('/');
	}

	function nextArtwork() {
		if (!data.artist) return;
		const nextIndex = (currentIndex + 1) % data.artist.artworks.length;
		const nextArtworkId = data.artist.artworks[nextIndex].id;
		goto(`/artist/${data.artist.id}/${nextArtworkId}`).then(() => {
			restoreFocus();
		});
	}

	function prevArtwork() {
		if (!data.artist) return;
		const prevIndex = (currentIndex - 1 + data.artist.artworks.length) % data.artist.artworks.length;
		const prevArtworkId = data.artist.artworks[prevIndex].id;
		goto(`/artist/${data.artist.id}/${prevArtworkId}`).then(() => {
			restoreFocus();
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		// Prevent default behavior for our handled keys
		const handledKeys = ['Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyH', 'Space', 'Home', 'End'];
		if (handledKeys.includes(event.code)) {
			event.preventDefault();
		}

		// Don't handle keys if user is typing in an input field
		const activeElement = document.activeElement;
		if (activeElement && (
			activeElement.tagName === 'INPUT' || 
			activeElement.tagName === 'TEXTAREA' || 
			(activeElement as HTMLElement).contentEditable === 'true'
		)) {
			return;
		}

		switch (event.key) {
			case 'Escape':
				if (keyboardHelpVisible) {
					keyboardHelpVisible = false;
				} else if (isInBrowserFullscreen) {
					// Exit fullscreen if in fullscreen mode
					document.exitFullscreen?.();
				} else {
					closeOverlay();
				}
				break;
			
			case 'ArrowRight':
			case 'ArrowDown':
				nextArtwork();
				break;
			
			case 'ArrowLeft':
			case 'ArrowUp':
				prevArtwork();
				break;
			
			case 'f':
			case 'F':
				// Toggle fullscreen for images and iframes
				if (currentArtworkForDisplay && !isInBrowserFullscreen) {
					const artworkCanvas = document.querySelector('.artwork-canvas');
					if (artworkCanvas && artworkCanvas.requestFullscreen) {
						artworkCanvas.requestFullscreen();
					}
				} else if (isInBrowserFullscreen) {
					document.exitFullscreen?.();
				}
				break;
			
			case ' ':
				// Space bar - toggle play/pause for videos or next artwork for images
				const videoElement = document.querySelector('video');
				if (videoElement) {
					if (videoElement.paused) {
						videoElement.play();
					} else {
						videoElement.pause();
					}
				} else {
					nextArtwork();
				}
				break;
			
			case 'Home':
				// Go to first artwork
				if (data.artist && data.artist.artworks.length > 0) {
					const firstArtworkId = data.artist.artworks[0].id;
					goto(`/artist/${data.artist.id}/${firstArtworkId}`).then(() => {
						restoreFocus();
					});
				}
				break;
			
			case 'End':
				// Go to last artwork
				if (data.artist && data.artist.artworks.length > 0) {
					const lastIndex = data.artist.artworks.length - 1;
					const lastArtworkId = data.artist.artworks[lastIndex].id;
					goto(`/artist/${data.artist.id}/${lastArtworkId}`).then(() => {
						restoreFocus();
					});
				}
				break;
			
			case 'h':
			case 'H':
			case '?':
				keyboardHelpVisible = !keyboardHelpVisible;
				break;
		}
	}

	function getProfileUrl(address: string, blockchain: string): string | null {
		if (blockchain === 'ethereum') {
			return `https://opensea.io/${address}`;
		} else if (blockchain === 'tezos') {
			return `https://objkt.com/profile/${address}`;
		}
		return null;
	}

	function getProfileLinkText(blockchain: string): string {
		if (blockchain === 'ethereum') {
			return 'View on OpenSea';
		} else if (blockchain === 'tezos') {
			return 'View on Objkt';
		}
		return 'View Profile';
	}

	function formatWalletAddress(address: string): string {
		if (address.length <= 10) return address;
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	function formatMedium(mime?: string): string {
		if (!mime) return 'Digital Artwork';

		// Handle image types
		if (mime.startsWith('image/')) {
			return 'Digital Image';
		}

		// Handle video types
		if (mime.startsWith('video/')) {
			return 'Digital Video';
		}

		// Handle interactive/code works
		if (
			mime === 'application/x-directory' ||
			mime.startsWith('text/') ||
			mime.includes('javascript') ||
			mime.includes('html')
		) {
			return 'Interactive Digital Artwork';
		}

		// Handle other application types
		if (mime.startsWith('application/')) {
			return 'Digital Artwork';
		}

		return 'Digital Artwork';
	}

	function parseAttributes(
		attributes: string | any[] | null | undefined
	): { trait_type: string; value: string }[] {
		if (!attributes) return [];
		if (Array.isArray(attributes)) return attributes;
		try {
			const parsed = JSON.parse(attributes);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	function parseAndJoinTags(tags: any): string {
		if (typeof tags === 'string') {
			try {
				const parsedTags = JSON.parse(tags);
				if (Array.isArray(parsedTags)) {
					return parsedTags.join(', ');
				}
			} catch (e) {
				console.error('Error parsing tags:', e);
				return ''; // Or return the original string, or some error indicator
			}
		} else if (Array.isArray(tags)) {
			return tags.join(', '); // Already an array
		}
		return ''; // Not a string or an array
	}

	$: currentArtwork = data.artist?.artworks?.[currentIndex];
	$: currentDimensions = currentArtwork?.dimensions;
	$: dimensionsObj = currentDimensions
		? typeof currentDimensions === 'string'
			? JSON.parse(currentDimensions)
			: currentDimensions
		: { width: 16, height: 9 };
	$: aspectRatio = `${dimensionsObj.width} / ${dimensionsObj.height}`;

	$: currentAttributes =
		data.artist &&
		data.artist.artworks[currentIndex] &&
		data.artist.artworks[currentIndex].attributes
			? parseAttributes(data.artist.artworks[currentIndex].attributes)
					.map((a) => `${a.trait_type}: ${a.value}`)
					.join(', ')
			: '';

	$: pageTitle = data.currentArtworkArtists && currentArtwork
		? `${currentArtwork.title} by ${data.currentArtworkArtists.map(a => a.name).join(', ')} | Wallace Museum`
		: data.error
			? 'Artwork Not Found | Wallace Museum'
			: 'Loading Artwork | Wallace Museum';

	// Transform artwork data to match ArtworkDisplay component interface
	$: currentArtworkForDisplay = currentArtwork ? {
		generatorUrl: currentArtwork.generator_url || currentArtwork.generatorUrl,
		animationUrl: currentArtwork.animation_url || currentArtwork.animationUrl,
		imageUrl: currentArtwork.image_url || currentArtwork.imageUrl,
		thumbnailUrl: currentArtwork.thumbnail_url || currentArtwork.thumbnailUrl,
		mime: currentArtwork.mime,
		title: currentArtwork.title,
		dimensions: dimensionsObj,
		fullscreen: currentArtwork.fullscreen
	} : null;

	let width: number = dimensionsObj?.width ?? 0;
	let height: number = dimensionsObj?.height ?? 0;

	$: if (dimensionsObj) {
		width = dimensionsObj.width ?? 0;
		height = dimensionsObj.height ?? 0;
	}

	// Update currentIndex when data changes (for URL navigation)
	$: if (data.currentIndex !== undefined && data.currentIndex !== currentIndex) {
		currentIndex = data.currentIndex;
		restoreFocus();
	}

	// Restore focus when artwork changes
	$: if (currentArtwork && mainContainer) {
		restoreFocus();
	}

	// Check if current artwork is fullscreen
	$: isFullscreen = currentArtwork?.fullscreen || false;
	$: hasValidDimensions = dimensionsObj && dimensionsObj.width > 0 && dimensionsObj.height > 0;
	$: useExactDimensions = hasValidDimensions && !isFullscreen;

	// SEO constants
	$: siteUrl = 'https://wallace-collection.vercel.app'; // Update this to your actual domain
	$: artworkImageUrl = currentArtwork?.image_url || currentArtwork?.thumbnail_url || `${siteUrl}/images/wallace-museum.png`;
	$: artworkDescription = data.currentArtworkArtists && currentArtwork
		? `${currentArtwork.title} by ${data.currentArtworkArtists.map(a => a.name).join(', ')} - ${currentArtwork.description || 'Digital artwork at the Wallace Museum showcasing innovative computational and algorithmic art.'}`
		: 'Artwork gallery at the Wallace Museum';
	$: artistNames = data.currentArtworkArtists?.map(a => a.name).join(', ') || 'Unknown Artist';

	// Template layout functions
	function calculateAspectRatio() {
		const artworkCanvas = document.querySelector('.artwork-canvas');
		const nftMediaDiv = document.querySelector('.nft-media');

		if (!artworkCanvas || !nftMediaDiv) {
			return null;
		}

		const canvasRect = artworkCanvas.getBoundingClientRect();
		const canvasWidth = canvasRect.width;
		const canvasHeight = canvasRect.height;

		if (canvasWidth === 0 || canvasHeight === 0) {
			return null;
		}

		const aspectRatio = canvasWidth / canvasHeight;
		(nftMediaDiv as HTMLElement).style.aspectRatio = `${aspectRatio} / 1`;

		return aspectRatio;
	}

	function handleLayoutRecalculation() {
		const nftMediaDiv = document.querySelector('.nft-media');
		
		if (nftMediaDiv) {
			(nftMediaDiv as HTMLElement).style.aspectRatio = '';
		}

		requestAnimationFrame(() => {
			setTimeout(() => {
				calculateAspectRatio();
			}, 50);
		});
	}

	function debounce(func: Function, wait: number) {
		let timeout: ReturnType<typeof setTimeout>;
		return function executedFunction(...args: any[]) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	const debouncedHandleLayoutRecalculation = debounce(handleLayoutRecalculation, 150);

	function setupMediaLoadDetection() {
		const nftMediaDiv = document.querySelector('.nft-media');
		
		if (!nftMediaDiv) {
			return;
		}

		nftMediaDiv.classList.add('isMediaLoaded-false');
		nftMediaDiv.classList.remove('isMediaLoaded-true');

		function handleMediaLoad() {
			if (nftMediaDiv) {
				nftMediaDiv.classList.remove('isMediaLoaded-false');
				nftMediaDiv.classList.add('isMediaLoaded-true');
			}
		}

		// Look for media elements within the ArtworkDisplay component
		const checkForMediaElements = () => {
			// Check for image elements (from OptimizedImage component)
			const imageElement = nftMediaDiv.querySelector('img');
			if (imageElement) {
				if (imageElement.complete && imageElement.naturalHeight !== 0) {
					handleMediaLoad();
				} else {
					imageElement.addEventListener('load', handleMediaLoad, { once: true });
				}
				return;
			}

			// Check for video elements (from VideoPlayer component)
			const videoElement = nftMediaDiv.querySelector('video');
			if (videoElement) {
				if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or higher
					handleMediaLoad();
				} else {
					videoElement.addEventListener('loadeddata', handleMediaLoad, { once: true });
				}
				return;
			}

			// Check for iframe elements
			const iframeElement = nftMediaDiv.querySelector('iframe');
			if (iframeElement) {
				iframeElement.addEventListener('load', handleMediaLoad, { once: true });
				// Also set a timeout fallback for iframes
				setTimeout(handleMediaLoad, 2000);
				return;
			}

			// If no media elements found yet, try again after a short delay
			setTimeout(checkForMediaElements, 100);
		};

		// Start checking for media elements
		checkForMediaElements();
	}

	// Handle window resize
	if (typeof window !== 'undefined') {
		window.addEventListener('resize', debouncedHandleLayoutRecalculation);
		window.addEventListener('load', () => {
			calculateAspectRatio();
			setupMediaLoadDetection();
		});
	}

	// Description helpers
	function shouldTruncateDescription(description: string): boolean {
		return !!(description && typeof description === 'string' && description.length > 255);
	}

	function getTruncatedDescription(description: string): string {
		if (!description || typeof description !== 'string') return '';
		return description.length > 255 ? description.substring(0, 255) + '...' : description;
	}

	function toggleDescription() {
		isDescriptionExpanded = !isDescriptionExpanded;
	}
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{pageTitle}</title>
	<meta name="title" content={pageTitle} />
	<meta name="description" content={artworkDescription} />
	<meta name="keywords" content="digital artwork, {currentArtwork?.title || 'artwork'}, {artistNames}, computational art, generative art, algorithmic art, NFT, Wallace Museum" />
	<meta name="author" content="Chris Wallace" />
	<meta name="robots" content="index, follow" />
	{#if data.artist && currentArtwork}
		<link rel="canonical" href="{siteUrl}/artist/{data.artist.id}/{currentArtwork.id}" />
	{/if}

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="article" />
	{#if data.artist && currentArtwork}
		<meta property="og:url" content="{siteUrl}/artist/{data.artist.id}/{currentArtwork.id}" />
	{/if}
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={artworkDescription} />
	<meta property="og:image" content={artworkImageUrl} />
	{#if dimensionsObj}
		<meta property="og:image:width" content={dimensionsObj.width?.toString() || "800"} />
		<meta property="og:image:height" content={dimensionsObj.height?.toString() || "800"} />
	{:else}
		<meta property="og:image:width" content="800" />
		<meta property="og:image:height" content="800" />
	{/if}
	<meta property="og:image:alt" content="{currentArtwork?.title || 'Artwork'} by {artistNames} - Wallace Museum" />
	<meta property="og:site_name" content="Wallace Museum" />
	<meta property="og:locale" content="en_US" />
	{#if data.currentArtworkArtists && data.currentArtworkArtists.length > 0}
		<meta property="article:author" content={data.currentArtworkArtists.map(a => a.name).join(', ')} />
	{/if}
	<meta property="article:section" content="Digital Art" />
	<meta property="article:tag" content="Digital Art" />
	<meta property="article:tag" content="Generative Art" />
	<meta property="article:tag" content="Computational Art" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	{#if data.artist && currentArtwork}
		<meta property="twitter:url" content="{siteUrl}/artist/{data.artist.id}/{currentArtwork.id}" />
	{/if}
	<meta property="twitter:title" content={pageTitle} />
	<meta property="twitter:description" content={artworkDescription} />
	<meta property="twitter:image" content={artworkImageUrl} />
	<meta property="twitter:image:alt" content="{currentArtwork?.title || 'Artwork'} by {artistNames} - Wallace Museum" />
	<meta property="twitter:site" content="@chriswallace" />
	<meta property="twitter:creator" content="@chriswallace" />

	<!-- Structured Data (JSON-LD) -->
	{#if currentArtwork && data.currentArtworkArtists}
		<script type="application/ld+json">
			{
				"@context": "https://schema.org",
				"@type": "VisualArtwork",
				"name": "{currentArtwork.title}",
				"description": "{currentArtwork.description || 'Digital artwork showcasing innovative computational and algorithmic art'}",
				"url": "{siteUrl}/artist/{data.artist.id}/{currentArtwork.id}",
				"image": "{artworkImageUrl}",
				"creator": [
					{#each data.currentArtworkArtists as artist, i}
					{
						"@type": "Person",
						"name": "{artist.name}",
						"url": "{siteUrl}/artist/{artist.id}"
					}{#if i < data.currentArtworkArtists.length - 1},{/if}
					{/each}
				],
				"artMedium": "Digital Art",
				"artworkSurface": "Digital",
				"artform": "Computational Art",
				{#if dimensionsObj}
				"width": {
					"@type": "Distance",
					"name": "{dimensionsObj.width} pixels"
				},
				"height": {
					"@type": "Distance", 
					"name": "{dimensionsObj.height} pixels"
				},
				{/if}
				{#if currentArtwork.mintDate}
				"dateCreated": "{currentArtwork.mintDate}",
				{/if}
				{#if currentArtwork.tokenID}
				"identifier": "{currentArtwork.tokenID}",
				{/if}
				"isPartOf": {
					"@type": "Collection",
					"name": "Wallace Museum Digital Art Collection",
					"url": "{siteUrl}"
				},
				"mainEntityOfPage": {
					"@type": "WebPage",
					"@id": "{siteUrl}/artist/{data.artist.id}/{currentArtwork.id}"
				}
			}
		</script>
	{/if}
</svelte:head>

{#if !data.artist && data.error}
	<div class="error-page" transition:fade>
		<div class="error-content">
			<h2>Artwork Not Found</h2>
			<p>{data.error}</p>
			<button on:click={closeOverlay}>Return Home</button>
		</div>
	</div>
{:else if !data.artist}
	<div class="loading-page" transition:fade>
		<div class="loading-content">
			<div class="loader" />
			<p>Loading artwork...</p>
		</div>
	</div>
{:else}
	<main class="artwork-page" role="application" tabindex="0" on:keydown={handleKeyDown} on:click={() => mainContainer?.focus({ preventScroll: true })} transition:fade bind:this={mainContainer}>
		{#if data.artist.artworks.length > 0 && currentArtwork}
			{#key currentIndex}
				<div class="artwork-content-container" class:fullscreen={isInBrowserFullscreen}>
					<div class="artwork-flex-container" class:fullscreen={isInBrowserFullscreen}>
						<div class="artwork-container">
							<div class="artwork-canvas" class:fullscreen={isInBrowserFullscreen}>
								<!-- Fullscreen close button -->
								{#if isInBrowserFullscreen}
									<button 
										class="fullscreen-close-button"
										on:click={() => document.exitFullscreen?.()}
										aria-label="Exit fullscreen (Esc)"
										title="Exit fullscreen (Esc)"
									>
										<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<line x1="18" y1="6" x2="6" y2="18"></line>
											<line x1="6" y1="6" x2="18" y2="18"></line>
										</svg>
									</button>
								{/if}
								
								<div class="nft-media" class:fullscreen={isInBrowserFullscreen}>
										{#if currentArtworkForDisplay}
											<ArtworkDisplay 
												artwork={currentArtworkForDisplay} 
												isInFullscreenMode={isInBrowserFullscreen && isFullscreen}
											/>
										{/if}
								</div>
							</div>
						</div>
						<div class="info-container" class:fullscreen={isInBrowserFullscreen}>
							<!-- Artist and Title Header -->
							<div class="artwork-header">
								<div class="artist-info">
									{#if data.currentArtworkArtists && data.currentArtworkArtists.length > 0}
										<ArtistList 
											artists={data.currentArtworkArtists}
											layout="horizontal"
											size="sm"
											showAvatars={false}
											linkToWebsite={false}
											linkToArtist={true}
											showPopover={false}
											separator=", "
											className="artist-name"
										/>
									{:else}
										<span class="artist-name">Unknown Artist</span>
									{/if}
								</div>
								<h1 class="artwork-title">{currentArtwork.title}</h1>
								
								{#if data.artist.artworks.length > 1}
									<div class="artwork-navigation">
										<button 
											class="nav-button" 
											on:click={prevArtwork} 
											aria-label="Previous artwork (← or ↑)"
											title="Previous artwork (← or ↑)"
										>
											←
										</button>
										<button 
											class="nav-button" 
											on:click={nextArtwork} 
											aria-label="Next artwork (→ or ↓)"
											title="Next artwork (→ or ↓)"
										>
											→
										</button>
									</div>
								{/if}
							</div>

							<!-- Description -->
							{#if currentArtwork.description}
								<div class="artwork-description">
									{#if shouldTruncateDescription(currentArtwork.description)}
										{#if isDescriptionExpanded}
											<p>{currentArtwork.description}</p>
											<button 
												class="read-more-button" 
												on:click={toggleDescription}
												aria-label="Show less description"
											>
												Read less
											</button>
										{:else}
											<p>{getTruncatedDescription(currentArtwork.description)}</p>
											<button 
												class="read-more-button" 
												on:click={toggleDescription}
												aria-label="Show full description"
											>
												Read more
											</button>
										{/if}
									{:else}
										<p>{currentArtwork.description}</p>
									{/if}
								</div>
							{/if}

							<!-- Attributes -->
							{#if currentArtwork.attributes && parseAttributes(currentArtwork.attributes).length > 0}
								<div class="metadata-section">
									<h3 class="metadata-heading">Attributes</h3>
									<div class="metadata-grid">
										{#each parseAttributes(currentArtwork.attributes) as attribute}
											<div class="metadata-item">
												<strong>{attribute.trait_type}</strong>
												<span>{attribute.value}</span>
											</div>
										{/each}
									</div>
								</div>
							{/if}

							<!-- Additional Details -->
							<div class="metadata-section">
								<h3 class="metadata-heading">Details</h3>
								<div class="metadata-grid">
									{#if currentArtwork.supply}
										<div class="metadata-item">
											<strong>Edition</strong>
											<span>1 of {currentArtwork.supply}</span>
										</div>
									{/if}
									{#if currentDimensions}
										<div class="metadata-item">
											<strong>Dimensions</strong>
											<span>{dimensionsObj.width} × {dimensionsObj.height}</span>
										</div>
									{/if}
									{#if currentArtwork.contractAddr}
										<div class="metadata-item">
											<strong>Contract</strong>
											{#if getContractUrl(currentArtwork.contractAddr, currentArtwork.blockchain, currentArtwork.tokenID)}
												<a
													href={getContractUrl(
														currentArtwork.contractAddr,
														currentArtwork.blockchain,
														currentArtwork.tokenID
													)}
													target="_blank"
													rel="noopener noreferrer"
													class="contract-link"
												>
													{getContractName(
														currentArtwork.contractAddr,
														currentArtwork.contractAlias
													)}
												</a>
											{:else}
												<span>
													{getContractName(
														currentArtwork.contractAddr,
														currentArtwork.contractAlias
													)}
												</span>
											{/if}
										</div>
									{/if}
									{#if currentArtwork.tokenID}
										<div class="metadata-item">
											<strong>Token ID</strong>
											<span>{currentArtwork.tokenID}</span>
										</div>
									{/if}
									{#if currentArtwork.tokenStandard}
										<div class="metadata-item">
											<strong>Token Standard</strong>
											<span>{currentArtwork.tokenStandard?.toUpperCase()}</span>
										</div>
									{/if}
									{#if currentArtwork.mintDate}
										<div class="metadata-item">
											<strong>Mint Date</strong>
											<span>{formatMintDate(currentArtwork.mintDate)}</span>
										</div>
									{/if}
									{#if currentArtwork.mime}
										<div class="metadata-item">
											<strong>Medium</strong>
											<span>{formatMedium(currentArtwork.mime)}</span>
										</div>
									{/if}
								</div>
							</div>

							<!-- Keyboard Shortcuts -->
							<div class="keyboard-shortcuts-section hidden md:block">
								<button 
									class="keyboard-help-trigger"
									on:click={() => keyboardHelpVisible = true}
									aria-label="Show keyboard shortcuts"
									title="Press H for keyboard shortcuts"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
										<line x1="8" y1="21" x2="16" y2="21"/>
										<line x1="12" y1="17" x2="12" y2="21"/>
									</svg>
									<span>Keyboard shortcuts</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			{/key}
		{/if}

		<!-- Keyboard Help Overlay -->
		{#if keyboardHelpVisible}
			<div class="keyboard-help-overlay" transition:fade>
				<div class="keyboard-help-content">
					<div class="keyboard-help-header">
						<h3>Keyboard Shortcuts</h3>
						<button 
							class="help-close-button"
							on:click={() => keyboardHelpVisible = false}
							aria-label="Close keyboard help"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"></line>
								<line x1="6" y1="6" x2="18" y2="18"></line>
							</svg>
						</button>
					</div>
					
					<div class="keyboard-help-grid">
						<div class="help-section">
							<h4>Navigation</h4>
							<div class="help-item">
								<kbd>←</kbd><kbd>↑</kbd>
								<span>Previous artwork</span>
							</div>
							<div class="help-item">
								<kbd>→</kbd><kbd>↓</kbd>
								<span>Next artwork</span>
							</div>
							<div class="help-item">
								<kbd>Home</kbd>
								<span>First artwork</span>
							</div>
							<div class="help-item">
								<kbd>End</kbd>
								<span>Last artwork</span>
							</div>
						</div>

						<div class="help-section">
							<h4>Display</h4>
							<div class="help-item">
								<kbd>F</kbd>
								<span>Toggle fullscreen</span>
							</div>
							<div class="help-item">
								<kbd>Space</kbd>
								<span>Play/pause video or next artwork</span>
							</div>
							<div class="help-item">
								<kbd>Esc</kbd>
								<span>Exit fullscreen or close</span>
							</div>
						</div>

						<div class="help-section">
							<h4>Help</h4>
							<div class="help-item">
								<kbd>H</kbd><kbd>?</kbd>
								<span>Show/hide this help</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Fullscreen Navigation Hint -->
		{#if fullscreenHintVisible && isInBrowserFullscreen}
			<div class="fullscreen-hint" transition:fade>
				<div class="fullscreen-hint-content">
					<p>Use ← → arrow keys to navigate • Press H for help • Press Esc to exit</p>
				</div>
			</div>
		{/if}
	</main>
{/if}

<style lang="postcss">
	/* Base styles from template */
	.artwork-page {
		@apply m-0 p-0 min-h-screen outline-none;
	}

	.artwork-content-container {
		@apply max-w-[2000px] mx-auto flex-1 px-4 sm:px-6 lg:px-12;
	}

	/* Fullscreen content container - remove constraints and padding */
	.artwork-content-container.fullscreen {
		@apply max-w-none px-0;
		margin: 0;
		height: 100vh;
	}

	.artwork-flex-container {
		@apply relative flex flex-col gap-12 lg:gap-0 lg:flex-row;
	}

	/* Fullscreen flex container adjustments */
	.artwork-flex-container.fullscreen {
		@apply gap-0;
		height: 100vh;
	}

	.artwork-container {
		@apply flex items-start justify-center flex-grow min-w-0;
		box-sizing: inherit;
	}

	.artwork-canvas {
		@apply flex items-center justify-center flex-grow h-[50vh] p-[5%] sticky top-0 self-start;
		@apply lg:h-[calc(100vh-var(--navbar-height))] lg:pl-0 lg:pr-12 lg:top-[var(--navbar-height)];
		box-sizing: border-box;
		color: rgb(255, 255, 255);
		unicode-bidi: isolate;
		transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		-webkit-font-smoothing: antialiased;
	}

	/* Fullscreen artwork canvas - remove padding and extend edge-to-edge */
	.artwork-canvas.fullscreen {
		@apply p-0 lg:pr-0;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100vw;
		height: 100vh;
		z-index: 1000;
		background: black;
		/* Center the content with equal margins and padding */
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.nft-media {
		@apply flex items-center justify-center relative max-w-full max-h-full w-full h-full;
		box-sizing: inherit;
		transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), aspect-ratio 0.4s ease-out;
	}

	/* Fullscreen nft-media - maintain normal behavior within the centered canvas */
	.nft-media.fullscreen {
		/* Remove aggressive positioning - let the parent artwork-canvas handle it */
		position: relative;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
	}

	.info-container {
		@apply flex-grow-0 flex-shrink-0 gap-6 flex flex-col pb-8 lg:pt-12 lg:pl-12 lg:pr-0 lg:pb-12 lg:min-w-[464px] lg:max-w-[464px] lg:border-l lg:border-black/10 dark:lg:border-white/10;
	}

	/* Fullscreen info container - position as overlay */
	.info-container.fullscreen {
		@apply fixed top-0 right-0 z-10 bg-black/80 backdrop-blur-sm;
		@apply max-w-[400px] min-w-[350px] h-screen overflow-y-auto;
		@apply p-6 lg:p-8;
		border-left: none;
		z-index: 1001; /* Above the fullscreen artwork-canvas */
	}

	.media-container {
		@apply relative max-h-full max-w-full overflow-hidden cursor-zoom-in;
		box-sizing: inherit;
		transition: opacity 1000ms cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		will-change: opacity, transform;
	}

	.isMediaLoaded-false .media-container {
		@apply opacity-0 scale-75;
	}

	.isMediaLoaded-true .media-container {
		@apply opacity-100 scale-100;
	}

	/* Artwork header styles */
	.artwork-header {
		@apply flex flex-col gap-4 relative;
	}

	.artist-info {
		@apply mb-2;
	}

	.artist-name {
		@apply text-lg font-medium uppercase tracking-wider text-primary-dark;
	}

	/* Override the text-xs class from ArtistList component */
	.artist-info .artist-name,
	.artist-info .artist-name * {
		font-size: 18px !important;
	}

	.artwork-title {
		@apply text-3xl font-semibold leading-tight m-0 break-words;
		white-space: normal;
		overflow-wrap: break-word;
		hyphens: auto;
	}

	.artwork-navigation {
		@apply absolute -top-4 right-0 flex gap-2;
	}

	.nav-button {
		@apply flex items-center justify-center w-10 h-10 border-none rounded-full cursor-pointer text-lg;
		@apply text-gray-600 transition-colors duration-200;
		@apply dark:text-gray-400;
	}

	/* Desktop hover styles - only apply on medium screens and larger */
	@media (min-width: 768px) {
		.nav-button:hover {
			@apply bg-primary text-black;
		}
	}

	/* Desktop dark mode hover styles */
	@media (min-width: 768px) and (prefers-color-scheme: dark) {
		.nav-button:hover {
			@apply bg-primary-dark text-black;
		}
	}

	/* Mobile touch styles - prevent background color changes */
	@media (max-width: 767px) {
		.nav-button:hover,
		.nav-button:active,
		.nav-button:focus {
			background-color: transparent !important;
		}
	}

	/* Content styles */
	.artwork-description {
		@apply leading-relaxed text-sm;
	}

	.artwork-description p {
		@apply m-0 mb-2;
	}

	.read-more-button {
		@apply bg-transparent border-none text-primary cursor-pointer text-sm p-0 underline;
		@apply hover:text-primary/80 transition-colors duration-200;
		@apply dark:text-primary-dark dark:hover:text-primary-dark/80;
	}

	.metadata-section {
		@apply flex flex-col gap-4;
	}

	.metadata-heading {
		@apply text-base font-semibold text-white dark:text-gray-100 m-0;
	}

	.metadata-grid {
		@apply grid grid-cols-2 gap-4;
	}

	.metadata-item {
		@apply flex flex-col gap-1 min-w-0;
	}

	.metadata-item strong {
		@apply text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium;
	}

	.metadata-item span,
	.metadata-item a {
		@apply text-sm font-medium text-gray-700 dark:text-gray-100 break-words;
	}

	.contract-link {
		@apply no-underline hover:text-primary-dark/80 hover:underline transition-colors duration-200;
	}

	/* Keyboard shortcuts */
	.keyboard-shortcuts-section {
		@apply mt-8;
	}

	.keyboard-help-trigger {
		@apply flex items-center gap-2 bg-transparent border border-gray-200 dark:border-white/20 text-gray-400 dark:text-gray-400 px-4 py-3 rounded-sm cursor-pointer text-sm hover:text-gray-700 hover:bg-gray-100 dark:hover:border-white/30 transition-all duration-200;
	}

	/* Error and loading states */
	.error-page,
	.loading-page {
		@apply flex items-center justify-center min-h-screen bg-black text-white;
	}

	.error-content,
	.loading-content {
		@apply text-center p-8;
	}

	.error-content h2 {
		@apply text-2xl mb-4;
	}

	.error-content button {
		@apply bg-primary-dark text-black border-none px-6 py-3 rounded-md cursor-pointer font-medium mt-4;
	}

	.loader {
		@apply border-4 border-gray-600 border-t-white rounded-full w-9 h-9 mx-auto mb-4;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Keyboard help overlay */
	.keyboard-help-overlay {
		@apply fixed inset-0 bg-black/80 flex items-center justify-center z-50;
	}

	.keyboard-help-content {
		@apply bg-gray-950 p-8 rounded-lg shadow-2xl max-w-2xl max-h-[80vh] overflow-y-auto text-white;
	}

	.keyboard-help-header {
		@apply flex justify-between items-center mb-6;
	}

	.keyboard-help-header h3 {
		@apply text-xl font-semibold m-0;
	}

	.help-close-button {
		@apply w-8 h-8 flex items-center justify-center bg-white/10 text-white border-none rounded-full cursor-pointer;
		@apply hover:bg-white/20 transition-colors duration-200;
	}

	.keyboard-help-grid {
		@apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6;
	}

	.help-section h4 {
		@apply text-base font-semibold mb-3 text-primary-dark;
	}

	.help-item {
		@apply flex items-center gap-3 mb-2;
	}

	.help-item kbd {
		@apply inline-flex items-center justify-center px-2 py-1 bg-white/10 text-white text-xs font-mono border border-white/20 min-w-8;
	}

	.help-item span {
		@apply text-sm text-gray-300;
	}

	/* Fullscreen hint */
	.fullscreen-hint {
		@apply fixed top-4 left-1/2 -translate-x-1/2 z-50;
	}

	.fullscreen-hint-content {
		@apply bg-black/80 text-white px-5 py-3 rounded-md shadow-lg;
	}

	.fullscreen-hint-content p {
		@apply text-sm font-medium m-0;
	}

	/* Fullscreen close button */
	.fullscreen-close-button {
		@apply fixed top-4 right-4 z-50 w-12 h-12 bg-black/60 backdrop-blur-sm text-white border-none rounded-full cursor-pointer;
		@apply flex items-center justify-center transition-all duration-200;
		@apply hover:bg-black/80 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white/50;
	}

	.fullscreen-close-button svg {
		@apply w-6 h-6;
	}
</style>