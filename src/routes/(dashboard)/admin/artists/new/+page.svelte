<script lang="ts">
	import { page } from '$app/stores';
	import { showToast } from '$lib/toastHelper';
	import { goto } from '$app/navigation';
	import { cleanTwitterHandle, cleanInstagramHandle } from '$lib/utils/socialMediaUtils';

	let artistId;
	let name = '';
	let bio = '';
	let websiteUrl = '';
	let twitterHandle = '';
	let instagramHandle = '';

	$: $page, (artistId = $page.params.id);

	let error = '';

	function goBack() {
		history.back();
	}

	async function addArtist() {
		const formData = new FormData();
		const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

		// Append the file if available
		if (fileInput?.files?.[0]) {
			formData.append('image', fileInput.files[0]);
		}

		// Clean social media handles before submitting
		const cleanedTwitterHandle = cleanTwitterHandle(twitterHandle);
		const cleanedInstagramHandle = cleanInstagramHandle(instagramHandle);

		// Append the rest of the form fields
		formData.append('name', name);
		formData.append('bio', bio);
		formData.append('websiteUrl', websiteUrl);
		formData.append('twitterHandle', cleanedTwitterHandle);
		formData.append('instagramHandle', cleanedInstagramHandle);

		try {
			const response = await fetch('/api/admin/artists/create', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const responseData = await response.json();
				showToast('Artist added successfully', 'success');
				setTimeout(() => {
					goto(`/admin/artists/edit/${responseData.id}`);
				}, 100);
			} else {
				const { error } = await response.json();
				showToast(error, 'error');
			}
		} catch (error) {
			console.error('Error submitting form:', error);
			showToast('Failed to add artist', 'error');
		}
	}
</script>

<svelte:head>
	<title>Add Artist | Wallace Museum Admin</title>
</svelte:head>

<div class="max-w-full mx-auto">
	{#if error}
		<p class="error">{error}</p>
	{:else}
		<button class="back-btn" on:click={goBack}>&lt; Back</button>
		<div class="admin-header">
			<h1>Add Artist</h1>
		</div>
		<div class="grid grid-cols-2 gap-8">
			<div>
				<div class="file-uploader">
					<input type="file" name="image" />
					<label for="image">Upload media (JPG, PNG, GIF, MP4 under 25MB)</label>
				</div>
			</div>
			<div>
				<form on:submit|preventDefault={addArtist}>
					<div class="mb-4">
						<label for="name">Name</label>
						<input type="text" id="name" name="name" bind:value={name} />
					</div>
					<div class="mb-4">
						<label for="bio">Bio</label>
						<textarea id="bio" name="bio" bind:value={bio}></textarea>
					</div>
					<div class="mb-4">
						<label for="website">Website</label>
						<input type="url" id="website" name="website" bind:value={websiteUrl} />
					</div>
					<div class="mb-4">
						<label for="twitterHandle">Twitter Handle (without @)</label>
						<input type="text" id="twitterHandle" name="twitterHandle" bind:value={twitterHandle} placeholder="username" />
					</div>
					<div class="mb-4">
						<label for="instagramHandle">Instagram Handle (without @)</label>
						<input
							type="text"
							id="instagramHandle"
							name="instagramHandle"
							bind:value={instagramHandle}
							placeholder="username"
						/>
					</div>
					<div class="flex justify-between">
						<button class="save" type="submit">Add Artist</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>

<style>
	h1 {
		margin-bottom: 3rem;
	}
</style>
