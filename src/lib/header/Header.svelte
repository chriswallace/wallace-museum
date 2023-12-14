<script>
	import CollectionDropdown from '$lib/CollectionDropdown.svelte';
	import { page } from '$app/stores';
	import { selectedArtwork, isLiveCodeVisible } from '$lib/stores';
	import { handleMaximize } from '$lib/artworkActions';
	import { get } from 'svelte/store';

	let artworkDetails = null;
	let isToggleActive = false;

	$: artworkDetails = $selectedArtwork;
	$: artworkSuffix = $page.data.artworks && $page.data.artworks.length > 1 ? 's' : '';

	function toggleMaximize() {
		if (artworkDetails) {
			handleMaximize(artworkDetails); // Ensure artworkRefs and data are accessible here
		}
	}

	function getAddressURI(contractAddr, tokenID) {
		// if contract address starts with KT1 or KT2, it's a Tezos contract
		if (contractAddr.startsWith('KT1') || contractAddr.startsWith('KT2')) {
			return `https://tzkt.io/${contractAddr}/tokens/${tokenID}`;
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
</script>

<header>
	<nav aria-label="Global">
		<a href="/" class="logo">
			<svg
				width="296"
				height="88"
				viewBox="0 0 296 88"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				class:highlighted={$isLiveCodeVisible}
			>
				<rect width="87.0952" height="87.0952" rx="7.72619" />
				<path
					class="w"
					d="M16 25.5108C16 25.2287 16.2287 25 16.5108 25H24.2885C24.528 25 24.7354 25.1664 24.7872 25.4002L31.3534 55.0085C31.4053 55.2423 31.6126 55.4087 31.8521 55.4087H33.6709C33.9104 55.4087 34.1177 55.2423 34.1696 55.0085L40.7358 25.4002C40.7877 25.1664 40.995 25 41.2345 25H46.064C46.3036 25 46.5109 25.1664 46.5628 25.4002L53.129 55.0085C53.1808 55.2423 53.3882 55.4087 53.6277 55.4087H55.4464C55.6859 55.4087 55.8933 55.2423 55.9451 55.0085L62.5114 25.4002C62.5632 25.1664 62.7706 25 63.0101 25H70.7877C71.0699 25 71.2986 25.2287 71.2986 25.5108V61.8157C71.2986 62.0978 71.0699 62.3265 70.7877 62.3265H16.5108C16.2287 62.3265 16 62.0978 16 61.8157V25.5108Z"
				/>
				<path
					class="topline"
					d="M150.117 21.6685H153.374V45H150.117V21.6685ZM133.64 43.0557V21.6685H136.896V41.9377H150.117L146.958 45H135.584L133.64 43.0557ZM117.162 43.3474V21.6685H120.418V41.9377H133.688L130.529 45H118.912L117.162 43.3474ZM158.162 43.3474V38.5352L182.125 24.6822L182.805 27.5986L161.418 39.9448V41.9377H180.424L177.313 45H159.911L158.162 43.3474ZM180.472 24.7308H161.418V26.7723H158.162V23.3212L159.911 21.6685H181.979L183.729 23.3212V45H180.472V24.7308ZM189.076 13.8914H192.332V45H189.076V13.8914ZM197.667 13.8914H200.924V45H197.667V13.8914ZM205.724 43.3474V38.5352L229.688 24.6822L230.368 27.5986L208.981 39.9448V41.9377H227.987L224.876 45H207.474L205.724 43.3474ZM228.035 24.7308H208.981V26.7723H205.724V23.3212L207.474 21.6685H229.542L231.292 23.3212V45H228.035V24.7308ZM236.639 43.3474V23.3212L238.389 21.6685H260.456L262.206 23.3212V26.7723H258.949V24.7308H239.895V41.9377H258.949V39.8962H262.206V43.3474L260.456 45H238.389L236.639 43.3474ZM267.018 43.3474V23.3698L268.817 21.6685H290.836L292.586 23.3212V28.1333L268.622 41.9864L267.893 39.0699L289.329 26.7237V24.7308H270.275V41.9377H289.329V39.8962H292.586V43.3474L290.836 45H268.768L267.018 43.3474Z"
				/>
				<path
					d="M126.166 61.8219L123.291 69.8516H122.106L119.465 61.9656V69.8516H117.992V58.3549H119.537L122.824 67.642L126.094 58.3549H127.639V69.8516H126.166V61.8219ZM153.072 69.0432V58.3549H154.545V68.3067H158.946V58.3549H160.419V69.0432L159.682 69.8516H153.808L153.072 69.0432ZM185.637 69.0432V66.7618H187.11V68.3067H191.062V66.6541L185.637 62.1632V59.1633L186.374 58.3549H191.799L192.535 59.1633V61.4446H191.062V59.8998H187.11V61.3548L192.535 65.8457V69.0432L191.799 69.8516H186.374L185.637 69.0432ZM217.757 69.0432V59.1633L218.494 58.3549H224.889V59.8998H219.23V68.3067H224.889V69.8516H218.494L217.757 69.0432ZM220.649 62.5943H222.589V64.1392H219.212L220.649 62.5943ZM249.749 69.0432V58.3549H251.222V68.3067H255.623V58.3549H257.096V69.0432L256.36 69.8516H250.486L249.749 69.0432ZM290.704 61.8219L287.83 69.8516H286.644L284.004 61.9656V69.8516H282.531V58.3549H284.075L287.363 67.642L290.632 58.3549H292.177V69.8516H290.704V61.8219Z"
				/>
			</svg>
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
			<span>{$page.data.artworks.length} artwork{artworkSuffix}</span> in this collection.
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

		{#if artworkDetails}
			<div class="artwork-details">
				<h1 class="artwork-title">
					{artworkDetails.title}
				</h1>
				<a href="#" class="maximize icon-button with-text" on:click|preventDefault={toggleMaximize}>
					View Full Screen
				</a>
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
		@apply text-white;

		svg {
			@apply w-[168px] mr-auto;
		}

		.w {
			fill: white;
		}

		rect {
			fill: black;
		}

		path,
		.topline {
			fill: black;
		}
	}

	a {
		@apply no-underline font-bold uppercase text-base;
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

	.icon-button.with-text {
		@apply w-auto mb-2;
		text-indent: 30px;
		line-height: 22px;
		background-position: left center;
		color: inherit;
		font-size: 13px;
		font-weight: semibold;

		&:hover {
			@apply decoration-2 underline;
		}
	}
	.maximize {
		background-image: url('/images/expand.svg');
	}

	@media (prefers-color-scheme: dark) {
		.logo {
			@apply text-white;

			path {
				fill: #fafafa;
			}

			rect {
				fill: white;
			}

			.w {
				fill: black;
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
