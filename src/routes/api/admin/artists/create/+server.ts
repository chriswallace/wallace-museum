import prisma from '$lib/prisma';
import { uploadToPinata } from '$lib/pinataHelpers';

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File | null;
		const name = formData.get('name') as string;
		const bio = formData.get('bio') as string;
		const websiteUrl = formData.get('websiteUrl') as string;
		const twitterHandle = formData.get('twitterHandle') as string;
		const instagramHandle = formData.get('instagramHandle') as string;
		let avatarUrl = null;

		if (file && file instanceof File) {
			const buffer = Buffer.from(await file.arrayBuffer());
			const mimeType = file.type;
			const uploadResponse = await uploadToPinata(buffer, file.name, mimeType);
			if (uploadResponse) {
				avatarUrl = uploadResponse.url;
			}
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
	} catch (error: unknown) {
		console.error('Error in POST request:', error instanceof Error ? error.message : String(error));
		return new Response(JSON.stringify({ error: 'Error creating new artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
