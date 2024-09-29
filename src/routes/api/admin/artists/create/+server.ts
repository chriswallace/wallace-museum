import prisma from '$lib/prisma';
import { uploadToImageKit } from '$lib/mediaHelpers';

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image');
		const name = formData.get('name');
		const bio = formData.get('bio');
		const websiteUrl = formData.get('websiteUrl');
		const twitterHandle = formData.get('twitterHandle');
		const instagramHandle = formData.get('instagramHandle');
		let avatarUrl = null;

		if (file && file.name && file.type) {
			const buffer = Buffer.from(await file.arrayBuffer()); // Convert ArrayBuffer to Buffer
			const mimeType = file.type; // Get the MIME type of the file
			const uploadResponse = await uploadToImageKit(buffer, file.name, mimeType); // Pass buffer, file name, and MIME type
			avatarUrl = uploadResponse.url;
		} else if (file) {
			throw new Error('Invalid file uploaded');
		}

		const newArtistData = {
			name,
			bio,
			websiteUrl,
			twitterHandle,
			instagramHandle,
			avatarUrl
		};

		const newArtist = await prisma.artist.create({
			data: newArtistData
		});

		return new Response(JSON.stringify(newArtist), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error in POST request:', error.message);
		return new Response(JSON.stringify({ error: 'Error creating new artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
