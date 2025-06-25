<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import FeaturedArtwork from '$lib/components/FeaturedArtwork.svelte';
	import CuratedFeed from '$lib/components/CuratedFeed.svelte';

	// SEO constants
	const siteTitle = 'Wallace Museum | Digital Art Collection';
	const siteDescription = 'The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression. Discover innovative digital art, generative algorithms, and blockchain-connected artworks.';
	const siteUrl = 'https://wallace-collection.vercel.app'; // Update this to your actual domain
	const imageUrl = `${siteUrl}/images/wallace-museum.png`;
	const twitterHandle = '@chriswallace';
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{siteTitle}</title>
	<meta name="title" content={siteTitle} />
	<meta name="description" content={siteDescription} />
	<meta name="keywords" content="digital art, generative art, computational aesthetics, algorithmic art, NFT, blockchain art, contemporary art, digital museum, art collection, innovative artists" />
	<meta name="author" content="Chris Wallace" />
	<meta name="robots" content="index, follow" />
	<link rel="canonical" href={siteUrl} />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={siteUrl} />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Wallace Museum - Digital Art Collection" />
	<meta property="og:site_name" content="Wallace Museum" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={siteUrl} />
	<meta property="twitter:title" content={siteTitle} />
	<meta property="twitter:description" content={siteDescription} />
	<meta property="twitter:image" content={imageUrl} />
	<meta property="twitter:image:alt" content="Wallace Museum - Digital Art Collection" />
	<meta property="twitter:site" content={twitterHandle} />
	<meta property="twitter:creator" content={twitterHandle} />

	<!-- Additional SEO Meta Tags -->
	<meta name="theme-color" content="#000000" />
	<meta name="msapplication-TileColor" content="#000000" />
	<meta name="application-name" content="Wallace Museum" />
	<meta name="apple-mobile-web-app-title" content="Wallace Museum" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

	<!-- Structured Data (JSON-LD) -->
	<script type="application/ld+json">
		{
			"@context": "https://schema.org",
			"@type": "Museum",
			"name": "Wallace Museum",
			"description": "The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression.",
			"url": "https://wallace-collection.vercel.app",
			"image": "https://wallace-collection.vercel.app/images/wallace-museum.png",
			"founder": {
				"@type": "Person",
				"name": "Chris Wallace",
				"url": "https://chriswallace.net",
				"sameAs": [
					"https://twitter.com/chriswallace"
				]
			},
			"sameAs": [
				"https://twitter.com/chriswallace"
			],
			"address": {
				"@type": "PostalAddress",
				"addressLocality": "McKinney",
				"addressRegion": "TX",
				"addressCountry": "US"
			},
			"artMedium": [
				"Digital Art",
				"Generative Art",
				"Computational Art",
				"Algorithmic Art"
			],
			"hasOfferCatalog": {
				"@type": "OfferCatalog",
				"name": "Digital Art Collection",
				"itemListElement": [
					{
						"@type": "Offer",
						"itemOffered": {
							"@type": "CreativeWork",
							"name": "Digital Artworks",
							"description": "Innovative digital art pieces from pioneering artists"
						}
					}
				]
			}
		}
	</script>
</svelte:head>

<div class="homepage-container">
	<FeaturedArtwork />
	<CuratedFeed />
</div>

<style lang="scss">
	.homepage-container {
		@apply w-full min-h-screen;
		
		/* Mobile-first approach */
		@media (max-width: 768px) {
			/* Ensure proper spacing on mobile */
			min-height: calc(100vh - var(--navbar-height));
			padding-top: 0;
		}
		
		@media (min-width: 769px) {
			/* Desktop spacing */
			min-height: calc(100vh - var(--navbar-height));
		}
	}
</style>
