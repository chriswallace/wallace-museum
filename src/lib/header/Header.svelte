<script>
	import CollectionDropdown from '$lib/CollectionDropdown.svelte';
	import { page } from '$app/stores';
	import { selectedArtwork, isLiveCodeVisible } from '$lib/stores';
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	let artworkDetails = null;
	let isToggleActive = false;

	$: artworkDetails = $selectedArtwork;
	$: artworkSuffix = $page.data.artworks && $page.data.artworks.length > 1 ? 's' : '';

	function getAddressURI(contractAddr, tokenID) {
		// if contract address starts with KT1 or KT2, it's a Tezos contract
		if (contractAddr.startsWith('KT1') || contractAddr.startsWith('KT2')) {
			return `https://tzkt.io/${contractAddr}/tokens/${tokenID}`;
		} else if (contractAddr.startsWith('0x')) {
			return `https://etherscan.io/token/${contractAddr}?a=${tokenID}`;
		}
	}

	function toggleLiveCode() {
		isLiveCodeVisible.set(!get(isLiveCodeVisible));
		isToggleActive = $isLiveCodeVisible ? true : false; // Update the toggle state
	}

	function convertToHTML(text) {
		return text.replace(/(?:\r\n|\r|\n)/g, '<br>');
	}

	function formatDate(date) {
		return new Date(artworkDetails.mintDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: 'numeric',
			minute: 'numeric'
		});
	}

	onMount(() => {
		if (artworkDetails && artworkDetails.attributes) {
		}
	});
</script>

<header>
	<nav aria-label="Global">
		<a href="/" class="logo">
			<svg viewBox="0 0 160 60" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path
					d="M0 2.77887C0 1.4689 0 0.813911 0.406956 0.406956C0.813911 0 1.4689 0 2.77887 0H47.1114C48.1672 0 48.695 0 49.0741 0.300125C49.4531 0.600249 49.5741 1.11406 49.8162 2.14168L59.8257 44.6319C60.0573 45.6148 60.1731 46.1063 60.5265 46.4029C60.5467 46.4199 60.5674 46.4362 60.5885 46.452C60.9583 46.728 61.4632 46.728 62.4731 46.728V46.728C63.483 46.728 63.9879 46.728 64.3577 46.452C64.3788 46.4362 64.3995 46.4199 64.4197 46.4029C64.7731 46.1063 64.8889 45.6148 65.1205 44.6319L75.13 2.14168C75.372 1.11406 75.4931 0.600249 75.8721 0.300125C76.2512 0 76.779 0 77.8348 0H82.1652C83.221 0 83.7488 0 84.1279 0.300125C84.5069 0.600249 84.628 1.11406 84.87 2.14168L94.8795 44.6319C95.1111 45.6148 95.2269 46.1063 95.5803 46.4029C95.6005 46.4199 95.6212 46.4362 95.6423 46.452C96.0121 46.728 96.517 46.728 97.5269 46.728V46.728C98.5368 46.728 99.0417 46.728 99.4115 46.452C99.4326 46.4362 99.4533 46.4199 99.4735 46.4029C99.8269 46.1063 99.9427 45.6148 100.174 44.6319L110.184 2.14168C110.426 1.11406 110.547 0.600249 110.926 0.300125C111.305 0 111.833 0 112.889 0H157.221C158.531 0 159.186 0 159.593 0.406956C160 0.813911 160 1.4689 160 2.77887V57.2211C160 58.5311 160 59.1861 159.593 59.593C159.186 60 158.531 60 157.221 60H2.77887C1.4689 60 0.813911 60 0.406956 59.593C0 59.1861 0 58.5311 0 57.2211V2.77887Z"
					class="w"
				/>
			</svg>

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

		{#if artworkDetails && artworkDetails.description}
			<div class="artwork-details">
				<h1 class="artwork-title">
					{artworkDetails.title}
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
						{#if artworkDetails.totalSupply}
							<dt>Token Supply</dt>
							<dd>
								{#if artworkDetails.totalSupply == 1}1 of 1{:else}{artworkDetails.totalSupply}{/if}
							</dd>
						{/if}
						{#if artworkDetails.contractAddr && artworkDetails.tokenID}
							<dt>Contract</dt>
							<dd>
								<a
									target="_blank"
									href={getAddressURI(artworkDetails.contractAddr, artworkDetails.tokenID)}
									>{artworkDetails.contractAlias}</a
								>
							</dd>
						{/if}
						{#if artworkDetails.symbol}
							<dt>Symbol</dt>
							<dd>{artworkDetails.symbol}</dd>
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

		svg {
			@apply w-[70px] mr-auto;
		}

		.w {
			fill: black;
		}

		span {
			@apply grow text-gray-700 inline-block uppercase;
			font-size: 0.6em;
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

	.artwork-title {
		@apply text-2xl pb-0 mb-0 font-semibold;
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

	.artist-details,
	.artwork-details {
		h1 {
			@apply text-3xl mb-2 font-semibold leading-normal;
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

	@media (prefers-color-scheme: dark) {
		.logo {
			span {
				@apply text-white;
			}

			path {
				fill: #fafafa;
			}

			rect {
				fill: white;
			}

			.w {
				fill: white;
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
