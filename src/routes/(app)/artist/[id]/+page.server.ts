import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			ArtistArtworks: {
				include: {
					artwork: {
						select: {
							id: true,
							title: true,
							description: true,
							image_url: true,
							animation_url: true,
							dimensions: true,
							contractAddr: true,
							contractAlias: true,
							totalSupply: true,
							tokenStandard: true,
							tokenID: true,
							mintDate: true,
							mime: true,
							tags: true,
							attributes: true
						}
					}
				}
			}
		}
	});

	if (!artist) {
		return { status: 404, error: 'Artist not found' };
	}

	const artworks = artist.ArtistArtworks.map((aa) => {
		const a = aa.artwork;
		return {
			id: String(a.id),
			title: a.title,
			description: a.description,
			image_url: a.image_url,
			animation_url: a.animation_url,
			dimensions: a.dimensions,
			contractAddr: a.contractAddr,
			contractAlias: a.contractAlias,
			totalSupply: a.totalSupply,
			tokenStandard: a.tokenStandard,
			tokenID: a.tokenID,
			mintDate: a.mintDate,
			mime: a.mime,
			tags: a.tags,
			attributes: a.attributes
		};
	});

	return {
		artist: {
			id: artist.id,
			name: artist.name,
			artworks
		}
	};
}; 