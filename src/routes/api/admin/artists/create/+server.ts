import { prismaWrite } from '$lib/prisma';
import { uploadAvatarImage } from '$lib/avatarUpload';
import { cachedArtistQueries, cachedSearchQueries } from '$lib/cache/db-cache';

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
			const uploadResult = await uploadAvatarImage(file);
			avatarUrl = uploadResult.url;
		} else if (file) {
			throw new Error('Invalid file uploaded');
		}

		const newArtistData = {
			name,
			bio,
			websiteUrl,
			twitterHandle,
			instagramHandle,
			avatarUrl,
			updatedAt: new Date()
		};

		const newArtist = await prismaWrite.artist.create({
			data: newArtistData
		});

		// Invalidate artist cache since a new artist was created
		await cachedArtistQueries.invalidate();

		// Invalidate search cache since artist data has changed
		await cachedSearchQueries.invalidate();

		// Fetch the complete artist data with all relationships for immediate use
		const completeArtist = await prismaWrite.artist.findUnique({
			where: { id: newArtist.id },
			include: {
				Collection: true,
				Artwork: true
			}
		});

		return new Response(JSON.stringify(completeArtist || newArtist), {
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
