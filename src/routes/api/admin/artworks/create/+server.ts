import prisma from '$lib/prisma';
import { uploadToCloudinary } from '$lib/mediaHelpers';
import slugify from 'slugify';
import { fileTypeFromBuffer } from 'file-type';

interface ArtworkData {
	title: string;
	description: string;
	curatorNotes: string;
	enabled: boolean;
	artistId: number | null;
	collectionId: number | null;
	animation_url?: string | null;
	image_url?: string | null;
}

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File | null;
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const curatorNotes = formData.get('curatorNotes') as string;

		let artistId = formData.get('artistId') as string | null;
		const newArtistName = formData.get('newArtistName') as string | null;
		let collectionId = formData.get('collectionId') as string | null;
		const newCollectionTitle = formData.get('newCollectionTitle') as string | null;

		let imageOrVideoUrl = null;
		let isVideo = false;

		if (file && file instanceof File) {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer

			// Only proceed if the mime type is a supported image or video format
			if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
				console.error(`Unsupported media type: ${file.type}`);
				return new Response(JSON.stringify({ error: `Unsupported media type: ${file.type}` }), {
					status: 400
				});
			}

			const uploadResponse = await uploadToCloudinary(buffer, file.name, file.type);
			if (!uploadResponse) {
				console.error('Failed to upload to Cloudinary.');
				return new Response(JSON.stringify({ error: 'Failed to upload to Cloudinary.' }), {
					status: 500
				});
			}
			imageOrVideoUrl = uploadResponse.url;
			isVideo = file.type.startsWith('video/');
		}

		// Create new artist if provided
		if (newArtistName && !artistId) {
			const newArtist = await prisma.artist.create({ data: { name: newArtistName } });
			artistId = String(newArtist.id);
		}

		// Create new collection if provided
		if (newCollectionTitle && !collectionId) {
			const collectionSlug = slugify(newCollectionTitle, { lower: true, strict: true });
			const newCollection = await prisma.collection.create({
				data: { title: newCollectionTitle, slug: collectionSlug, enabled: true }
			});
			collectionId = String(newCollection.id);
		}

		const newArtworkData: ArtworkData = {
			title: title ? String(title) : '',
			description: description ? String(description) : '',
			curatorNotes: curatorNotes ? String(curatorNotes) : '',
			enabled: true,
			artistId: artistId ? parseInt(String(artistId)) : null,
			collectionId: collectionId ? parseInt(String(collectionId)) : null
		};

		// Assign to the appropriate field based on file type
		if (isVideo) {
			newArtworkData.animation_url = imageOrVideoUrl;
		} else {
			newArtworkData.image_url = imageOrVideoUrl;
		}

		const newArtwork = await prisma.artwork.create({
			data: newArtworkData
		});

		return new Response(JSON.stringify(newArtwork), {
			status: 201,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: unknown) {
		console.error('Error in POST request:', error instanceof Error ? error.message : String(error));
		return new Response(JSON.stringify({ error: 'Error creating new artwork' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
