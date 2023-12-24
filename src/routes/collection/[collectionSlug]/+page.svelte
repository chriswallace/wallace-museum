<script>
	import { page } from '$app/stores';
	import { selectedArtwork, isMaximized, isLiveCodeVisible } from '$lib/stores';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { closeFullscreen, handleMaximize } from '$lib/artworkActions';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	export let data;

	let container;
	let artworkRefs = [];
	let loadingStates = {};

	data.artworks.forEach((artwork, index) => {
		loadingStates[artwork.id] = true; // Initially set to true
		artworkRefs[index] = null; // Initialize the refs
	});

	onMount(() => {
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
		openDetail(data.artworks[0]);
	}

	$: $page.path, resetScrollPosition();

	$: loadedClasses = {};

	$: artworkDetails = $selectedArtwork;

	$: Object.keys(loadingStates).forEach((id) => {
		loadedClasses[id] = loadingStates[id] ? '' : 'loaded';
	});

	function toggleMaximize(artworkId) {
		if (artworkId) {
			handleMaximize(artworkId);
		}
	}

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

	function handleMediaLoad(artworkId) {
		console.log(`Media loaded for artwork ID: ${artworkId}`);

		loadingStates[artworkId] = false;
		loadingStates = { ...loadingStates }; // Reassign the object to trigger reactivity
		setSrcSetAndSizes(artworkRefs[artworkId], artworkId);
	}

	function openDetail(artwork) {
		selectedArtwork.setSelected(artwork);
		if (artwork) centerArtwork(artwork.id);
	}

	function centerArtwork(artworkId) {
		if (container) {
			const artworkElement = container.querySelector(`[data-artwork-id="${artworkId}"]`);
			if (artworkElement && container) {
				const scrollX =
					artworkElement.offsetLeft - container.offsetWidth / 2 + artworkElement.offsetWidth / 2;
				container.scrollTo({ left: scrollX, behavior: 'smooth' });
			}
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

			const updatedArtwork = {
				...artwork,
				src: newSrc,
				srcset: srcsetStr
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
				in:fade={{ duration: 300 }}
				out:fade={{ duration: 300 }}
				bind:this={artworkRefs[index]}
				on:click={() => openDetail(artwork)}
				class:highlighted={$selectedArtwork && $selectedArtwork.id === artwork.id}
				class:maximized={$isMaximized}
				class="artwork-item {loadedClasses[artwork.id]}"
				style="aspect-ratio: {artwork.dimensions.width}/{artwork.dimensions.height};"
				tabindex="0"
				aria-role="button"
			>
				<button class="close icon-button" on:click={closeFullscreen}>Close</button>
				<div
					class="media-container"
					style="aspect-ratio: {artwork.dimensions.width}/{artwork.dimensions.height};"
				>
					{#if $selectedArtwork && $selectedArtwork.id === artwork.id && artwork.liveUri && $isLiveCodeVisible}
						<iframe
							src={artwork.liveUri}
							class="live-code"
							on:load={() => handleMediaLoad(artwork.id)}
						></iframe>
					{:else if artwork.video && artwork.video.length > 0}
						<video autoplay muted on:loadeddata={() => handleMediaLoad(artwork.id)}>
							<source
								src={artwork.video}
								type="video/mp4"
								height={artwork.dimensions.height}
								width={artwork.dimensions.width}
							/>
							Your browser does not support the video tag.
						</video>
					{:else if artwork.image}
						<img
							bind:this={artworkRefs[artwork.id]}
							src={artwork.image}
							alt={artwork.title}
							srcset={artwork.srcset}
							sizes={artwork.sizes}
							on:load={() => handleMediaLoad(artwork.id)}
						/>
					{/if}

					{#if $selectedArtwork && $selectedArtwork.id === artwork.id && !$isMaximized}
						<a
							href="#"
							class="maximize icon-button"
							on:click|preventDefault={() => toggleMaximize(artwork.id)}
						>
							View Full Screen
						</a>
					{/if}
				</div>
			</div>
		{/each}
	</div>
</div>

<style lang="scss">
	.artwork-container {
		@apply h-screen flex overflow-x-auto justify-items-center items-center;
		scroll-snap-type: x mandatory;
		-webkit-overflow-scrolling: touch; /* For smooth scrolling on touch devices */
	}

	.artwork-item {
		@apply h-screen mx-4 flex justify-items-center items-center max-h-[85vh] max-w-[calc(100vw-560px)] lg:max-w-[calc(100vw-640px)] z-10 relative;
		flex: 0 0 auto; /* Adjust this as needed, depending on your layout */
		scroll-snap-align: center; /* Align the start edge of the element with the container's snapport */
		transition:
			transform 0.3s ease,
			opacity 0.3s ease;

		&:first-child {
			@apply ml-[25%];
		}

		&:last-child {
			@apply mr-[25%];
		}

		&:first-child:last-child {
			@apply mx-auto;
		}

		&:before {
			content: '';
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			z-index: 20;
			height: 5px;
			width: 5px;
			color: #000;
			box-shadow:
				-10px -10px 0 5px,
				-10px -10px 0 5px,
				-10px -10px 0 5px,
				-10px -10px 0 5px;
			animation: loader-38 6s infinite;
			transition: opacity 0.125s linear;
		}

		.media-container {
			@apply mx-auto w-full relative;
		}

		img,
		video,
		iframe {
			@apply h-full w-full opacity-0;
			transition: opacity 0.125s linear;
		}

		&.maximized {
			@apply flex flex-col justify-center items-center bg-white;

			.media-container {
				@apply max-h-[85vh] max-w-[85vw] h-full w-auto;
			}

			img,
			video,
			iframe {
				@apply max-h-full max-w-full object-contain;
			}
		}

		&.loaded {
			&:before {
				content: none;
			}

			img,
			video,
			iframe {
				opacity: 0.6;
			}
		}

		&.loaded.highlighted {
			img,
			video,
			iframe {
				opacity: 1;
			}
		}
	}

	.close {
		@apply absolute hidden overflow-hidden bg-white;
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
		border-radius: 9px;
	}

	.maximized .close {
		@apply block;
	}

	.maximize {
		@apply left-[50%] transform translate-x-[-50%] absolute -bottom-10;

		.maximized & {
			@apply hidden;
		}
	}

	@media (prefers-color-scheme: dark) {
		.artwork-item:before {
			color: #fff;
		}
		.artwork-item.maximized {
			@apply bg-black;
		}

		.close {
			@apply bg-black;
			background-image: url('/images/close-dark-mode.svg');
		}
	}
</style>
