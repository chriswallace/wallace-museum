<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data;

	$: ({ ethArtwork, tezosArtwork, ethTokenId, tezosTokenId } = data);

	let iframeElement;

	// Handle missing artworks
	if (!data.ethArtwork && !data.tezosArtwork) {
		console.error('No Entangled artworks found in data');
	}
	
	// Get token IDs for the iframe, with fallbacks
	$: ethToken = data.ethTokenId || data.ethArtwork?.tokenId || '0';
	$: tezosToken = data.tezosTokenId || data.tezosArtwork?.tokenId || '0';

	onMount(() => {
		// Add any initialization logic here if needed
	});

	function formatDate(dateString: string | Date | null): string {
		if (!dateString) return 'Unknown';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getBlockchainExplorer(blockchain: string | null): string {
		if (!blockchain) return '#';
		return blockchain.toLowerCase() === 'ethereum' ? 'https://etherscan.io' : 'https://tzkt.io';
	}

	function getBlockchainDisplay(blockchain: string | null): string {
		if (!blockchain) return 'Unknown';
		return blockchain === 'ethereum' ? 'Ethereum' : blockchain === 'tezos' ? 'Tezos' : blockchain;
	}
</script>

<svelte:head>
	<title>Entangled #{ethTokenId} × #{tezosTokenId} - Cross-Chain Interactive Art</title>
	<meta name="description" content="Experience the entangled cross-chain artwork connecting Ethereum token #{ethTokenId} and Tezos token #{tezosTokenId}" />
</svelte:head>

<div class="entangled-page">
	{#if !data.ethArtwork && !data.tezosArtwork}
		<!-- Fallback when no artworks found -->
		<div class="entangled-error">
			<h1>No Entangled Artworks Found</h1>
			<p>The requested Entangled artworks could not be found in the collection.</p>
			<a href="/" class="back-link">← Back to Home</a>
		</div>
	{:else}
		<div class="artwork-container">
			<iframe
				bind:this={iframeElement}
				src="/entangled-reveal/?ethToken={ethToken}&tezosToken={tezosToken}&fxiteration={ethTokenId}&bgalpha=1.0"
				title="Entangled Interactive Artwork"
				class="entangled-iframe"
				allowfullscreen
			></iframe>
		</div>

		<div class="metadata-container">
			<div class="header">
				<h1 class="title">ENTANGLED</h1>
				<p class="subtitle">Cross-Chain Interactive Art Experience</p>
			</div>

			<div class="token-info">
				<div class="token-pair">
					<div class="token ethereum">
						<div class="chain-label">
							<span class="chain-icon">⟠</span>
							Ethereum
						</div>
						{#if ethArtwork}
							<div class="token-details">
								<div class="token-id">Token #{ethArtwork.tokenId}</div>
								{#if ethArtwork.title}
									<div class="artwork-title">{ethArtwork.title}</div>
								{/if}
								{#if ethArtwork.mintDate}
									<div class="mint-date">Minted {formatDate(ethArtwork.mintDate)}</div>
								{/if}
								{#if ethArtwork.Artist && ethArtwork.Artist.length > 0}
									<div class="artist">by {ethArtwork.Artist[0].name}</div>
								{/if}
							</div>
						{:else}
							<div class="token-details">
								<div class="token-id">Token #{ethTokenId}</div>
								<div class="status">Loading...</div>
							</div>
						{/if}
					</div>

					<div class="entanglement-symbol">⟡</div>

					<div class="token tezos">
						<div class="chain-label">
							<span class="chain-icon">◊</span>
							Tezos
						</div>
						{#if tezosArtwork}
							<div class="token-details">
								<div class="token-id">Token #{tezosArtwork.tokenId}</div>
								{#if tezosArtwork.title}
									<div class="artwork-title">{tezosArtwork.title}</div>
								{/if}
								{#if tezosArtwork.mintDate}
									<div class="mint-date">Minted {formatDate(tezosArtwork.mintDate)}</div>
								{/if}
								{#if tezosArtwork.Artist && tezosArtwork.Artist.length > 0}
									<div class="artist">by {tezosArtwork.Artist[0].name}</div>
								{/if}
							</div>
						{:else}
							<div class="token-details">
								<div class="token-id">Token #{tezosTokenId}</div>
								<div class="status">Loading...</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="description">
				<p>
					This artwork represents a unique cross-chain entanglement between Ethereum and Tezos blockchains. 
					The interactive experience above responds to the combined state of both tokens, creating a unified 
					artistic expression that transcends individual blockchain boundaries.
				</p>
				
				{#if ethArtwork?.description || tezosArtwork?.description}
					<div class="artwork-descriptions">
						{#if ethArtwork?.description}
							<div class="chain-description">
								<h4>Ethereum Description</h4>
								<p>{ethArtwork.description}</p>
							</div>
						{/if}
						{#if tezosArtwork?.description}
							<div class="chain-description">
								<h4>Tezos Description</h4>
								<p>{tezosArtwork.description}</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="technical-info">
				<h3>Technical Details</h3>
				<div class="tech-grid">
					<div class="tech-item">
						<span class="label">Ethereum Contract:</span>
						<code>0x19dbc1c820dd3f13260829a4e06dda6d9ef758db</code>
					</div>
					<div class="tech-item">
						<span class="label">Tezos Contract:</span>
						<code>kt1efsnuqwlawdd3o4pvfux1cah5gmdtrrvr</code>
					</div>
					<div class="tech-item">
						<span class="label">Rendering:</span>
						<span>Three.js + WebGL</span>
					</div>
					<div class="tech-item">
						<span class="label">Interaction:</span>
						<span>Real-time Cross-Chain State</span>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.entangled-page {
		min-height: 100vh;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
		color: white;
		display: flex;
		flex-direction: column;
	}

	.entangled-error {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 40px;
	}

	.entangled-error h1 {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		color: #ff6b6b;
	}

	.entangled-error p {
		font-size: 1.2rem;
		margin-bottom: 2rem;
		opacity: 0.8;
	}

	.back-link {
		color: #4ecdc4;
		text-decoration: none;
		font-size: 1.1rem;
		padding: 12px 24px;
		border: 2px solid #4ecdc4;
		border-radius: 8px;
		transition: all 0.3s ease;
	}

	.back-link:hover {
		background: #4ecdc4;
		color: #0a0a0a;
	}

	.artwork-container {
		flex: 1;
		min-height: 70vh;
		position: relative;
		margin: 20px;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
	}

	.entangled-iframe {
		width: 100%;
		height: 100%;
		border: none;
		display: block;
		min-height: 70vh;
	}

	.metadata-container {
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(20px);
		margin: 0 20px 20px;
		padding: 30px;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.header {
		text-align: center;
		margin-bottom: 40px;
	}

	.title {
		font-size: 3rem;
		font-weight: 700;
		margin: 0 0 10px 0;
		background: linear-gradient(45deg, #627eea, #2d9cdb);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		letter-spacing: 0.1em;
	}

	.subtitle {
		font-size: 1.2rem;
		opacity: 0.8;
		margin: 0;
		font-weight: 300;
	}

	.token-info {
		margin-bottom: 40px;
	}

	.token-pair {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 40px;
		flex-wrap: wrap;
	}

	.token {
		background: rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		padding: 25px;
		min-width: 280px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
	}

	.token:hover {
		transform: translateY(-5px);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	}

	.token.ethereum {
		border-color: rgba(98, 126, 234, 0.3);
	}

	.token.tezos {
		border-color: rgba(45, 156, 219, 0.3);
	}

	.chain-label {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		margin-bottom: 15px;
		font-size: 1.1rem;
	}

	.chain-icon {
		font-size: 1.5rem;
	}

	.token.ethereum .chain-label {
		color: #627eea;
	}

	.token.tezos .chain-label {
		color: #2d9cdb;
	}

	.token-details {
		line-height: 1.6;
	}

	.token-id {
		font-size: 1.3rem;
		font-weight: 600;
		margin-bottom: 8px;
	}

	.artwork-title {
		font-size: 1.1rem;
		opacity: 0.9;
		margin-bottom: 5px;
	}

	.mint-date, .artist {
		font-size: 0.95rem;
		opacity: 0.7;
		margin-bottom: 3px;
	}

	.entanglement-symbol {
		font-size: 3rem;
		opacity: 0.6;
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}

	.description {
		margin-bottom: 40px;
		line-height: 1.7;
	}

	.description p {
		font-size: 1.1rem;
		opacity: 0.9;
		margin-bottom: 20px;
	}

	.artwork-descriptions {
		margin-top: 30px;
	}

	.chain-description {
		margin-bottom: 20px;
	}

	.chain-description h4 {
		color: #627eea;
		margin: 0 0 10px 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.chain-description p {
		font-size: 0.95rem;
		opacity: 0.8;
		margin: 0;
	}

	.technical-info h3 {
		margin: 0 0 20px 0;
		font-size: 1.3rem;
		font-weight: 600;
	}

	.tech-grid {
		display: grid;
		gap: 15px;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}

	.tech-item {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.95rem;
	}

	.tech-item .label {
		font-weight: 600;
		opacity: 0.8;
		min-width: 140px;
	}

	.tech-item code {
		background: rgba(255, 255, 255, 0.1);
		padding: 4px 8px;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
		word-break: break-all;
	}

	@media (max-width: 768px) {
		.entangled-page {
			margin: 0;
		}

		.artwork-container, .metadata-container {
			margin: 10px;
		}

		.metadata-container {
			padding: 20px;
		}

		.title {
			font-size: 2.5rem;
		}

		.token-pair {
			flex-direction: column;
			gap: 20px;
		}

		.token {
			min-width: auto;
			width: 100%;
		}

		.entanglement-symbol {
			transform: rotate(90deg);
			font-size: 2rem;
		}

		.tech-grid {
			grid-template-columns: 1fr;
		}

		.tech-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 5px;
		}

		.tech-item .label {
			min-width: auto;
		}
	}
</style> 