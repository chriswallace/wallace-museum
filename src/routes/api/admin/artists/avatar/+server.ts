import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { artistId, avatarUrl } = await request.json();
		
		if (!artistId || !avatarUrl) {
			return json({ error: 'Artist ID and avatar URL are required' }, { status: 400 });
		}
		
		// Validate that the artist exists
		const existingArtist = await db.read.artist.findUnique({
			where: { id: parseInt(artistId) }
		});
		
		if (!existingArtist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}
		
		// Update the artist's avatar
		const updatedArtist = await db.write.artist.update({
			where: { id: parseInt(artistId) },
			data: { avatarUrl }
		});
		
		return json({ 
			success: true, 
			artist: updatedArtist,
			message: 'Avatar updated successfully'
		});
	} catch (error) {
		console.error('Error updating artist avatar:', error);
		return json({ error: 'Failed to update avatar' }, { status: 500 });
	}
};
