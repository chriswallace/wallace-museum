import prisma from '$lib/prisma';
import { uploadToImageKit } from '$lib/mediaHelpers';
import slugify from 'slugify';

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('profileImage');
		const name = formData.get('name');
		const bio = formData.get('bio');
		const website = formData.get('website');
		const twitterHandle = formData.get('twitterHandle');
		const instagramHandle = formData.get('instagramHandle');
		let avatarUrl = null;

		if (file) {
			const buffer = await file.arrayBuffer();
			const uploadResponse = await uploadToImageKit(buffer, file.name);

			avatarUrl = uploadResponse.url;
		}

		const newArtistData = {
			name,
			bio,
			websiteUrl: website,
			twitterHandle,
			instagramHandle,
			avatarUrl,
			slug: slugify(name, { lower: true, strict: true }),
			enabled: true
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
