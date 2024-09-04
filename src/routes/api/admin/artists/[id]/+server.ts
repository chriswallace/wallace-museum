import prisma from '$lib/prisma';

// GET: Fetch Artist Details
export async function GET({ params }) {
	const { id } = params;
	const artist = await prisma.artist.findUnique({
		where: { id: parseInt(id, 10) },
		include: {
			collections: true,
			artworks: true
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
				websiteUrl: data.website,
				twitterHandle: data.twitterHandle,
				instagramHandle: data.instagramHandle,
				avatarUrl: data.profileImageUrl,
				collections: {
					set: data.collectionIds?.map((collectionId) => ({
						id: collectionId
					}))
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
		return new Response(JSON.stringify({ error: 'Error deleting artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}
