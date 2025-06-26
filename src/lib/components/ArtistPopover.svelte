<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import ArtistAvatar from './ArtistAvatar.svelte';
	import { getContractUrl } from '$lib/utils';
	import { getTwitterUrl, getInstagramUrl, formatSocialHandle } from '$lib/utils/socialMediaUtils';

	export let artist: {
		id?: number;
		name: string;
		bio?: string | null;
		avatarUrl?: string | null;
		websiteUrl?: string | null;
		twitterHandle?: string | null;
		instagramHandle?: string | null;
		addresses?: Array<{
			blockchain: string;
			address: string;
		}> | null;
	};
	export let isOpen = false;

	const dispatch = createEventDispatcher();

	function closePopover() {
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closePopover();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closePopover();
		}
	}

	// Disable body scroll when popover is open
	$: if (typeof document !== 'undefined') {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	}

	// Clean up on component destroy
	onMount(() => {
		return () => {
			if (typeof document !== 'undefined') {
				document.body.style.overflow = '';
			}
		};
	});
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="popover-backdrop"
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		transition:fade={{ duration: 200 }}
		role="dialog"
		aria-modal="true"
		aria-labelledby="artist-name"
		tabindex="-1"
	>
		<!-- Popover Content -->
		<div 
			class="popover-content"
			transition:scale={{ duration: 300, easing: quintOut, start: 0.9 }}
		>
			<!-- Close Button -->
			<button 
				class="close-button"
				on:click={closePopover}
				aria-label="Close artist information"
			>
				×
			</button>

			<!-- Scrollable Content -->
			<div class="popover-scroll">
				<!-- Artist Header -->
				<div class="artist-header">
					{#if artist.avatarUrl}
						<div class="avatar-container">
							<ArtistAvatar 
								artist={artist} 
								size="lg"
								className="artist-avatar"
							/>
						</div>
					{/if}
					<h2 id="artist-name" class="artist-name">{artist.name}</h2>
				</div>

				<!-- Artist Bio -->
				{#if artist.bio}
					<div class="bio-section">
						<h3 class="section-title">About</h3>
						<p class="bio-text">{artist.bio}</p>
					</div>
				{/if}

				<!-- Social Links -->
				{#if artist.websiteUrl || artist.twitterHandle || artist.instagramHandle}
					<div class="social-section">
						<h3 class="section-title">Links</h3>
						<div class="social-links">
							{#if artist.websiteUrl}
								<a 
									href={artist.websiteUrl} 
									target="_blank" 
									rel="noopener noreferrer"
									class="social-link"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe-icon lucide-globe"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
									Website
								</a>
							{/if}
							{#if artist.twitterHandle}
								<a 
									href={getTwitterUrl(artist.twitterHandle)} 
									target="_blank" 
									rel="noopener noreferrer"
									class="social-link"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-twitter-icon lucide-twitter"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
									{formatSocialHandle(artist.twitterHandle)}
								</a>
							{/if}
							{#if artist.instagramHandle}
								<a 
									href={getInstagramUrl(artist.instagramHandle)} 
									target="_blank" 
									rel="noopener noreferrer"
									class="social-link"
								>
									<svg class="social-icon" viewBox="0 0 24 24" fill="currentColor">
										<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
										<path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
										<line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
									</svg>
									{formatSocialHandle(artist.instagramHandle)}
								</a>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Artist Addresses -->
				{#if artist.addresses && artist.addresses.length > 0}
					<div class="addresses-section">
						<h3 class="section-title">Wallet Addresses</h3>
						<div class="addresses-list">
							{#each artist.addresses as address}
								<div class="address-item">
									<div class="address-info">
										<span class="blockchain-label">{address.blockchain}</span>
										<span class="address-value" title={address.address}>
											{address.address}
										</span>
									</div>
									{#if getContractUrl(address.address, address.blockchain)}
										<a
											href={getContractUrl(address.address, address.blockchain)}
											target="_blank"
											rel="noopener noreferrer"
											class="address-link"
										>
											View
										</a>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style lang="scss">
	.popover-backdrop {
		@apply fixed inset-0 z-50 flex items-center justify-center p-4;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
	}

	.popover-content {
		@apply relative bg-white dark:bg-black rounded-sm shadow-2xl max-w-[780px];
		width: 100%;
		max-height: 82svh;
	}

	.close-button {
		@apply absolute top-4 right-4 w-8 h-8 flex items-center justify-center;
		@apply text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200;
		@apply bg-transparent border-none cursor-pointer rounded-full;
		@apply hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors;
		font-size: 20px;
		z-index: 10;
	}

	.popover-scroll {
		@apply overflow-y-auto p-6;
		max-height: calc(82svh - 2rem);
	}

	.artist-header {
		@apply flex flex-col items-center text-center mb-6;
	}

	.avatar-container {
		@apply mb-4;
	}

	.popover-content .artist-name {
		@apply text-2xl font-bold text-gray-900 dark:text-white m-0;
		text-transform: none;
		letter-spacing: normal;
	}

	.bio-section,
	.social-section,
	.addresses-section {
		@apply mb-6;
		
		&:last-child {
			@apply mb-0;
		}
	}

	.popover-content .section-title {
		@apply text-lg font-semibold text-gray-900 dark:text-white mb-3;
		text-transform: none;
		letter-spacing: normal;
	}

	.popover-content .bio-text {
		@apply text-gray-700 dark:text-gray-300 leading-relaxed;
		line-height: 1.6;
		text-transform: none;
		letter-spacing: normal;
	}

	.social-links,
	.addresses-list {
		@apply flex flex-col gap-3;
	}

	.popover-content .social-link {
		@apply flex items-center w-full gap-3 p-3 rounded-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors no-underline;
		text-transform: none;
		letter-spacing: normal;
	}

	.social-icon {
		@apply w-5 h-5 flex-shrink-0;
	}

	.address-item {
		@apply flex items-center justify-between p-3 rounded-sm bg-gray-50 dark:bg-gray-950;
		gap: 12px;
	}

	.address-info {
		@apply flex flex-col gap-1;
		flex: 1;
		min-width: 0;
	}

	.blockchain-label {
		@apply text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider;
	}

	.address-value {
		@apply font-mono text-sm text-gray-700 dark:text-gray-300;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 100%;
	}

	.address-link {
		@apply text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 no-underline;
		transition: color 0.2s ease;
	}

	.address-link:hover {
		text-decoration: underline;
	}

	/* Responsive adjustments */
	.popover-content {
		@apply m-4 sm:m-0;
		@apply max-w-[calc(100vw-2rem)] sm:max-w-[780px];
	}
	
	.popover-scroll {
		@apply p-4 sm:p-6;
	}
</style> 