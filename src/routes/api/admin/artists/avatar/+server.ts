import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import { uploadToPinata, convertToIpfsUrl } from '$lib/pinataHelpers';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const artistId = formData.get('artistId') as string;
		
		if (!file || !file.name || !file.type) {
			return json({ error: 'Invalid file uploaded' }, { status: 400 });
		}
		
		if (!artistId) {
			return json({ error: 'Artist ID is required' }, { status: 400 });
		}
		
		// Validate that the artist exists
		const existingArtist = await db.read.artist.findUnique({
			where: { id: parseInt(artistId) }
		});
		
		if (!existingArtist) {
			return json({ error: 'Artist not found' }, { status: 404 });
		}
		
		// Upload the image to Pinata
		const buffer = Buffer.from(await file.arrayBuffer());
		const uploadResponse = await uploadToPinata(buffer, file.name, file.type);
		
		if (!uploadResponse || !uploadResponse.url) {
			console.error('Pinata upload failed or returned invalid response:', uploadResponse);
			return json({ error: 'Image upload failed' }, { status: 500 });
		}
		
		// Convert the gateway URL to IPFS format for storage
		const ipfsUrl = `ipfs://${uploadResponse.IpfsHash}`;
		
		// Update the artist's avatar with the IPFS URL
		const updatedArtist = await db.write.artist.update({
			where: { id: parseInt(artistId) },
			data: { avatarUrl: ipfsUrl }
		});
		
		return json({ 
			success: true, 
			artist: updatedArtist,
			avatarUrl: ipfsUrl,
			message: 'Avatar updated successfully'
		});
	} catch (error) {
		console.error('Error updating artist avatar:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: 'Failed to update avatar', details: message }, { status: 500 });
	}
};
