<script lang="ts">
	import { placeholderAvatar } from '$lib/utils';
	import { updateArtist, deleteArtist } from '$lib/artistActions';
	import { showToast } from '$lib/toastHelper';
	import { createEventDispatcher } from 'svelte';
	import { onMount } from 'svelte';

	interface Artwork {
		id: number;
		title: string;
		image_url: string;
		enabled: boolean;
	}

	interface ArtistArtwork {
		artwork: Artwork;
	}

	interface ArtistAddress {
		id: number;
		address: string;
		blockchain: string;
		createdAt: Date;
		updatedAt: Date;
	}

	interface Artist {
		id: number;
		name: string;
		bio: string | null;
		avatarUrl: string | null;
		websiteUrl: string | null;
		twitterHandle: string | null;
		instagramHandle: string | null;
		ArtistArtworks: ArtistArtwork[];
		addresses: ArtistAddress[];
	}

	export let artist: Artist;

	let isUploadingAvatar = false;
	let fileInputRef: HTMLInputElement;
	let newAddress = {
		address: '',
		blockchain: 'ethereum'
	};

	async function confirmAndDelete() {
		const artworksMessage =
			artist.ArtistArtworks && artist.ArtistArtworks.length > 0
				? `\n\nWarning: This artist has ${artist.ArtistArtworks.length} associated artwork(s). Deleting the artist will remove these associations.`
				: '';

		if (window.confirm(`Are you sure you want to delete ${artist.name}?${artworksMessage}`)) {
			await deleteArtist(artist.id);
		}
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		isUploadingAvatar = true;
		showToast('Uploading avatar...', 'info');

		try {
			const formData = new FormData();
			formData.append('image', file);
			formData.append('artistId', artist.id.toString());

			const response = await fetch('/api/admin/artists/avatar', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const data = await response.json();
				artist.avatarUrl = data.avatarUrl;
				showToast('Avatar updated successfully.', 'success');
			} else {
				throw new Error('Failed to upload avatar');
			}
		} catch (error) {
			console.error('Error uploading avatar:', error);
			const message = error instanceof Error ? error.message : 'Unknown error';
			showToast(`Avatar upload failed: ${message}`, 'error');
		} finally {
			isUploadingAvatar = false;
			if (input) {
				input.value = '';
			}
		}
	}

	async function addAddress() {
		if (!newAddress.address) return;

		try {
			console.log('Sending request to add address:', newAddress);
			const response = await fetch(`/api/admin/artists/${artist.id}/addresses`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(newAddress)
			});

			if (response.ok) {
				const address = await response.json();
				console.log('Successfully added address:', address);
				artist.addresses = [...artist.addresses, address];
				newAddress = { address: '', blockchain: 'ethereum' };
				showToast('Address added successfully.', 'success');
			} else {
				// Try to get detailed error message
				let errorMessage = 'Failed to add address.';
				try {
					const errorData = await response.json();
					console.error('Server error response:', errorData);
					errorMessage = errorData.details || errorData.error || errorMessage;
				} catch (e) {
					console.error('Could not parse error response');
				}
				showToast(errorMessage, 'error');
			}
		} catch (error) {
			console.error('Client-side error adding address:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			showToast(`Failed to add address: ${errorMessage}`, 'error');
		}
	}

	async function removeAddress(addressId: number) {
		if (!confirm('Are you sure you want to remove this address?')) return;

		try {
			const response = await fetch(`/api/admin/artists/${artist.id}/addresses/${addressId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				artist.addresses = artist.addresses.filter((a) => a.id !== addressId);
				showToast('Address removed successfully.', 'success');
			} else {
				showToast('Failed to remove address.', 'error');
			}
		} catch (error) {
			showToast('Failed to remove address.', 'error');
		}
	}
</script>

<form
	on:submit|preventDefault={() => updateArtist(artist)}
	class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start"
>
	<div class="md:col-span-1 relative group">
		{#if artist.name}
			<img
				class="avatar w-full h-auto object-contain"
				src={artist.avatarUrl || placeholderAvatar(artist.name)}
				alt={artist.name}
			/>
			<button
				type="button"
				on:click={() => fileInputRef?.click()}
				disabled={isUploadingAvatar}
				class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if isUploadingAvatar}
					<span>Uploading...</span>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-8 w-8"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
						/>
					</svg>
				{/if}
			</button>
			<input
				type="file"
				class="hidden"
				accept="image/png, image/jpeg, image/gif, image/webp"
				bind:this={fileInputRef}
				on:change={handleFileSelect}
				disabled={isUploadingAvatar}
			/>
		{/if}
	</div>
	<div class="md:col-span-2 space-y-4">
		<div class="mb-4">
			<label for="name">Name</label>
			<input type="text" id="name" bind:value={artist.name} />
		</div>
		<div class="mb-4">
			<label for="bio">Bio</label>
			<textarea id="bio" bind:value={artist.bio}></textarea>
		</div>
		<div class="mb-4">
			<label for="websiteUrl">Website</label>
			<input type="url" id="websiteUrl" bind:value={artist.websiteUrl} />
		</div>
		<div class="mb-4">
			<label for="twitterHandle">Twitter Handle</label>
			<input type="text" id="twitterHandle" bind:value={artist.twitterHandle} />
		</div>
		<div class="mb-4">
			<label for="instagramHandle">Instagram Handle</label>
			<input type="text" id="instagramHandle" bind:value={artist.instagramHandle} />
		</div>
	</div>
	<div class="md:col-span-3 mt-8">
		<h2 class="text-2xl font-bold mb-4">Blockchain Addresses</h2>
		<div class="space-y-4">
			{#if artist.addresses && artist.addresses.length > 0}
				<div class="grid grid-cols-1 gap-4">
					{#each artist.addresses as address}
						<div
							class="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-4 rounded-lg"
						>
							<div>
								<p class="font-mono">{address.address}</p>
								<p class="text-sm text-gray-600 dark:text-gray-300">{address.blockchain}</p>
							</div>
							<button
								type="button"
								class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
								on:click={() => removeAddress(address.id)}
							>
								Remove
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-500 dark:text-gray-400">No addresses added yet.</p>
			{/if}

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
				<div class="mb-4">
					<label for="newAddress">New Address</label>
					<input type="text" id="newAddress" bind:value={newAddress.address} placeholder="0x..." />
				</div>
				<div class="mb-4">
					<label for="blockchain">Blockchain</label>
					<select id="blockchain" bind:value={newAddress.blockchain}>
						<option value="ethereum">Ethereum</option>
						<option value="polygon">Polygon</option>
						<option value="tezos">Tezos</option>
					</select>
				</div>
			</div>
			<button type="button" class="primary" on:click={addAddress} disabled={!newAddress.address}>
				Add Address
			</button>
		</div>
	</div>
	<div class="md:col-span-3 flex justify-between mt-4">
		<button class="destructive" on:click={confirmAndDelete} type="button">Delete Artist</button>
		<button class="primary" type="submit">Save details</button>
	</div>
</form>

<div class="mt-8 md:col-span-3">
	<h2 class="text-2xl font-bold mb-4">Artworks</h2>
	{#if artist.ArtistArtworks && artist.ArtistArtworks.length > 0}
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
			{#each artist.ArtistArtworks as aa}
				<a href="/admin/artworks/edit/{aa.artwork.id}" class="artwork-card">
					<div class="aspect-square relative">
						<img
							src={aa.artwork.image_url}
							alt={aa.artwork.title}
							class="w-full h-full object-contain rounded-lg"
						/>
						{#if !aa.artwork.enabled}
							<div class="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
								Disabled
							</div>
						{/if}
					</div>
					<h3 class="mt-2 text-sm font-medium truncate">{aa.artwork.title}</h3>
				</a>
			{/each}
		</div>
	{:else}
		<div class="text-gray-500 dark:text-gray-400 text-center py-8">
			<p>No artworks found for this artist.</p>
			<a
				href="/admin/artworks/new"
				class="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
				>Add New Artwork</a
			>
		</div>
	{/if}
</div>

<style>
	.avatar {
		display: block;
		pointer-events: none;
	}

	.artwork-card {
		@apply block transition-transform hover:scale-105;
	}
</style>
