<script>
    import { page } from '$app/stores';
    import { showToast } from '$lib/toastHelper';
    import { goto } from '$app/navigation';

    let artistId;
    let name = '';
    let bio = '';
    let websiteUrl = '';
    let twitterHandle = '';
    let instagramHandle = '';
    
    $: $page, (artistId = $page.params.id);

    let error = '';

    async function addArtist() {
        const formData = new FormData();
        const fileInput = document.querySelector('input[type="file"]');
        
        // Append the file if available
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        }

        // Append the rest of the form fields
        formData.append('name', name);
        formData.append('bio', bio);
        formData.append('websiteUrl', websiteUrl);
        formData.append('twitterHandle', twitterHandle);
        formData.append('instagramHandle', instagramHandle);

        try {
            const response = await fetch('/api/admin/artists/create', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const responseData = await response.json();
                showToast('Artist added successfully', 'success');
                goto(`/admin/artists/edit/${responseData.id}`); // Correct URL
            } else {
                const { error } = await response.json();
                showToast(error, 'error');
            }
        } catch (e) {
            console.error('Error submitting form:', e);
            showToast('Failed to add artist', 'error');
        }
    }
</script>

<svelte:head>
    <title>Add Artist</title>
</svelte:head>

<div class="max-w-full mx-auto">
    {#if error}
        <p class="error">{error}</p>
    {:else}
        <a class="back-btn" href="/admin/artists">&lt; Back</a>
        <h1>Add Artist</h1>
        <div class="grid grid-cols-2 gap-8">
            <div>
                <div class="file-uploader">
                    <input type="file" name="image" />
                    <label for="image">Upload media (JPG, PNG, GIF, MP4 under 25MB)</label>
                </div>
            </div>
            <div>
                <form on:submit|preventDefault={addArtist}>
                    <div>
                        <label for="name">Name</label>
                        <input type="text" id="name" name="name" bind:value={name} />
                    </div>
                    <div>
                        <label for="bio">Bio</label>
                        <textarea id="bio" name="bio" bind:value={bio}></textarea>
                    </div>
                    <div>
                        <label for="website">Website</label>
                        <input type="url" id="website" name="website" bind:value={websiteUrl} />
                    </div>
                    <div>
                        <label for="twitterHandle">Twitter Handle</label>
                        <input type="text" id="twitterHandle" name="twitterHandle" bind:value={twitterHandle} />
                    </div>
                    <div>
                        <label for="instagramHandle">Instagram Handle</label>
                        <input type="text" id="instagramHandle" name="instagramHandle" bind:value={instagramHandle} />
                    </div>
                    <div class="flex justify-between">
                        <button class="primary" type="submit">Add Artist</button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<style>
    h1 {
        margin-bottom: 3rem; /* Example styling */
    }

    .error {
        color: red;
    }

    form > div {
        margin-bottom: 1rem;
    }

    label {
        display: block;
        font-weight: bold;
        margin-bottom: 0.5rem;
    }

    input[type="text"],
    input[type="url"],
    textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
</style>