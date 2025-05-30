<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import { ipfsToHttpUrl } from '$lib/mediaUtils';
	import OptimizedImage from './OptimizedImage.svelte';

	export let artistId: number;
	export let artistName: string;
	export let scrollRootElement: HTMLElement; // The scrollable ancestor from +page.svelte

	// Using the same Artwork interface as in the +server.ts for consistency
	interface Artwork {
		id: string;
		title: string;
		imageUrl: string; // Original URL that needs transformation
		animationUrl?: string; // Optional animation URL
		description?: string;
		year?: number;
		artistId: string;
	}

	let artworks: Artwork[] = [];
	let currentArtworkIndex = 0;
	let isLoading = true;
	let error: string | null = null;

	let artworkDetailsSectionElement: HTMLElement;
	let detailsAreVisible = false; // Used to add/remove a class for reveal styling
	let observer: IntersectionObserver | null = null;

	// Transform URL for display
	$: currentArtwork = artworks[currentArtworkIndex];
	$: displayImageUrl = currentArtwork?.imageUrl || '';
	$: displayAnimationUrl = currentArtwork?.animationUrl ? ipfsToHttpUrl(currentArtwork.animationUrl) : '';

	async function fetchArtworks() {
		isLoading = true;
		error = null;
		try {
			const response = await fetch(`/api/artists/${artistId}/artworks`);
			if (!response.ok) {
				throw new Error(`Failed to fetch artworks: ${response.statusText}`);
			}
			artworks = await response.json();
			currentArtworkIndex = 0; // Reset to first artwork
			detailsAreVisible = false; // Reset visibility for new artist/artworks
		} catch (e: any) {
			error = e.message || 'Could not load artworks.';
			console.error(e);
			artworks = []; // Clear artworks on error
		} finally {
			isLoading = false;
		}
	}

	onMount(async () => {
		await fetchArtworks();
	});

	function setupIntersectionObserver() {
		if (observer) observer.disconnect(); // Clean up previous observer

		if (!artworkDetailsSectionElement || !scrollRootElement) return;

		const options = {
			root: scrollRootElement,
			rootMargin: '0px',
			threshold: 0.1 // Trigger when 10% of the element is visible
		};

		observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					detailsAreVisible = true;
				} else {
					// Optional: Hide again if scrolled back up above the threshold
					// detailsAreVisible = false;
				}
			});
		}, options);

		observer.observe(artworkDetailsSectionElement);
	}

	afterUpdate(() => {
		// Re-setup observer if the element is available and currentArtwork exists
		// This is important if artworkDetailsSectionElement is conditionally rendered
		if (currentArtwork && artworkDetailsSectionElement && scrollRootElement) {
			setupIntersectionObserver();
		} else if (observer) {
			observer.disconnect(); // Disconnect if no artwork or element
		}
	});

	onDestroy(() => {
		if (observer) {
			observer.disconnect();
		}
	});

	function showNextArtwork() {
		if (artworks.length === 0) return;
		currentArtworkIndex = (currentArtworkIndex + 1) % artworks.length;
		detailsAreVisible = false; // Reset visibility for the new artwork's details
		// The afterUpdate hook will re-setup the observer for the new details section if it renders
	}

	function showPreviousArtwork() {
		if (artworks.length === 0) return;
		currentArtworkIndex = (currentArtworkIndex - 1 + artworks.length) % artworks.length;
		detailsAreVisible = false; // Reset visibility
	}

	// Keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') {
			showNextArtwork();
		} else if (event.key === 'ArrowLeft') {
			showPreviousArtwork();
		}
	}

	// When artistId changes, re-fetch artworks
	$: if (artistId && artworks.length > 0 && String(artworks[0]?.artistId) !== String(artistId)) {
		fetchArtworks();
	} else if (artistId && artworks.length === 0 && !isLoading && !error) {
		// If artistId is present, no artworks, not loading, and no error, means initial load for this artistId might be needed
		// This handles the case where the component might be mounted without artistId initially, then it updates
		// However, onMount should generally handle the first load.
		// This reactive statement primarily handles changes to artistId AFTER the initial mount.
		fetchArtworks();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="artwork-browser-wrapper">
	{#if isLoading}
		<p class="loading-message">Loading artworks for {artistName}...</p>
	{:else if error}
		<p class="error-message">Error: {error}</p>
	{:else if artworks.length === 0}
		<p class="empty-message">No artworks found for {artistName}.</p>
	{:else if currentArtwork}
		<div class="artwork-display-area">
			<button
				class="nav-button prev-button"
				on:click={showPreviousArtwork}
				aria-label="Previous artwork"
				disabled={artworks.length <= 1}
			>
				&lt;
			</button>
			<div class="artwork-image-container">
				<OptimizedImage 
					src={displayImageUrl} 
					alt={currentArtwork.title} 
					className="current-artwork-image"
					width={800}
					responsive={true}
					responsiveSizes={[400, 800, 1200]}
					sizes="(max-width: 768px) 100vw, 80vw"
					fit="contain"
					format="webp"
					quality={90}
				/>
			</div>
			<button
				class="nav-button next-button"
				on:click={showNextArtwork}
				aria-label="Next artwork"
				disabled={artworks.length <= 1}
			>
				&gt;
			</button>
		</div>

		<!-- This container's parent (in +page.svelte) will handle the overall scroll for the overlay -->
		<div
			class="artwork-details-section"
			bind:this={artworkDetailsSectionElement}
			class:revealed={detailsAreVisible}
		>
			<h3 class="artwork-title">{currentArtwork.title}</h3>
			{#if currentArtwork.year}
				<p class="artwork-year">{currentArtwork.year}</p>
			{/if}
			{#if currentArtwork.description}
				<p class="artwork-description">{currentArtwork.description}</p>
			{/if}
			<!-- More details can be added here -->
		</div>
	{/if}
</div>

<style lang="scss">
	.artwork-browser-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		height: 100%; // Take full height of its container in the overlay
		justify-content: flex-start; // Align items to the start, main image at top
		position: relative; // For positioning nav buttons if needed
	}

	.loading-message,
	.error-message,
	.empty-message {
		font-size: 1.2rem;
		color: #ccc;
		margin-top: 2rem;
	}

	.artwork-display-area {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		max-width: 900px; // Max width for the image display area
		margin-bottom: 1rem; // Space between image and details placeholder
		padding: 1rem 0; // Padding for nav buttons not to stick to edges
		position: relative;
		// Ensure this area doesn't shrink when details are hidden
		min-height: 420px; // Approximate height of image container + padding
	}

	.artwork-image-container {
		flex-grow: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		width: calc(100% - 120px); // Adjusted for slightly larger nav buttons or spacing
		height: 400px;
		overflow: hidden;
	}

	.current-artwork-image {
		max-width: 100%;
		max-height: 100%;
		object-fit: contain; // Scale image nicely within the container
		border-radius: 4px;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
	}

	.nav-button {
		background-color: rgba(50, 50, 50, 0.7);
		color: white;
		border: none;
		padding: 0.8rem 1.2rem;
		font-size: 1.8rem;
		cursor: pointer;
		border-radius: 50%;
		transition:
			background-color 0.2s ease,
			opacity 0.2s ease;
		width: 50px;
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		z-index: 5; // Ensure nav buttons are above artwork image if overlapping slightly

		&:hover:not([disabled]) {
			background-color: rgba(80, 80, 80, 0.9);
		}

		&:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}
	}

	// Position nav buttons. Could also be absolute within .artwork-display-area
	// For simplicity, they are part of the flex layout here.
	// .prev-button { margin-right: 1rem; }
	// .next-button { margin-left: 1rem; }

	.artwork-details-section {
		width: 100%;
		max-width: 700px; // Details can be a bit narrower
		text-align: left;
		padding: 1.5rem;
		margin-top: auto; // Pushes details to the bottom if content above is shorter
		background-color: #181818; // Slightly different background for visual separation
		border-top: 1px solid #2a2a2a;
		color: #ddd;
		opacity: 0;
		transform: translateY(30px);
		transition:
			opacity 0.5s cubic-bezier(0.25, 0.8, 0.25, 1),
			transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1);
		// Ensure it takes space even when hidden to prevent layout jump
		// min-height: 100px; // Or some other appropriate value
		z-index: 10; // To ensure it comes to the forefront

		&.revealed {
			opacity: 1;
			transform: translateY(0);
			box-shadow: 0 -5px 20px rgba(0, 0, 0, 0.3); // Shadow to emphasize forefront
		}
	}

	.artwork-title {
		font-size: 2rem; // Larger title
		font-weight: 300;
		font-family: 'europa', sans-serif;
		margin-bottom: 0.75rem;
		color: #fff;
	}

	.artwork-year {
		font-size: 1rem;
		color: #aaa;
		margin-bottom: 1.2rem;
	}

	.artwork-description {
		font-size: 1.1rem; // Slightly larger description
		line-height: 1.7;
		color: #ccc;
	}
</style>
