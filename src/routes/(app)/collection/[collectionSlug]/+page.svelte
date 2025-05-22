<script lang="ts">
	import { page } from '$app/stores';
	import { selectedArtwork, isMaximized, isLiveCodeVisible } from '$lib/stores';
	import type { Artwork } from '$lib/stores';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { get } from 'svelte/store';
	import { closeFullscreen, handleMaximize } from '$lib/artworkActions';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';

	export let data: { title: string; artworks: Artwork[] };

	let container: HTMLDivElement | null = null;
	let artworkRefs: (HTMLDivElement | null)[] = [];
	let loadingStates: { [key: string]: boolean } = {};

	if (data.artworks) {
		data.artworks.forEach((artwork) => {
			loadingStates[String(artwork.id)] = true;
		});
		artworkRefs = Array(data.artworks.length).fill(null);
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		if (data.artworks && data.artworks.length > 0) {
			openDetail(data.artworks[0]);
			data.artworks.forEach((artwork, index) => {
				setTimeout(() => {
					if (artworkRefs[index]) {
						setSrcSetAndSizes(artwork, artworkRefs[index] as HTMLDivElement);
					}
				}, 0);
			});
		}
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	beforeNavigate(() => {
		selectedArtwork.resetSelected();
	});

	$: $page.url.pathname, resetScrollPosition();

	$: loadedClasses = (() => {
		const classes: { [key: string]: string } = {};
		Object.keys(loadingStates).forEach((id) => {
			classes[id] = loadingStates[id] ? '' : 'loaded';
		});
		return classes;
	})();

	$: artworkDetails = $selectedArtwork as Artwork | null;

	function toggleMaximize(artworkId: number | string) {
		if (artworkId) {
			handleMaximize(String(artworkId));
		}
	}

	function resetScrollPosition() {
		if (container && data.artworks && data.artworks.length > 0) {
			const firstArtworkElement = container.querySelector('[data-artwork-id]');
			if (firstArtworkElement instanceof HTMLElement) {
				setTimeout(() => {
					firstArtworkElement.click();
				}, 200);
			}
		}
	}

	function handleMediaLoad(artworkId: number | string) {
		const idStr = String(artworkId);
		loadingStates[idStr] = false;
		loadingStates = { ...loadingStates };
		const artworkIndex = data.artworks.findIndex((a) => String(a.id) === idStr);
		if (artworkIndex !== -1 && artworkRefs[artworkIndex]) {
			setSrcSetAndSizes(data.artworks[artworkIndex], artworkRefs[artworkIndex] as HTMLDivElement);
		}
	}

	function openDetail(artwork: Artwork | null) {
		selectedArtwork.setSelected(artwork);
		if (artwork) centerArtwork(artwork.id);
	}

	function centerArtwork(artworkId: number | string) {
		if (container) {
			const artworkElement = container.querySelector(`[data-artwork-id="${artworkId}"]`);
			if (artworkElement instanceof HTMLElement && container) {
				const scrollX =
					artworkElement.offsetLeft - container.offsetWidth / 2 + artworkElement.offsetWidth / 2;
				container.scrollTo({ left: scrollX, behavior: 'smooth' });
			}
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape' && get(isMaximized)) {
			closeFullscreen();
		}
		const currentArtwork = get(selectedArtwork);
		if (!currentArtwork) return;

		const currentIndex = data.artworks.findIndex((artwork) => artwork.id === currentArtwork.id);

		if (event.key === 'ArrowRight') {
			const nextIndex = currentIndex + 1;
			if (nextIndex < data.artworks.length) {
				openDetail(data.artworks[nextIndex]);
			}
		}
		if (event.key === 'ArrowLeft') {
			const prevIndex = currentIndex - 1;
			if (prevIndex >= 0) {
				openDetail(data.artworks[prevIndex]);
			}
		}
	}

	function setSrcSetAndSizes(artwork: Artwork, artworkRef: HTMLDivElement) {
		if (!artworkRef || !artworkRef.clientWidth || !artwork.image_url || !artwork.dimensions) return;

		let newSrc: string | undefined = undefined;
		let srcsetStr = '';
		const renderedWidth = Math.round(artworkRef.clientWidth);

		const baseTransform = 'q_auto,f_auto';

		if (artwork.dimensions.width && artwork.dimensions.width <= renderedWidth) {
			newSrc = getCloudinaryTransformedUrl(
				artwork.image_url,
				`${baseTransform},w_${artwork.dimensions.width}`
			);
			srcsetStr = `${newSrc} 1x`;
		} else {
			let size_1x = renderedWidth;
			let size_2x = renderedWidth * 2;
			let size_3x = renderedWidth * 3;

			if (artwork.dimensions.width) {
				size_1x = Math.min(artwork.dimensions.width, size_1x);
				size_2x = Math.min(artwork.dimensions.width, size_2x);
				size_3x = Math.min(artwork.dimensions.width, size_3x);
			}

			const url_1x = getCloudinaryTransformedUrl(
				artwork.image_url,
				`${baseTransform},w_${size_1x}`
			);
			const url_2x = getCloudinaryTransformedUrl(
				artwork.image_url,
				`${baseTransform},w_${size_2x}`
			);
			const url_3x = getCloudinaryTransformedUrl(
				artwork.image_url,
				`${baseTransform},w_${size_3x}`
			);

			srcsetStr = `${url_1x} 1x, ${url_2x} 2x, ${url_3x} 3x`;
			newSrc = url_1x;
		}

		const index = data.artworks.findIndex((a) => a.id === artwork.id);
		if (index !== -1) {
			const updatedArtworks = [...data.artworks];
			updatedArtworks[index] = {
				...updatedArtworks[index],
				src: newSrc,
				srcset: srcsetStr,
				sizes: `(max-width: ${renderedWidth * 1.5}px) 100vw, ${renderedWidth}px`
			};
			data.artworks = updatedArtworks;
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
				class="artwork-item {loadedClasses[String(artwork.id)]}"
				style="aspect-ratio: {artwork.dimensions
					? `${artwork.dimensions.width}/${artwork.dimensions.height}`
					: '1/1'};"
				tabindex="-1"
				role="button"
				aria-label="Focus Artwork"
				on:keydown={handleKeyDown}
			>
				<button class="close icon-button" on:click={closeFullscreen}>Close</button>
				<div
					class="media-container"
					style="aspect-ratio: {artwork.dimensions
						? `${artwork.dimensions.width}/${artwork.dimensions.height}`
						: '1/1'};"
				>
					{#if loadingStates[String(artwork.id)]}
						<SkeletonLoader
							height={artwork.dimensions ? `${artwork.dimensions.height}px` : '100%'}
							width={artwork.dimensions ? `${artwork.dimensions.width}px` : '100%'}
						/>
					{/if}

					{#if artwork.animation_url}
						{#if artwork.mime?.startsWith('video')}
							<video
								autoplay
								loop
								muted
								on:loadeddata={() => handleMediaLoad(artwork.id)}
								class:hidden={loadingStates[String(artwork.id)]}
							>
								<source
									src={artwork.animation_url}
									type="video/mp4"
									height={artwork.dimensions?.height}
									width={artwork.dimensions?.width}
								/>
								Your browser does not support the video tag.
							</video>
						{:else if artwork.mime && artwork.mime.startsWith('application')}
							<iframe
								src={artwork.animation_url}
								class="live-code"
								title="Artwork Animation"
								on:load={() => handleMediaLoad(artwork.id)}
								class:hidden={loadingStates[String(artwork.id)]}
							></iframe>
						{:else if artwork.image_url}
							<img
								bind:this={artworkRefs[index]}
								src={artwork.image_url}
								alt={artwork.title}
								srcset={artwork.srcset}
								sizes={artwork.sizes}
								on:load={() => handleMediaLoad(artwork.id)}
								class:hidden={loadingStates[String(artwork.id)]}
							/>
						{/if}
					{:else if artwork.image_url}
						<img
							bind:this={artworkRefs[index]}
							src={artwork.image_url}
							alt={artwork.title}
							srcset={artwork.srcset}
							sizes={artwork.sizes}
							on:load={() => handleMediaLoad(artwork.id)}
							class:hidden={loadingStates[String(artwork.id)]}
						/>
					{/if}

					{#if $selectedArtwork && $selectedArtwork.id === artwork.id && !$isMaximized}
						<button
							type="button"
							class="maximize icon-button"
							on:click={() => toggleMaximize(artwork.id)}
						>
							View Full Screen
						</button>
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

	.hidden {
		@apply opacity-0;
	}
</style>
