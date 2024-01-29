import prisma from '$lib/prisma';
import { uploadToImageKit } from '$lib/imageKitUploader.js';
import slugify from 'slugify';

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
            const uploadResponse = await uploadToImageKit(file.stream(), file.name);
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
            title,
            description,
            curatorNotes,
            enabled: true,
            artistId: artistId ? parseInt(artistId) : null,
            collectionId: collectionId ? parseInt(collectionId) : null
        };

        // Assign to the appropriate field based on file type
        if (isVideo) {
            newArtworkData.video = imageOrVideoUrl;
        } else {
            newArtworkData.image = imageOrVideoUrl;
        }

        console.log('newArtworkData', newArtworkData);

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