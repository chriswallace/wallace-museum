<script lang="ts">
	// No imports needed for this page
</script>

<svelte:head>
	<title>About | Wallace Museum</title>
	<meta
		name="description"
		content="Learn about the Wallace Museum's mission to showcase pioneering works from bleeding-edge artists pushing the boundaries of computational aesthetics and algorithmic expression."
	/>
</svelte:head>

<div class="about-container">
	<div class="content">

		<div class="about-content">
			<div class="main-description">
				<p class="description">
					The Wallace Museum showcases pioneering works from bleeding-edge artists pushing the
					boundaries of algorithmic and digital expression. Each piece in the
					collection represents an evolving dialogue between human imagination and digital
					innovation—where mathematics becomes poetry and algorithms transform into art.
				</p>
				<p>
					The collection is curated by Chris Wallace, a designer and artist who has been
					collecting and creating digital art since 2021. Based in McKinney, Texas, Chris was 
					captivated by the potential of digital art to express ideas and emotions in new ways.
					After discovering blockchain-connected art, he began creating digital art and experimenting
					with generative algorithms.
				</p>
				<p>
					Compiled mostly during the digital renaissance of 2021-2022, the collection is a testament to the
					creative potential of digital art. Using a variety of tools and techniques, artists in the 
					collection have created artworks through various mediums, including generative algorithms,
					3D modeling, digital painting, video production, and more.
				</p>
				<p>
					The one goal of the museum is to provide a space for these highly innovative artists to 
					showcase their work and share new ideas with the world. Please enjoy.
				</p>
			</div>
		</div>
	</div>
</div>

<style lang="scss">
	.about-container {
		@apply w-full min-h-screen bg-black text-white pt-12;
	}

	.content {
		@apply max-w-4xl mx-auto px-8 py-16;
	}

	.header {
		@apply mb-12;
	}

	.title {
		@apply text-4xl md:text-5xl 2xl:text-6xl font-bold text-yellow-500 tracking-tight mb-6;
	}

	.about-content {
		@apply space-y-12;
	}

	.main-description {
		@apply mb-16;
	}

	p {
		@apply text-xl md:text-2xl 2xl:text-3xl text-gray-400 font-medium leading-relaxed tracking-tight mb-10;
	}

	.description {
		@apply text-white font-bold;
	}

	.section-title {
		@apply text-2xl md:text-3xl font-bold text-yellow-500 tracking-tight mb-4;
	}

	.section-text {
		@apply text-lg md:text-xl text-gray-200 leading-relaxed;
	}

	.mission-section,
	.vision-section,
	.collection-section {
		@apply border-l-4 border-yellow-500/30 pl-6;
	}

	@media (max-width: 768px) {
		.content {
			@apply px-4 py-8;
		}

		.title {
			@apply text-3xl mb-4;
		}

		.description {
			@apply text-lg mb-8;
		}

		.section-title {
			@apply text-xl;
		}

		.section-text {
			@apply text-base;
		}

		.mission-section,
		.vision-section,
		.collection-section {
			@apply pl-4;
		}
	}
</style> 