import prisma from '$lib/prisma';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }): Promise<Response> => {
	const artistId = parseInt(params.id);

	try {
		const artist = await prisma.artist.findUnique({
			where: { id: artistId }
		});

		if (!artist) {
			return new Response(JSON.stringify({ error: 'Artist not found' }), {
				status: 404,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}

		const updatedArtist = await prisma.artist.update({
			where: { id: artistId },
			data: { enabled: !artist.enabled }
		});

		return new Response(JSON.stringify(updatedArtist), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'An error occurred while updating the artist' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
