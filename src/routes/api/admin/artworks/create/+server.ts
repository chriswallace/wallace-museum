import prisma from '$lib/prisma';
import { uploadToImageKit } from '$lib/mediaHelpers';
import slugify from 'slugify';
import { fileTypeFromBuffer } from 'file-type';

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image');
		const title = formData.get('title');
		const description = formData.get('description');
		const curatorNotes = formData.get('curatorNotes');

		let artistId = formData.get('artistId');
		const newArtistName = formData.get('newArtistName');
		let collectionId = formData.get('collectionId');
		const newCollectionTitle = formData.get('newCollectionTitle');

		let imageOrVideoUrl = null;
		let isVideo = false;

		if (file) {
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer); // Convert ArrayBuffer to Buffer

			// Only proceed if the mime type is a supported image or video format
			if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
				console.error(`Unsupported media type: ${file.type}`);
				return new Response(JSON.stringify({ error: `Unsupported media type: ${file.type}` }), {
					status: 400
				});
			}

			const uploadResponse = await uploadToImageKit(buffer, file.name, file.type); // Pass both buffer and file name
			if (!uploadResponse) {
				console.error('Failed to upload to ImageKit.');
				return new Response(JSON.stringify({ error: 'Failed to upload to ImageKit.' }), {
					status: 500
				});
			}
			imageOrVideoUrl = uploadResponse.url;
			isVideo = uploadResponse.fileType === 'non-image';
		}

		// Create new artist if provided
		if (newArtistName && !artistId) {
			const newArtist = await prisma.artist.create({ data: { name: newArtistName } });
			artistId = newArtist.id;
		}

		// Create new collection if provided
		if (newCollectionTitle && !collectionId) {
			const collectionSlug = slugify(newCollectionTitle, { lower: true, strict: true });
			const newCollection = await prisma.collection.create({
				data: { title: newCollectionTitle, slug: collectionSlug, enabled: true }
			});
			collectionId = newCollection.id;
		}

		const newArtworkData = {
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
	} catch (error) {
		console.error('Error in POST request:', error.message);
		return new Response(JSON.stringify({ error: 'Error creating new artwork' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
