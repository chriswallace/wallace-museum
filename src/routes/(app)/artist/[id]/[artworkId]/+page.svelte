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
					const artworkContainer = document.querySelector('.artwork-container');
					if (artworkContainer && artworkContainer.requestFullscreen) {
						artworkContainer.requestFullscreen();
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
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content={data.currentArtworkArtists && currentArtwork
			? `${currentArtwork.title} by ${data.currentArtworkArtists.map(a => a.name).join(', ')} at the Wallace Museum`
			: 'Artwork gallery at the Wallace Museum'}
	/>
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
				<div class="artwork-content-container">
					<div class="artwork-flex-container">
						<div class="artwork-container">
							<div class="artwork-canvas">
								<div class="nft-media">
										{#if currentArtworkForDisplay}
											<ArtworkDisplay artwork={currentArtworkForDisplay} />
										{/if}
								</div>
							</div>
						</div>
						<div class="info-container">
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
									<p>{currentArtwork.description}</p>
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
							<div class="keyboard-shortcuts-section">
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

<style>
	/* Base styles from template */
	.artwork-page {
		margin: 0;
		padding: 0;
		font-family: Suisse, "Suisse Fallback", -apple-system, "system-ui", "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
		background: black;
		color: white;
		min-height: 100vh;
		outline: none;
	}

	.artwork-content-container {
		max-width: 2000px;
		margin-left: auto;
		margin-right: auto;
		flex: 1 1 0%;
		padding-left: 16px;
		padding-right: 16px;
	}

	@media (min-width: 640px) {
		.artwork-content-container {
			padding-left: 24px;
			padding-right: 24px;
		}
	}

	@media (min-width: 1024px) {
		.artwork-content-container {
			padding-left: 48px;
			padding-right: 48px;
		}
	}

	.artwork-flex-container {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	@media (min-width: 1024px) {
		.artwork-flex-container {
			flex-direction: row;
		}
	}

	.artwork-container {
		display: flex;
		align-items: flex-start;
		justify-content: center;
		flex-grow: 1;
		box-sizing: inherit;
		min-width: 0;
	}

	.artwork-canvas {
		align-items: center;
		box-sizing: border-box;
		color: rgb(255, 255, 255);
		display: flex;
		flex-grow: 1;
		height: 50vh;
		justify-content: center;
		padding: 5%;
		position: sticky;
		top: 0;
		unicode-bidi: isolate;
		transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		-webkit-font-smoothing: antialiased;
		box-sizing: border-box;
		align-self: flex-start;
	}

	@media (min-width: 1024px) {
		.artwork-canvas {
			height: calc(100vh - var(--navbar-height));
			padding-left: 0px;
			padding-right: 48px;
			top: 0;
		}
	}

	.nft-media {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), aspect-ratio 0.4s ease-out;
		position: relative;
		box-sizing: inherit;
		max-width: 100%;
		max-height: 100%;
		width: 100%;
		height: 100%;
	}

	.info-container {
		flex-grow: 0;
		flex-shrink: 0;
		gap: 24px;
		display: flex;
		flex-direction: column;
		color: white;
	}

	@media (min-width: 1024px) {
		.info-container {
			padding-top: 48px;
			padding-left: 48px;
			padding-right: 0;
			padding-bottom: 48px;
			min-width: 464px;
			max-width: 464px;
			gap: 24px;
			border-left: 1px solid rgba(255, 255, 255, 0.1);
		}
	}

	.media-container {
		transition: opacity 1000ms cubic-bezier(0.23, 1, 0.32, 1), transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
		will-change: opacity, transform;
		cursor: zoom-in;
		position: relative;
		max-height: 100%;
		max-width: 100%;
		box-sizing: inherit;
		overflow: hidden;
	}

	.isMediaLoaded-false .media-container {
		opacity: 0;
		transform: scale(0.8);
	}

	.isMediaLoaded-true .media-container {
		opacity: 1;
		transform: scale(1);
	}

	/* Artwork header styles */
	.artwork-header {
		display: flex;
		flex-direction: column;
		gap: 16px;
		position: relative;
	}

	.artist-info {
		margin-bottom: 8px;
	}

	.artist-name {
		font-size: 16px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #fbbf24;
	}

	.artwork-title {
		font-size: 32px;
		font-weight: 600;
		line-height: 1.2;
		margin: 0;
		color: white;
	}

	.artwork-navigation {
		position: absolute;
		top: -8px;
		right: 0;
		display: flex;
		gap: 8px;
	}

	.nav-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: rgba(0, 0, 0, 0.6);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: background-color 0.2s;
		font-size: 18px;
	}

	.nav-button:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	/* Content styles */
	.artwork-description {
		color: #d1d5db;
		line-height: 1.6;
	}

	.artwork-description p {
		margin: 0;
	}

	.metadata-section {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.metadata-heading {
		font-size: 18px;
		font-weight: 600;
		color: white;
		margin: 0;
	}

	.metadata-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
	}

	@media (min-width: 768px) {
		.metadata-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.metadata-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}

	.metadata-item strong {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #9ca3af;
		font-weight: 500;
	}

	.metadata-item span,
	.metadata-item a {
		font-size: 14px;
		color: #f3f4f6;
		word-break: break-word;
	}

	.contract-link {
		color: #fbbf24;
		text-decoration: none;
		transition: color 0.2s;
	}

	.contract-link:hover {
		color: #f59e0b;
		text-decoration: underline;
	}

	/* Keyboard shortcuts */
	.keyboard-shortcuts-section {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.keyboard-help-trigger {
		display: flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: #9ca3af;
		padding: 12px 16px;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 14px;
	}

	.keyboard-help-trigger:hover {
		color: #d1d5db;
		border-color: rgba(255, 255, 255, 0.3);
	}

	/* Error and loading states */
	.error-page,
	.loading-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		background: black;
		color: white;
	}

	.error-content,
	.loading-content {
		text-align: center;
		padding: 32px;
	}

	.error-content h2 {
		font-size: 24px;
		margin-bottom: 16px;
	}

	.error-content button {
		background: #fbbf24;
		color: black;
		border: none;
		padding: 12px 24px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		margin-top: 16px;
	}

	.loader {
		border: 4px solid #444;
		border-top: 4px solid #fff;
		border-radius: 50%;
		width: 36px;
		height: 36px;
		animation: spin 1s linear infinite;
		margin: 0 auto 16px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Keyboard help overlay */
	.keyboard-help-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
	}

	.keyboard-help-content {
		background: #1f2937;
		padding: 32px;
		border-radius: 8px;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
		max-width: 600px;
		max-height: 80vh;
		overflow-y: auto;
		color: white;
	}

	.keyboard-help-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.keyboard-help-header h3 {
		font-size: 20px;
		font-weight: 600;
		margin: 0;
	}

	.help-close-button {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.help-close-button:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.keyboard-help-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 24px;
	}

	.help-section h4 {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 12px;
		color: #fbbf24;
	}

	.help-item {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 8px;
	}

	.help-item kbd {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		background: rgba(255, 255, 255, 0.1);
		color: white;
		font-size: 12px;
		font-family: monospace;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		min-width: 32px;
		justify-content: center;
	}

	.help-item span {
		font-size: 14px;
		color: #d1d5db;
	}

	/* Fullscreen hint */
	.fullscreen-hint {
		position: fixed;
		top: 16px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
	}

	.fullscreen-hint-content {
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 12px 20px;
		border-radius: 6px;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	.fullscreen-hint-content p {
		font-size: 14px;
		font-weight: 500;
		margin: 0;
	}
</style> 