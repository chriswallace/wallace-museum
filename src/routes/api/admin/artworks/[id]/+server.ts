import prisma from '$lib/prisma';

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
		artists: artwork.ArtistArtworks.map(aa => aa.artist)
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
	const { artistIds, ...artworkData } = data;

	try {
		const updatedArtwork = await prisma.$transaction(async (tx) => {
			const basicUpdate = await tx.artwork.update({
				where: { id: artworkId },
				data: {
					enabled: artworkData.enabled,
					title: artworkData.title,
					description: artworkData.description,
					collectionId: artworkData.collectionId
				},
			});

			if (artistIds && Array.isArray(artistIds)) {
				await tx.artistArtworks.deleteMany({
					where: { artworkId: artworkId },
				});

				if (artistIds.length > 0) {
					await tx.artistArtworks.createMany({
						data: artistIds.map((artistId) => ({
							artworkId: artworkId,
							artistId: parseInt(artistId, 10),
						})),
						skipDuplicates: true,
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
				artists: finalArtwork.ArtistArtworks.map(aa => aa.artist)
			};

			return transformedFinalArtwork;
		});

		return new Response(JSON.stringify(updatedArtwork), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error("Error updating artwork:", error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: 'Error updating artwork', details: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
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
		console.error("Error deleting artwork:", error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(JSON.stringify({ error: 'Error deleting artwork', details: errorMessage }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
