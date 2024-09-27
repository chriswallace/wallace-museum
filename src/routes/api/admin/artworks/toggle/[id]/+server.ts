import prisma from '$lib/prisma';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }): Promise<Response> => {
	const artworkId = parseInt(params.id);

	try {
		const artwork = await prisma.artwork.findUnique({
			where: { id: artworkId }
		});

		if (!artwork) {
			return new Response(JSON.stringify({ error: 'Artwork not found' }), {
				status: 404,
				headers: {
					'Content-Type': 'application/json'
				}
			});
		}

		const updatedArtwork = await prisma.artwork.update({
			where: { id: artworkId },
			data: { enabled: !artwork.enabled }
		});

		return new Response(JSON.stringify(updatedArtwork), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: 'An error occurred while updating the artwork' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
