<script>
	export let selectedArtwork;
	export let visible = false;

	// Function to close the detail view
	export function closeDetail() {
		visible = false;
	}
</script>

{#if visible}
	<div class="artwork-detail">
		<button on:click={closeDetail}>Close</button>
		<h2>{selectedArtwork.title}</h2>
		{#if selectedArtwork.video && selectedArtwork.video.length > 0}
			<video autoplay muted>
				<source src={selectedArtwork.video} type="video/mp4" />
				Your browser does not support the video tag.
			</video>
		{:else}
			<img src={selectedArtwork.image} alt={selectedArtwork.title} />
		{/if}
		<p>{selectedArtwork.description}</p>
		<!-- Add more details and interactive elements here -->
	</div>
{/if}

<style>
	.artwork-detail {
		position: absolute;
		top: 20px;
		left: 0;
		right: 0;
		bottom: 20px;
		background: rgba(0, 0, 0, 0.75);
		color: white;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 10;
		padding: 20px;
	}

	.artwork-detail img,
	.artwork-detail video {
		max-width: 100%;
		max-height: 100%;
	}
</style>
