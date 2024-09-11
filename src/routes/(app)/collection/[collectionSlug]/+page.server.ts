import prisma from '$lib/prisma';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
	try {
		const collection = await prisma.collection.findFirst({
			where: {
				slug: params.collectionSlug,
				enabled: true
			},
			select: {
				id: true,
				title: true, // Include title of the collection
				artworks: {
					select: {
						id: true,
						title: true, // Scalar field
						description: true, // Assuming you want the description as well
						image_url: true, // Scalar field
						animation_url: true, // Scalar field
						dimensions: true, // Scalar field
						contractAddr: true,
						contractAlias: true,
						totalSupply: true,
						tokenStandard: true,
						tokenID: true,
						mintDate: true,
						mime: true,
						tags: true, // Scalar field
						attributes: true, // Scalar field
						artist: {
							// Directly include the artist relation
							select: {
								id: true,
								name: true,
								websiteUrl: true
							}
						}
					},
					where: {
						enabled: true
					}
				}
			}
		});

		if (!collection) throw error(404, 'Collection not found. Please go back or try again later.');

		collection.artworks = collection.artworks.map((artwork) => {
			if (typeof artwork.dimensions === 'string') {
				try {
					artwork.dimensions = JSON.parse(artwork.dimensions);
				} catch (e) {
					console.error('Error parsing dimensions JSON for artwork:', artwork.id, e);
					artwork.dimensions = { width: 300, height: 200 }; // default size in case of parsing error
				}
			}
			artwork.image_url = artwork.image_url + '?q-60';
			return artwork;
		});

		return collection;
	} catch (e) {
		console.error(e);
		throw error(500, 'Server error occurred');
	} finally {
		await prisma.$disconnect();
	}
}
