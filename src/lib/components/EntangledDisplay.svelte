<script lang="ts">
	import { onMount } from 'svelte';

	export let ethArtwork: any;
	export let tezosArtwork: any;
	export let className: string = '';

	// Entangled contract addresses
	const ENTANGLED_CONTRACTS = {
		ethereum: '0x19dbc1c820dd3f13260829a4e06dda6d9ef758db',
		tezos: 'kt1efsnuqwlawdd3o4pvfux1cah5gmdtrrvr'
	};

	let containerElement: HTMLElement;
	let isVisible = false;

	// Generate entangled reveal URL with parameters
	function generateEntangledUrl(): string {
		const baseUrl = '/entangled-reveal/index.html';
		const ethTokenId = ethArtwork.tokenId || ethArtwork.tokenID || '1';
		const tezosTokenId = tezosArtwork.tokenId || tezosArtwork.tokenID || '1';
		
		const params = new URLSearchParams({
			fxiteration: ethTokenId,
			disableWindowing: '1',
			fxchain: 'ETHEREUM',
			bgalpha: '0.80',
			ethToken: ethTokenId,
			tezosToken: tezosTokenId,
			// Add wallet owners if available
			...(ethArtwork.ownerAddress && { ethOwner: ethArtwork.ownerAddress }),
			...(tezosArtwork.ownerAddress && { tezosOwner: tezosArtwork.ownerAddress })
		});
		
		return `${baseUrl}?${params.toString()}`;
	}

	function setupIntersectionObserver() {
		if (!containerElement || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
			isVisible = true;
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						isVisible = true;
						observer.unobserve(entry.target);
					}
				});
			},
			{
				rootMargin: '50px',
				threshold: 0.1
			}
		);

		observer.observe(containerElement);

		return () => observer.disconnect();
	}

	onMount(() => {
		const cleanup = setupIntersectionObserver();
		return cleanup;
	});
</script>

<div 
	bind:this={containerElement}
	class="entangled-display {className}"
>
	<div class="entangled-container">
		<!-- SVG clipping paths for the windows -->
		<svg width="0" height="0" style="position: absolute;">
			<defs>
				<clipPath id="entangled-clip-path">
					<!-- Ethereum window -->
					<path 
						class="transition-transform delay-2000 duration-300" 
						d="M9.023522443477585,363.02558272851024 h548 v406.5 a5,5 0 0 1 -5,5 h-538 a8,5 0 0 1 -5,-5 v-406.5 z" 
						fill="currentColor" 
						style="transform: scale(1); transform-origin: 283.024px 568.776px; display: block;"
					/>
					<!-- Tezos window -->
					<path 
						class="transition-transform delay-2000 duration-300" 
						d="M279,141.11878557121332 h548 v406.5 a5,5 0 0 1 -5,5 h-538 a8,5 0 0 1 -5,-5 v-406.5 z" 
						fill="currentColor" 
						style="transform: scale(1); transform-origin: 553px 346.869px; display: block;"
					/>
				</clipPath>
			</defs>
		</svg>

		<!-- Ethereum window frame -->
		<div class="artwork-window ethereum-window">
			<div class="window-header">
				<span>ETHEREUM</span>
			</div>
			<div class="window-backdrop"></div>
			<div class="window-shadow"></div>
		</div>

		<!-- Tezos window frame -->
		<div class="artwork-window tezos-window">
			<div class="window-header">
				<span>TEZOS</span>
			</div>
			<div class="window-backdrop"></div>
			<div class="window-shadow"></div>
		</div>

		<!-- Interactive iframe content -->
		{#if isVisible}
			<iframe
				class="entangled-iframe"
				width="100%"
				height="100%"
				style="clip-path: url('#entangled-clip-path'); color-scheme: light;"
				src={generateEntangledUrl()}
				title="Entangled Interactive Art"
				frameborder="0"
				allowfullscreen
			></iframe>
		{/if}

		<!-- Artwork info section -->
		<section class="artwork-info-section">
			<div class="artwork-titles">
				<div class="artwork-title ethereum-title">
					<span class="chain-label">ETHEREUM</span>
					<span class="token-number">#{ethArtwork.tokenId || ethArtwork.tokenID || '1'}</span>
				</div>
				<div class="artwork-title tezos-title">
					<span class="chain-label">TEZOS</span>
					<span class="token-number">#{tezosArtwork.tokenId || tezosArtwork.tokenID || '1'}</span>
				</div>
			</div>
		</section>
	</div>
</div>

<style lang="scss">
	.entangled-display {
		@apply w-full relative;
		aspect-ratio: 16/10;
		min-height: 400px;
	}

	.entangled-container {
		@apply relative w-full h-full bg-black text-white overflow-hidden rounded-lg;
	}

	.artwork-window {
		@apply absolute transition-opacity duration-300 ease-in-out;
		opacity: 1;
	}

	.ethereum-window {
		left: 8.02352px;
		top: 339.026px;
		width: 550px;
		height: 436.5px;
		z-index: 29;
	}

	.tezos-window {
		left: 278px;
		top: 117.119px;
		width: 550px;
		height: 436.5px;
		z-index: 32;
	}

	.window-header {
		@apply absolute w-full -translate-y-full text-xs leading-tight tracking-wider text-gray-300;
		height: 25px;

		span {
			@apply flex h-full items-center justify-center border-b-0 bg-gray-800 rounded-t-md px-2 py-0;
		}
	}

	.window-backdrop {
		@apply absolute rounded-b-md;
		backdrop-filter: blur(8px);
		width: 100%;
		height: 412.5px;
		top: 24px;
	}

	.window-shadow {
		@apply absolute rounded-md shadow-2xl;
		width: 100%;
		height: 100%;
		top: -24px;
	}

	.entangled-iframe {
		@apply absolute inset-0 w-full h-full border-none;
		z-index: 31;
		pointer-events: none;
	}

	.artwork-info-section {
		@apply absolute bottom-0 left-0 right-0 p-6 z-40;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 100%);
	}

	.artwork-titles {
		@apply flex items-start gap-5 lg:items-center lg:gap-36 lg:text-3xl;
	}

	.artwork-title {
		@apply flex-1;

		.chain-label {
			@apply text-lg font-bold text-white lg:text-4xl;
		}

		.token-number {
			@apply opacity-40;
		}
	}

	.ethereum-title {
		@apply text-left;
	}

	.tezos-title {
		@apply text-right;
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.entangled-display {
			aspect-ratio: 4/3;
			min-height: 300px;
		}

		.ethereum-window,
		.tezos-window {
			width: 60%;
			height: 60%;
		}

		.ethereum-window {
			left: 5%;
			top: 45%;
		}

		.tezos-window {
			left: 35%;
			top: 15%;
		}

		.artwork-titles {
			@apply flex-col gap-2;
		}

		.chain-label {
			@apply text-base lg:text-lg;
		}
	}
</style> 