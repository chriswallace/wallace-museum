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
	import LoaderWrapper from '$lib/components/LoaderWrapper.svelte';

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
	<title>{data.title} | Wallace Museum</title>
	<meta
		name="description"
		content="Explore the {data.title} digital art collection at Wallace Museum."
	/>
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
						<div class="loader-wrapper">
							<LoaderWrapper
								height={artwork.dimensions ? `${artwork.dimensions.height}px` : '100%'}
								width={artwork.dimensions ? `${artwork.dimensions.width}px` : '100%'}
								aspectRatio={artwork.dimensions
									? `${artwork.dimensions.width}/${artwork.dimensions.height}`
									: '1/1'}
							/>
						</div>
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
								src={artwork.src || artwork.image_url}
								srcset={artwork.srcset}
								sizes={artwork.sizes}
								alt={artwork.title}
								on:load={() => handleMediaLoad(artwork.id)}
								class:hidden={loadingStates[String(artwork.id)]}
							/>
						{/if}
					{:else if artwork.image_url}
						<img
							src={artwork.src || artwork.image_url}
							srcset={artwork.srcset}
							sizes={artwork.sizes}
							alt={artwork.title}
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

	{#if artworkDetails}
		<div
			class="artwork-details"
			class:maximized={$isMaximized}
			class:live-code-visible={$isLiveCodeVisible}
		>
			<div class="artwork-title-bar">
				<h1 in:fade={{ duration: 300, delay: 300 }}>{artworkDetails.title}</h1>
				<div class="detail-actions">
					{#if artworkDetails.animation_url && artworkDetails.mime?.startsWith('application')}
						<button
							class="icon-button maximize"
							on:click={() => toggleMaximize(artworkDetails.id)}
							aria-label="Toggle fullscreen">Fullscreen</button
						>
					{/if}
				</div>
			</div>
			<div class="artwork-info">
				<div class="artist" in:fade={{ duration: 300, delay: 300 }}>
					<h2>{artworkDetails.creator || artworkDetails.artist_display_name || 'Artist'}</h2>
				</div>
				{#if artworkDetails.description}
					<div class="description" in:fade={{ duration: 300, delay: 300 }}>
						<p>{artworkDetails.description}</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	.h-\\[100vh\\] {
		height: 100vh;
	}

	.artwork-container {
		@apply flex flex-row overflow-x-auto overflow-y-hidden snap-x snap-mandatory h-full;
		height: calc(100vh - 60px);
		width: 100%;
		min-height: 200px;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: auto;
		-ms-overflow-style: auto;

		&::-webkit-scrollbar {
			height: 8px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: rgba(200, 200, 200, 0.5);
			border-radius: 20px;
			border: transparent;
		}
	}

	.loader-wrapper {
		@apply w-full h-full overflow-hidden;
	}

	.artwork-item {
		@apply flex items-center justify-center snap-center shrink-0 px-8;
		height: 100%;
		min-width: 100%;
		scroll-snap-align: center;
		position: relative;
		transition: all 0.3s ease;

		&.loaded .media-container img,
		&.loaded .media-container video,
		&.loaded .media-container iframe {
			opacity: 1;
		}

		&.highlighted {
			.media-container {
				transform: scale(1.02);
			}
		}

		&.maximized {
			.media-container {
				z-index: 1000;
				position: fixed;
				top: 0;
				left: 0;
				width: 100vw;
				height: 100vh;
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: rgba(0, 0, 0, 0.9);
				transform: none;

				iframe {
					width: 80vw;
					height: 80vh;
					max-width: 1200px;
					max-height: 800px;
				}
			}

			.close {
				display: block;
				z-index: 1001;
				position: fixed;
				top: 20px;
				right: 20px;
			}
		}
	}

	.media-container {
		@apply flex items-center justify-center relative;
		height: 100%;
		width: 100%;
		transition: transform 0.3s ease;
	}

	.artwork-item .close {
		display: none;
	}

	img,
	video,
	iframe {
		@apply max-h-full max-w-full;
		height: auto;
		width: auto;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.live-code {
		@apply w-full h-full;
		width: 100%;
		height: 100%;
		border: none;
	}

	.artwork-details {
		@apply fixed bottom-0 left-0 right-0 p-6 bg-white/90 dark:bg-black/90 text-black dark:text-white backdrop-blur-md;
		transition: all 0.3s ease;
		z-index: 10;
		max-height: 30vh;
		overflow-y: auto;

		&.maximized {
			opacity: 0;
			pointer-events: none;
		}

		&.live-code-visible {
			opacity: 0;
			pointer-events: none;
		}
	}

	.artwork-title-bar {
		@apply flex justify-between items-center mb-2;

		h1 {
			@apply text-xl font-bold m-0;
		}
	}

	.detail-actions {
		@apply flex gap-2;
	}

	.artist h2 {
		@apply font-normal text-sm text-gray-700 dark:text-gray-300 my-1;
	}

	.description {
		@apply mt-2 text-sm text-gray-600 dark:text-gray-400;
		max-width: 40em;
	}

	.hidden {
		@apply opacity-0;
	}
</style>
