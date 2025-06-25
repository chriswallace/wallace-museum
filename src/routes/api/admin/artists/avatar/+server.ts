import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/prisma';
import { uploadToPinata, convertToIpfsUrl } from '$lib/pinataHelpers';

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('[AVATAR_UPLOAD] Starting avatar upload process');
		
		const formData = await request.formData();
		const file = formData.get('image') as File;
		const artistId = formData.get('artistId') as string;
		
		console.log('[AVATAR_UPLOAD] Form data received:', {
			hasFile: !!file,
			fileName: file?.name,
			fileType: file?.type,
			fileSize: file?.size,
			artistId
		});
		
		if (!file || !file.name || !file.type) {
			console.error('[AVATAR_UPLOAD] Invalid file uploaded:', { file: !!file, name: file?.name, type: file?.type });
			return json({ error: 'Invalid file uploaded' }, { status: 400 });
		}
		
		if (!artistId) {
			console.error('[AVATAR_UPLOAD] Artist ID is required');
			return json({ error: 'Artist ID is required' }, { status: 400 });
		}
		
		// Validate that the artist exists
		console.log('[AVATAR_UPLOAD] Checking if artist exists:', artistId);
		const existingArtist = await db.read.artist.findUnique({
			where: { id: parseInt(artistId) }
		});
		
		if (!existingArtist) {
			console.error('[AVATAR_UPLOAD] Artist not found:', artistId);
			return json({ error: 'Artist not found' }, { status: 404 });
		}
		
		console.log('[AVATAR_UPLOAD] Artist found:', existingArtist.name);
		
		// Upload the image to Pinata
		console.log('[AVATAR_UPLOAD] Starting Pinata upload');
		const buffer = Buffer.from(await file.arrayBuffer());
		const uploadResponse = await uploadToPinata(buffer, file.name, file.type);
		
		console.log('[AVATAR_UPLOAD] Pinata upload response:', {
			success: !!uploadResponse,
			hasUrl: uploadResponse?.url ? 'yes' : 'no',
			hasHash: uploadResponse?.IpfsHash ? 'yes' : 'no',
			hash: uploadResponse?.IpfsHash
		});
		
		if (!uploadResponse || !uploadResponse.IpfsHash) {
			console.error('[AVATAR_UPLOAD] Pinata upload failed or returned invalid response:', uploadResponse);
			return json({ error: 'Image upload failed - no IPFS hash returned' }, { status: 500 });
		}
		
		// Convert the gateway URL to IPFS format for storage
		const ipfsUrl = `ipfs://${uploadResponse.IpfsHash}`;
		console.log('[AVATAR_UPLOAD] Generated IPFS URL:', ipfsUrl);
		
		// Update the artist's avatar with the IPFS URL
		console.log('[AVATAR_UPLOAD] Updating artist avatar in database');
		const updatedArtist = await db.write.artist.update({
			where: { id: parseInt(artistId) },
			data: { avatarUrl: ipfsUrl }
		});
		
		console.log('[AVATAR_UPLOAD] Avatar updated successfully for artist:', updatedArtist.name);
		
		return json({ 
			success: true, 
			artist: updatedArtist,
			avatarUrl: ipfsUrl,
			message: 'Avatar updated successfully'
		});
	} catch (error) {
		console.error('[AVATAR_UPLOAD] Error updating artist avatar:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: 'Failed to update avatar', details: message }, { status: 500 });
	}
};
