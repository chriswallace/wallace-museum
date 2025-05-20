<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import type { ArtistWithPreview as Artist } from './+page.server'; // Updated import
	import ArtworkBrowser from '$lib/components/ArtworkBrowser.svelte'; // Import the new component

	let hoveredArtist: Artist | null = null;
	let selectedArtist: Artist | null = null;
	let overlayContentElement: HTMLElement | null = null; // To bind to the scrollable div

	function handleArtistHover(artist: Artist) {
		hoveredArtist = artist;
	}

	function clearArtistHover() {
		hoveredArtist = null;
	}

	function handleArtistClick(artist: Artist) {
		selectedArtist = artist;
	}

	function closeOverlay() {
		selectedArtist = null;
	}
</script>

<div class="homepage-container">
	<h1>Artists</h1>
	{#if data.artists && data.artists.length > 0}
		<ul class="artist-list">
			{#each data.artists as artist (artist.id)}
				<li
					class="artist-item"
					on:mouseenter={() => handleArtistHover(artist)}
					on:mouseleave={clearArtistHover}
					on:click={() => handleArtistClick(artist)}
					on:focus={() => handleArtistHover(artist)}
					on:blur={clearArtistHover}
					tabindex="0"
					role="button"
					aria-label={`View artworks by ${artist.name}`}
				>
					<span>{artist.name}</span>
					{#if hoveredArtist === artist && artist.previewArtwork && artist.previewArtwork.image_url}
						<div class="artwork-preview">
							<img
								src={artist.previewArtwork.image_url}
								alt={`Preview of ${artist.previewArtwork.title}`}
							/>
							<p>{artist.previewArtwork.title}</p>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p>No artists found.</p>
	{/if}
</div>

{#if selectedArtist}
	<div class="artwork-overlay" role="dialog" aria-modal="true" aria-labelledby="overlay-title">
		<button class="close-button" on:click={closeOverlay} aria-label="Close artwork browser">
			X
		</button>
		<div class="overlay-content" bind:this={overlayContentElement}>
			<h2 id="overlay-title" class="sr-only">Artworks by {selectedArtist.name}</h2>
			{#if overlayContentElement}
				<!-- Ensure element is bound before passing -->
				<ArtworkBrowser
					artistId={selectedArtist.id}
					artistName={selectedArtist.name}
					scrollRootElement={overlayContentElement}
				/>
			{/if}
		</div>
	</div>
{/if}

<style lang="scss">
	.homepage-container {
		padding: 2rem;
		text-align: center;
	}

	h1 {
		font-size: 3rem;
		margin-bottom: 2rem;
		font-family: 'europa', sans-serif; // Example of a modern font
		font-weight: 300;
	}

	.artist-list {
		list-style: none;
		padding: 0;
		display: flex; // Changed from grid
		flex-direction: column; // Stack items vertically
		align-items: stretch; // Make items take full width of this container
		gap: 0.75rem; // Space between artist items
		max-width: 700px; // Max width for the list itself
		margin: 0 auto 2rem auto; // Center the list container and add bottom margin
	}

	.artist-item {
		padding: 1.25rem 1.5rem; // Adjusted padding
		// border: 1px solid #333; // Removed border
		border-radius: 4px; // Optional: slight radius for a softer look if background is kept
		cursor: pointer;
		transition: background-color 0.2s ease; // Simpler transition
		position: relative; // For positioning the preview
		background-color: #1c1c1c; // Slightly different subtle background
		text-align: left; // Align text to the left

		span {
			font-size: 1.5rem;
			color: #eee;
			font-family: 'europa', sans-serif;
			font-weight: 400;
			transition: color 0.2s ease;
		}

		&:hover,
		&:focus {
			background-color: #282828; // Darker subtle hover
			// transform: translateY(-5px); // Removed transform
			// box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4); // Removed box-shadow
			outline: none; // Remove default focus outline if custom focus style is desired

			span {
				color: rgb(68, 240, 114); // Highlight text on hover/focus
			}
		}
		&:focus-visible {
			// Modern way to handle focus rings for accessibility
			outline: 2px solid rgb(68, 240, 114);
			outline-offset: 2px;
		}
	}

	.artwork-preview {
		position: absolute;
		top: 100%;
		left: 50%;
		transform: translateX(-50%) translateY(10px); // Position below the item
		width: 200px; // Adjust as needed
		background-color: #222; // Slightly different dark shade
		border: 1px solid #444;
		border-radius: 4px;
		padding: 0.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 10;
		opacity: 0;
		visibility: hidden;
		transition:
			opacity 0.3s ease,
			visibility 0.3s ease;

		img {
			width: 100%;
			height: auto;
			border-radius: 3px;
			margin-bottom: 0.5rem;
		}

		p {
			font-size: 0.9rem;
			color: #ccc;
			text-align: center;
			margin: 0;
		}
	}

	.artist-item:hover .artwork-preview,
	.artist-item:focus .artwork-preview {
		opacity: 1;
		visibility: visible;
	}

	.artwork-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.95); // Slightly more opaque for better focus
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000; // Ensure it's above other elements like previews
		padding: 1rem; // Reduced padding for more content space
		box-sizing: border-box;
		opacity: 0;
		visibility: hidden;
		animation: fadeIn 0.3s forwards;

		.overlay-content {
			background-color: #101010; // Slightly darker than artist items
			padding: 1.5rem; // Adjusted padding
			border-radius: 6px;
			width: 95%; // Take more width
			max-width: 1400px; // Allow wider content
			height: 95%; // Take more height
			max-height: 90vh; // Max height relative to viewport
			overflow-y: auto; // IMPORTANT: This enables scrolling for reveal
			position: relative;
			color: #eee;
			box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
			display: flex; // Added for structuring content if needed
			flex-direction: column; // Stack title/browser vertically
		}

		.close-button {
			position: absolute;
			top: 1rem; // Closer to edge
			right: 1rem; // Closer to edge
			background: rgba(30, 30, 30, 0.7);
			border: 1px solid #444;
			color: #ccc;
			font-size: 1.5rem; // Slightly smaller, more refined
			cursor: pointer;
			padding: 0.3rem 0.8rem;
			line-height: 1;
			border-radius: 4px;
			z-index: 1010; // Above overlay content
			transition: all 0.2s ease;

			&:hover,
			&:focus {
				background-color: rgba(50, 50, 50, 0.9);
				color: #fff;
				border-color: #666;
			}
		}
	}

	// Animation for overlay
	@keyframes fadeIn {
		to {
			opacity: 1;
			visibility: visible;
		}
	}

	// Helper for screen-reader only text
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
