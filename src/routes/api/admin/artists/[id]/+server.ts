import prisma from '$lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma types

// Define a type for the artist object including relations we expect
type ArtistWithRelations = Prisma.ArtistGetPayload<{
	include: {
		collections: true; // Keep this if needed
		ArtistArtworks: {
			include: {
				artwork: true;
			};
		};
	};
}>;

// GET: Fetch Artist Details
export async function GET({ params }) {
	const { id } = params;

	try {
		const artist = await prisma.artist.findUnique({
			where: { id: parseInt(id, 10) },
			include: {
				ArtistArtworks: {
					include: {
						artwork: {
							select: {
								id: true,
								title: true,
								image_url: true,
								enabled: true
							}
						}
					}
				}
			}
		});

		if (!artist) {
			return new Response(JSON.stringify({ error: 'Artist not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		return new Response(JSON.stringify(artist), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error fetching artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// PUT: Update Artist Details
export async function PUT({ params, request }) {
	const { id } = params;
	const data = await request.json();

	try {
		const updatedArtist = await prisma.artist.update({
			where: { id: parseInt(id, 10) },
			data: {
				name: data.name,
				bio: data.bio,
				websiteUrl: data.websiteUrl,
				twitterHandle: data.twitterHandle,
				instagramHandle: data.instagramHandle,
				avatarUrl: data.avatarUrl,
				collections: {
					set: data.collectionIds?.map((collectionId: number) => ({
						id: collectionId
					}))
				}
			},
			include: {
				addresses: true,
				ArtistArtworks: {
					include: {
						artwork: {
							select: {
								id: true,
								title: true,
								image_url: true,
								enabled: true
							}
						}
					}
				}
			}
		});

		return new Response(JSON.stringify(updatedArtist), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'Error updating artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// DELETE: Delete Artist
export async function DELETE({ params }) {
	const { id } = params;

	try {
		await prisma.artist.delete({
			where: { id: parseInt(id, 10) }
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error(`Error deleting artist with ID ${id}:`, error); // Log the specific error
		const errorMessage = error instanceof Error ? error.message : 'Unknown error deleting artist';
		return new Response(JSON.stringify({ error: 'Error deleting artist', details: errorMessage }), {
			// Include details in response
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
