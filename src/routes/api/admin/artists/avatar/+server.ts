import prisma from '$lib/prisma';
import { uploadAvatarImage } from '$lib/avatarUpload';

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const image = formData.get('image') as File;
		const artistId = parseInt(formData.get('artistId') as string, 10);

		if (!image || !artistId) {
			return new Response(JSON.stringify({ error: 'Missing required fields' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Upload image to Cloudinary using our new function
		const uploadResult = await uploadAvatarImage(image);

		// Update artist with new avatar URL
		const updatedArtist = await prisma.artist.update({
			where: { id: artistId },
			data: { avatarUrl: uploadResult.url }
		});

		return new Response(JSON.stringify({ avatarUrl: uploadResult.url }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error uploading avatar:', error);
		return new Response(JSON.stringify({ error: 'Failed to upload avatar' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
