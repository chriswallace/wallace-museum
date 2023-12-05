<script>
	import { page } from '$app/stores';
	import { selectedArtwork, isMaximized, isLiveCodeVisible } from '$lib/stores';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { closeFullscreen } from '$lib/artworkActions';
	import { onMount } from 'svelte';

	export let data;

	let container;
	let artworkRefs = [];
	let loadingStates = {};

	data.artworks.forEach((artwork, index) => {
		loadingStates[artwork.id] = true; // Initially set to true
		artworkRefs[index] = null; // Initialize the refs
	});

	onMount(() => {
		data.artworks.forEach((artwork, index) => {
			setSrcSetAndSizes(artwork, artworkRefs[index]);
		});
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	beforeNavigate(() => {
		selectedArtwork.resetSelected();
	});

	afterNavigate(() => {
		data.artworks.forEach((artwork, index) => {
			setSrcSetAndSizes(artwork, artworkRefs[index]);
		});
	});

	$: if (data.artworks) {
		openDetail(data.artworks[0], 0);
	}

	$: $page.path, resetScrollPosition();

	function resetScrollPosition() {
		if (container && data.artworks && data.artworks.length > 0) {
			if (artworkRefs[0]) {
				const firstArtworkElement = artworkRefs[0];
				setTimeout(() => {
					firstArtworkElement.click();
				}, 200);
			}
		}
	}

	function openDetail(artwork, index) {
		selectedArtwork.setSelected(artwork);
		centerArtwork(index);
	}

	function centerArtwork(index) {
		const artworkElement = artworkRefs[index];
		if (artworkElement && container) {
			const scrollX =
				artworkElement.offsetLeft - container.offsetWidth / 2 + artworkElement.offsetWidth / 2;
			container.scrollTo({ left: scrollX, behavior: 'smooth' });
		}
	}

	function handleKeyDown(event) {
		if (event.key === 'Escape' && get(isMaximized)) {
			closeFullscreen();
		}
	}

	function setSrcSetAndSizes(artwork, artworkRef) {
		if (!artworkRef || !artworkRef.clientWidth) return;

		let newSrc;

		const renderedWidth = artworkRef.clientWidth;
		const base_url = 'https://ik.imagekit.io/UltraDAO/wallace_collection/';
		const img_name = artwork.image.split('/').pop().split('?')[0];

		if (artwork.dimensions.width && artwork.dimensions.width <= renderedWidth) {
			newSrc = `${base_url}${img_name}?tr=q-70`;
		} else {
			let size_1x = renderedWidth,
				size_2x = renderedWidth * 2,
				size_3x = renderedWidth * 3,
				size_4x = renderedWidth * 4;

			if (artwork.dimensions.width) {
				size_1x = Math.min(artwork.dimensions.width, size_1x);
				size_2x = Math.min(artwork.dimensions.width, size_2x);
				size_3x = Math.min(artwork.dimensions.width, size_3x);
				size_4x = Math.min(artwork.dimensions.width, size_4x);
			}

			const srcsetStr = `${base_url}${img_name}?tr=w-${size_1x},q-70 1x,
							${base_url}${img_name}?tr=w-${size_2x},q-70 2x,
							${base_url}${img_name}?tr=w-${size_3x},q-70 3x`;

			// This should reflect your actual layout rules in your CSS
			const sizesStr = `(max-width: 400px) ${size_1x}px,
						(max-width: 800px) ${size_2x}px,
						(max-width: 1200px) ${size_3x}px,
						${size_4x}px`;

			const updatedArtwork = {
				...artwork,
				src: newSrc,
				srcset: srcsetStr,
				sizes: sizesStr
			};

			const index = data.artworks.findIndex((a) => a.id === artwork.id);
			data.artworks[index] = updatedArtwork;
		}
	}
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<div class="h-[100vh] gap-8 relative">
	<div bind:this={container} class="artwork-container">
		{#each data.artworks as artwork, index}
			<div
				data-artwork-id={artwork.id}
				bind:this={artworkRefs[index]}
				class:highlighted={$selectedArtwork && $selectedArtwork.id === artwork.id}
				class:hidden={$selectedArtwork && $selectedArtwork.id !== artwork.id}
				class:maximized={$isMaximized}
				class="artwork-item"
				on:click={() => openDetail(artwork, index)}
				tabindex="0"
				aria-role="button"
			>
				<button class="close icon-button" on:click={closeFullscreen}>Close</button>
				{#if $selectedArtwork && $selectedArtwork.id === artwork.id && artwork.liveUri && $isLiveCodeVisible}
					<iframe
						src={artwork.liveUri}
						class="live-code"
						style="aspect-ratio: {artwork.dimensions.width}/{artwork.dimensions.height};"
						height={artwork.dimensions.height}
						width={artwork.dimensions.width}
						onload={() => (loadingStates[artwork.id] = false)}
					></iframe>
				{:else if artwork.video && artwork.video.length > 0}
					<video autoplay muted>
						<source
							src={artwork.video}
							type="video/mp4"
							style="aspect-ratio: {artwork.dimensions.width}/{artwork.dimensions.height};"
							height={artwork.dimensions.height}
							width={artwork.dimensions.width}
							on:loadeddata={() => (loadingStates[artwork.id] = false)}
						/>
						Your browser does not support the video tag.
					</video>
				{:else}
					<img
						bind:this={artworkRefs[artwork.id]}
						src={artwork.image}
						alt={artwork.title}
						srcset={artwork.srcset}
						sizes={artwork.sizes}
						style="aspect-ratio: {artwork.dimensions.width}/{artwork.dimensions.height};"
						on:load={() => (loadingStates[artwork.id] = false)}
					/>
				{/if}
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	.fade-out {
		opacity: 0;
		transition: opacity 0.3s ease-out;
	}
	.fade-in {
		opacity: 1;
		transition: opacity 0.3s ease-in;
	}

	.artwork-container {
		@apply h-screen flex overflow-x-auto justify-items-center items-center;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch; /* For smooth scrolling on touch devices */
	}

	.artwork-item {
		@apply h-screen mx-4 flex justify-items-center items-center;
		flex: 0 0 auto; /* Adjust this as needed, depending on your layout */
		scroll-snap-align: center; /* Align the start edge of the element with the container's snapport */

		img,
		video {
			transition: opacity 0.125s ease-in-out;
		}
	}

	.loading-animation {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	:global {
		body > .artwork-item.highlighted {
			margin-left: 0 !important;
		}

		body > .artwork-item.highlighted img,
		body > .artwork-item.highlighted video,
		body > .artwork-item.highlighted iframe {
			max-height: 92vh !important;
			max-width: 92vw !important;
		}
	}

	.artwork-item img,
	.artwork-item video,
	.artwork-item iframe {
		@apply max-h-[65%] max-w-[55vw] w-full h-full mx-auto;
		object-fit: contain;
	}

	.artwork-item:first-child {
		@apply ml-[25%];
	}

	.artwork-item:last-child {
		@apply mr-[25%];
	}

	.artwork-item:first-child:last-child {
		@apply ml-0 mr-0 w-full;
	}

	.artwork-item {
		transition:
			transform 0.3s ease,
			opacity 0.3s ease;
	}

	.close {
		@apply absolute hidden overflow-hidden;
		background-image: url('/images/close.svg');
		position: absolute;
		top: 16px;
		right: 16px;
		width: 36px;
		height: 36px;
		background-size: 36px;
		cursor: pointer;
		font-size: 1.5rem;
		z-index: 1010;
		text-indent: 100%;
	}

	.maximized .close {
		@apply block;
	}

	@media (prefers-color-scheme: dark) {
		.close {
			background-image: url('/images/close-dark-mode.svg');
		}
	}
</style>
