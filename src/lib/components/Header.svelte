<script lang="ts">
	import CollectionDropdown from '$lib/components/CollectionDropdown.svelte';
	import { page } from '$app/stores';
	import { selectedArtwork, isLiveCodeVisible } from '$lib/stores';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';
	import { getContractUrl, getContractName } from '$lib/utils';

	interface Artist {
		id: number;
		name: string;
		websiteUrl?: string;
	}

	interface ArtistArtwork {
		artist: Artist;
	}

	interface Artwork {
		id: number;
		title: string;
		description: string;
		image_url?: string;
		animation_url?: string;
		dimensions?: { width: number; height: number };
		contractAddr?: string;
		contractAlias?: string;
		tokenStandard?: string;
		tokenID?: string;
		mintDate?: string | Date;
		mime?: string;
		tags?: string[];
		attributes?: { trait_type: string; value: string }[];
		ArtistArtworks?: ArtistArtwork[];
		blockchain?: string;
	}

	let artworkDetails: Artwork | null = null;
	let isToggleActive: boolean = false;

	$: artworkDetails = $selectedArtwork as Artwork | null;
	$: artworkSuffix = $page.data.artworks && $page.data.artworks.length > 1 ? 's' : '';

	function toggleLiveCode(): void {
		isLiveCodeVisible.set(!get(isLiveCodeVisible));
		isToggleActive = $isLiveCodeVisible ? true : false; // Update the toggle state
	}

	function convertToHTML(text: string): string {
		return text.replace(/(?:\r\n|\r|\n)/g, '<br>');
	}

	function formatDate(date: string | Date | undefined): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		});
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
</script>

<header>
	<nav aria-label="Global">
		<a href="/" class="logo">
			<span><span class="topline">wallace</span> museum</span>
		</a>

		<CollectionDropdown currentSlug={$page.params.collectionSlug} />

		<div class="live-code">
			<label class="toggle-switch">
				<input type="checkbox" bind:checked={isToggleActive} on:change={toggleLiveCode} />
				<span class="slider"></span>
			</label>
			Live Code View
		</div>
	</nav>

	<div class="details-container">
		<div class="collection-details">
			<span>{$page.data.artworks?.length ?? 0} artwork{artworkSuffix}</span> in this collection.
		</div>

		{#if artworkDetails && artworkDetails.ArtistArtworks && artworkDetails.ArtistArtworks.length > 0}
			<div class="artist-details">
				{#each artworkDetails.ArtistArtworks as artistArtwork, i (artistArtwork.artist.id)}
					<span class="artist-name">
						{#if artistArtwork.artist.websiteUrl}
							<a href={artistArtwork.artist.websiteUrl} target="_blank" rel="noopener noreferrer"
								>{artistArtwork.artist.name}</a
							>
						{:else}
							{artistArtwork.artist.name}
						{/if}
					</span>{artworkDetails.ArtistArtworks.length > 1 &&
					i < artworkDetails.ArtistArtworks.length - 1
						? ', '
						: ''}
				{/each}
			</div>
		{/if}

		{#if artworkDetails && artworkDetails.title}
			<div class="artwork-details">
				<h1 class="artwork-title">
					{artworkDetails.title}
				</h1>

				<p class="artwork-description">{@html convertToHTML(artworkDetails.description)}</p>

				{#if artworkDetails && artworkDetails.attributes}
					<h3 class="mt-8 mb-4">Attributes</h3>
					<dl>
						{#each parseAttributes(artworkDetails.attributes) as attribute}
							<dt>{attribute.trait_type}</dt>
							<dd>{attribute.value}</dd>
						{/each}
					</dl>
				{/if}

				<div class="artwork-details">
					<h3 class="mt-8 mb-4">Additional info</h3>
					<dl>
						{#if artworkDetails.mintDate}
							<dt class="mint-date">Minted</dt>
							<dd>{formatDate(artworkDetails.mintDate)}</dd>
						{/if}
						{#if artworkDetails.tokenID}
							<dt>Token ID</dt>
							<dd>{artworkDetails.tokenID}</dd>
						{/if}
						{#if artworkDetails.tokenStandard}
							<dt>Token Standard</dt>
							<dd>{artworkDetails.tokenStandard}</dd>
						{/if}
						{#if artworkDetails.contractAddr && artworkDetails.tokenID}
							<dt>Contract</dt>
							<dd>
								<a
									target="_blank"
									href={getContractUrl(
										artworkDetails.contractAddr,
										artworkDetails.blockchain,
										artworkDetails.tokenID
									)}>{getContractName(artworkDetails.contractAddr, artworkDetails.contractAlias)}</a
								>
							</dd>
						{/if}
						{#if artworkDetails.dimensions && artworkDetails.dimensions.width && artworkDetails.dimensions.height}
							<dt>Dimensions</dt>
							<dd>{artworkDetails.dimensions.width}x{artworkDetails.dimensions.height}px</dd>
						{/if}
					</dl>
				</div>

				{#if artworkDetails && artworkDetails.tags && artworkDetails.tags.length > 0}
					<h3 class="mt-8 mb-4">Tags</h3>
					<ul class="tags">
						{#each artworkDetails.tags as tag}
							<li>#{tag}</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style lang="scss">
	header {
		@apply text-lg w-[380px] z-20 bg-white border-r text-gray-700 border-gray-200 max-h-screen overflow-y-scroll;

		@media (prefers-color-scheme: dark) {
			@apply bg-black border-gray-800 text-gray-200;
		}
	}

	nav {
		@apply py-4 px-6;
	}

	.logo {
		@apply text-white inline-block mt-3 mb-8 flex gap-4;

		span {
			@apply grow text-gray-700 inline-block uppercase;
			font-size: 0.7em;
			line-height: 1.05;
			letter-spacing: 0.52em;
			font-family: var(--serif-font-family);
			font-variation-settings:
				'wght' 380,
				'wdth' 400,
				'CUTT' 100;
		}

		.topline {
			@apply block lowercase;
			letter-spacing: 0.05em;
			font-size: 1.68em;
		}
	}

	a {
		@apply no-underline font-bold uppercase;
	}

	.details-container {
		@apply mt-4 px-6 pb-8;
	}

	.collection-details {
		@apply text-sm mb-4 border border-gray-200 rounded-sm p-4;

		span {
			@apply font-bold;
		}
	}

	.artist-name,
	.artist-name a {
		display: inline;
	}

	.artist-name:after {
		content: ', ';
		display: inline;
		color: #fff;
		font-weight: 700;
	}

	.artist-name:last-child:after {
		content: '';
	}

	.artist-name {
		@apply text-sm font-normal;
	}

	.artwork-title {
		@apply text-2xl mb-4 font-bold leading-normal;
	}

	.artwork-description {
		@apply text-sm leading-relaxed max-w-full overflow-x-hidden;
	}

	.tags {
		@apply mr-2 text-sm;

		li {
			@apply inline-block mr-2;
		}
	}

	@media (prefers-color-scheme: dark) {
		.logo {
			span {
				@apply text-white;
			}

			.topline {
				fill: #1dc74a;
			}
		}

		.artwork-details {
			h1,
			p {
				@apply text-gray-200;
			}
		}

		.artist-details {
			@apply text-gray-300;
		}

		.collection-details {
			@apply border-gray-700;
		}
	}

	.live-code {
		@apply font-sans leading-loose uppercase mt-6 inline-block mx-auto flex items-center;
		font-variation-settings:
			'CUTT' 100,
			'wdth' 50,
			'wght' 450;
	}

	.toggle-switch {
		@apply relative inline-block w-[60px] h-[34px] mr-2;

		input {
			@apply opacity-0 w-0 h-0;
		}

		.slider {
			@apply absolute cursor-pointer inset-0 duration-300 rounded-full border-2 border-double border-transparent bg-origin-border;
			background-image: linear-gradient(white, white), linear-gradient(to right, #999, #999);
			background-clip: content-box, border-box;

			&:before {
				position: absolute;
				content: '';
				height: 24px; /* Height of the inner button */
				width: 24px; /* Width of the inner button */
				left: 4px;
				bottom: 3px;
				background-color: #999;
				transition: 0.125s;
				border-radius: 50%;
			}

			@media (prefers-color-scheme: dark) {
				background-image: linear-gradient(black, black), linear-gradient(to right, #666, #666);

				&:before {
					background-color: #666;
				}
			}
		}
	}

	input:checked + .slider {
		background-color: transparent;
		background-image: linear-gradient(white, white),
			linear-gradient(
				to right,
				rgb(166, 255, 71),
				rgb(126, 222, 24),
				rgb(116, 194, 33),
				rgb(4, 197, 97),
				rgb(3, 179, 100),
				rgb(69, 219, 147),
				rgb(126, 222, 24),
				rgb(222, 222, 27),
				rgb(126, 222, 24),
				rgb(69, 219, 147),
				rgb(3, 179, 100),
				rgb(4, 197, 97),
				rgb(116, 194, 33),
				rgb(126, 222, 24),
				rgb(166, 255, 71)
			);

		&:before {
			background-color: rgb(3, 179, 100);
			transform: translateX(25px); /* Move the button to the right */
		}

		@media (prefers-color-scheme: dark) {
			background-image: linear-gradient(black, black),
				linear-gradient(
					to right,
					rgb(166, 255, 71),
					rgb(126, 222, 24),
					rgb(116, 194, 33),
					rgb(4, 197, 97),
					rgb(3, 179, 100),
					rgb(69, 219, 147),
					rgb(126, 222, 24),
					rgb(222, 222, 27),
					rgb(126, 222, 24),
					rgb(69, 219, 147),
					rgb(3, 179, 100),
					rgb(4, 197, 97),
					rgb(116, 194, 33),
					rgb(126, 222, 24),
					rgb(166, 255, 71)
				);
		}
	}

	/* Animation for the gradient when enabled */
	@keyframes rainbow-animation {
		0% {
			background-position: 0% 50%;
		}
		100% {
			background-position: 100% 50%;
		}
	}

	input:checked + .slider {
		animation: rainbow-animation 2s linear infinite;
		background-size: 210% 210%;
	}
</style>
