import { showToast } from '$lib/toastHelper';
import { goto } from '$app/navigation';

export async function updateArtist(artist) {
    const response = await fetch(`/api/admin/artists/${artist.id}`, {
        method: 'PUT',
        headers: {
        'Content-Type': 'application/json'
        },
        body: JSON.stringify(artist)
    });

    if (response.ok) {
        showToast('Artist details saved.', 'success');
    } else {
        showToast('Failed to update artist details.', 'error');
    }
}

export async function deleteArtist(artistId) {
    console.log('Deleting artist', artistId);
    const response = await fetch(`/api/admin/artists/${artistId}`, {
        method: 'DELETE'
    });

    if (response.ok) {
        showToast('Artist deleted.', 'success');
        goto('/admin/artists');
    } else {
        showToast('Failed to delete artist.', 'error');
    }
}