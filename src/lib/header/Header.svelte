<script>
	import CollectionDropdown from '$lib/CollectionDropdown.svelte';
	import { page } from '$app/stores';
	import { selectedArtwork, isLiveCodeVisible } from '$lib/stores';
	import { handleMaximize } from '$lib/artworkActions';
	import { get } from 'svelte/store';

	let artworkDetails = null;
	let isToggleActive = false;

	$: artworkDetails = $selectedArtwork;

	function toggleMaximize() {
		if (artworkDetails) {
			handleMaximize(artworkDetails); // Ensure artworkRefs and data are accessible here
		}
	}

	function toggleLiveCode() {
		isLiveCodeVisible.set(!get(isLiveCodeVisible));
		isToggleActive = $isLiveCodeVisible ? true : false; // Update the toggle state
	}

	function convertToHTML(text) {
		return text.replace(/(?:\r\n|\r|\n)/g, '<br>');
	}
</script>

<header>
	<nav aria-label="Global">
		<a href="/" class="logo">
			<span class="topline">Wallace</span><span>Collection</span>
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
		{#if artworkDetails && artworkDetails.ArtistArtworks}
			<div class="artist-details">
				{#each artworkDetails.ArtistArtworks as artist}
					<span class="artist-name">
						{#if artist.artist.websiteUrl}
							<a href={artist.artist.websiteUrl}>{artist.artist.name} </a>
						{:else}
							{artist.artist.name}
						{/if}
					</span>
				{/each}
			</div>
		{/if}

		{#if artworkDetails}
			<div class="artwork-details">
				<h1 class="artwork-title">
					{artworkDetails.title}

					<a href="#" class="maximize icon-button" on:click|preventDefault={toggleMaximize}>
						Fullscreen
					</a>
				</h1>
				<div class="artist-details"></div>
				<p>{@html convertToHTML(artworkDetails.description)}</p>

				{#if artworkDetails && artworkDetails.attributes && artworkDetails.attributes.length > 0}
					<h3 class="mt-8 mb-4">Attributes</h3>
					<dl>
						{#each artworkDetails.attributes as attribute}
							<dt>{attribute.trait_type}</dt>
							<dd>{attribute.value}</dd>
						{/each}
					</dl>
				{/if}

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

		{#if artworkDetails && artworkDetails.features}
			<div class="artist-details">
				{#each artworkDetails.ArtistArtworks as artist}
					<span class="artist-name">
						{#if artist.artist.websiteUrl}
							<a href={artist.artist.websiteUrl}>{artist.artist.name} </a>
						{:else}
							{artist.artist.name}
						{/if}
					</span>
				{/each}
			</div>
		{/if}
	</div>
</header>

<style lang="scss">
	header {
		@apply text-lg w-[380px] md:z-20 bg-white border-r text-gray-700 border-gray-200 max-h-[100vh] overflow-y-scroll;

		@media (prefers-color-scheme: dark) {
			@apply bg-black border-gray-800 text-gray-200;
		}
	}

	nav {
		@apply py-4 px-6;
	}

	.logo {
		@apply text-base text-gray-500 w-[160px] block pt-4 uppercase;
		font-family: var(--serif-font-family);
		font-size: 0.77rem;
		letter-spacing: 0.4em;

		span {
			@apply block;
		}

		.topline {
			@apply text-gray-800 lowercase;
			margin-bottom: 2px;
			letter-spacing: 2px;
			font-size: 32px;
			font-variation-settings:
				'CUTT' 100,
				'wdth' 150,
				'wght' 250;
		}
	}

	a {
		@apply block no-underline font-bold uppercase text-sm md:text-base;
	}

	.details-container {
		@apply mt-4 px-6 pb-8;
	}

	.artwork-title {
		@apply text-2xl pb-0 mb-0 font-semibold;
	}

	.artist-name {
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

	.artist-name a {
		display: inline;
	}

	.artist-details,
	.artwork-details {
		h1 {
			@apply text-3xl mb-4 font-semibold leading-normal;
		}

		.artist-name {
			@apply font-sans;
		}

		p {
			@apply text-sm mb-4;
		}
	}

	.artist-details {
		@apply mb-2;
		letter-spacing: 0;
	}

	.tags {
		@apply mr-2 text-sm;

		li {
			@apply inline-block mr-2;
		}
	}

	.icon-button {
		@apply inline-block p-0 align-baseline;
		width: 22px;
		height: 22px;
		background-size: 22px;
		background-position: center center;
		background-repeat: no-repeat;
		overflow: hidden;
		line-height: 500px;
	}

	.icon-button:first-of-type {
		@apply ml-2;
	}

	.maximize {
		background-image: url('/images/expand.svg');
	}

	@media (prefers-color-scheme: dark) {
		.logo {
			@apply text-white;

			.topline {
				color: rgb(29, 199, 74);
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

		.maximize {
			background-image: url('/images/expand-dark-mode.svg');
		}

		.view-live-code {
			background-image: url('/images/code-dark-mode.svg');
		}
	}

	.live-code {
		@apply font-sans leading-loose uppercase mt-6 inline-block mx-auto;
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
