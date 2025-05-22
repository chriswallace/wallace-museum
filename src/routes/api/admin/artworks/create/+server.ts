import prisma from '$lib/prisma';
import { uploadToCloudinary, getCloudinaryImageDimensions } from '$lib/mediaHelpers';
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
	dimensions?: any; // Changed to any to be compatible with Prisma's JSON type
	mime?: string;
}

// Simple function to guess mime type from URL
function guessMimeTypeFromUrl(url: string): string | null {
	// Check extensions
	if (url.match(/\.(mp4|webm|mov)$/i)) return 'video/mp4';
	if (url.match(/\.(jpg|jpeg)$/i)) return 'image/jpeg';
	if (url.match(/\.(png)$/i)) return 'image/png';
	if (url.match(/\.(gif)$/i)) return 'image/gif';
	if (url.match(/\.(webp)$/i)) return 'image/webp';
	if (url.match(/\.(pdf)$/i)) return 'application/pdf';
	if (url.match(/\.(html|htm)$/i)) return 'text/html';
	if (url.match(/\.(js)$/i)) return 'application/javascript';

	// Check for common patterns
	if (url.includes('cloudinary.com')) {
		if (url.includes('/video/')) return 'video/mp4';
		if (url.includes('/image/')) return 'image/jpeg';
	}

	// For common interactive art platforms
	if (url.includes('fxhash.xyz') || url.includes('generator.artblocks.io')) {
		return 'application/javascript';
	}

	return null;
}

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('image') as File | null;
		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const curatorNotes = formData.get('curatorNotes') as string;
		const animation_url = formData.get('animation_url') as string | null;

		let artistId = formData.get('artistId') as string | null;
		const newArtistName = formData.get('newArtistName') as string | null;
		let collectionId = formData.get('collectionId') as string | null;
		const newCollectionTitle = formData.get('newCollectionTitle') as string | null;

		let imageOrVideoUrl = null;
		let isVideo = false;
		let dimensions = null;
		let mimeType = null;

		// Handle file upload
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
			dimensions = uploadResponse.dimensions;
			mimeType = file.type; // Get MIME type directly from file
			console.log(`Uploaded file with mime type: ${mimeType}`);
		} else {
			// If we have an image URL from a previous upload
			const existingUrl = formData.get('imageUrl') as string | null;
			if (existingUrl) {
				imageOrVideoUrl = existingUrl;

				// Simple mime type detection for existing URL
				const guessedType = guessMimeTypeFromUrl(existingUrl);
				if (guessedType) {
					mimeType = guessedType;
					isVideo = guessedType.startsWith('video/');
				}
			}
		}

		// Handle animation_url if provided
		if (animation_url) {
			const animationMimeType = guessMimeTypeFromUrl(animation_url);
			if (animationMimeType) {
				mimeType = animationMimeType;
				isVideo = animationMimeType.startsWith('video/');
			}
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

		// Prioritize animation_url if provided
		if (animation_url) {
			newArtworkData.animation_url = animation_url;

			// Set mime type for animation content
			const animationMimeType = guessMimeTypeFromUrl(animation_url);
			if (animationMimeType) {
				newArtworkData.mime = animationMimeType;
			}

			// If we have a file upload too, use it as the image_url
			if (imageOrVideoUrl) {
				newArtworkData.image_url = imageOrVideoUrl;
			}
		} else if (imageOrVideoUrl) {
			// If no animation_url, handle image/video content
			if (isVideo) {
				newArtworkData.animation_url = imageOrVideoUrl;
				if (mimeType && mimeType.startsWith('video/')) {
					newArtworkData.mime = mimeType;
				}
			} else {
				newArtworkData.image_url = imageOrVideoUrl;
				if (mimeType && mimeType.startsWith('image/')) {
					newArtworkData.mime = mimeType;
				}
			}
		}

		// Store the dimensions if available
		if (dimensions && dimensions.width && dimensions.height) {
			newArtworkData.dimensions = {
				width: dimensions.width,
				height: dimensions.height
			};
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
