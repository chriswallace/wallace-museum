import prisma from '$lib/prisma';
import { getCloudinaryImageDimensions } from '$lib/mediaHelpers';

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

// GET: Fetch Artwork Details
export async function GET({ params }) {
	const { id } = params;
	const artwork = await prisma.artwork.findUnique({
		where: { id: parseInt(id, 10) },
		include: {
			collection: true,
			ArtistArtworks: {
				include: {
					artist: true
				}
			}
		}
	});

	if (!artwork) {
		return new Response(JSON.stringify({ error: 'Artwork not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const transformedArtwork = {
		...artwork,
		artists: artwork.ArtistArtworks.map((aa) => aa.artist)
	};

	return new Response(JSON.stringify(transformedArtwork), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Artwork Details
export async function PUT({ params, request }) {
	const { id } = params;
	const artworkId = parseInt(id, 10);
	const data = await request.json();
	const { artistIds, image_url, animation_url, mime, ...artworkData } = data;

	try {
		// Check if a new image URL was provided and it's from Cloudinary
		let dimensions = null;
		if (image_url && image_url.includes('cloudinary.com')) {
			dimensions = await getCloudinaryImageDimensions(image_url);
			if (dimensions) {
				console.log(
					`Retrieved dimensions for updated image: ${dimensions.width}x${dimensions.height}`
				);
			}
		}

		// If mime type isn't provided but animation_url is, try to guess from URL
		let mimeType = mime;
		if (animation_url && !mime) {
			const guessedType = guessMimeTypeFromUrl(animation_url);
			if (guessedType) {
				mimeType = guessedType;
				console.log(`Guessed mime type for animation_url: ${mimeType}`);
			}
		}

		const updatedArtwork = await prisma.$transaction(async (tx) => {
			// Build the update data object with proper typing
			const updateData: {
				enabled: any;
				title: any;
				description: any;
				collectionId: any;
				image_url?: string;
				animation_url?: string;
				mime?: string;
				dimensions?: any;
			} = {
				enabled: artworkData.enabled,
				title: artworkData.title,
				description: artworkData.description,
				collectionId: artworkData.collectionId
			};

			// Add image_url if provided
			if (image_url) {
				updateData.image_url = image_url;

				// Set mime type for image if no animation_url is present
				if (!animation_url && !mimeType) {
					const guessedType = guessMimeTypeFromUrl(image_url);
					if (guessedType && guessedType.startsWith('image/')) {
						updateData.mime = guessedType;
					}
				}
			}

			// Add animation_url if provided
			if (animation_url !== undefined) {
				updateData.animation_url = animation_url;

				// Set mime type for animation content
				if (mimeType) {
					updateData.mime = mimeType;
				} else {
					const guessedType = guessMimeTypeFromUrl(animation_url);
					if (guessedType) {
						updateData.mime = guessedType;
					}
				}
			} else if (!image_url) {
				// Only clear mime type if we have neither animation_url nor image_url
				updateData.mime = undefined;
			}

			// Add dimensions if retrieved
			if (dimensions) {
				updateData.dimensions = {
					width: dimensions.width,
					height: dimensions.height
				};
			}

			const basicUpdate = await tx.artwork.update({
				where: { id: artworkId },
				data: updateData
			});

			if (artistIds && Array.isArray(artistIds)) {
				await tx.artistArtworks.deleteMany({
					where: { artworkId: artworkId }
				});

				if (artistIds.length > 0) {
					await tx.artistArtworks.createMany({
						data: artistIds.map((artistId) => ({
							artworkId: artworkId,
							artistId: parseInt(artistId, 10)
						})),
						skipDuplicates: true
					});
				}
			}

			const finalArtwork = await tx.artwork.findUnique({
				where: { id: artworkId },
				include: {
					collection: true,
					ArtistArtworks: {
						include: {
							artist: true
						}
					}
				}
			});

			if (!finalArtwork) {
				throw new Error('Artwork not found after update transaction.');
			}
			const transformedFinalArtwork = {
				...finalArtwork,
				artists: finalArtwork.ArtistArtworks.map((aa) => aa.artist)
			};

			return transformedFinalArtwork;
		});

		return new Response(JSON.stringify(updatedArtwork), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error updating artwork:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ error: 'Error updating artwork', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

// DELETE: Delete Artwork
export async function DELETE({ params }) {
	const { id } = params;

	try {
		await prisma.artwork.delete({
			where: { id: parseInt(id, 10) }
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting artwork:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ error: 'Error deleting artwork', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
