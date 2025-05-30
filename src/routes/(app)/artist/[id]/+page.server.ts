import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			artworks: true
		}
	} as any);

	if (!artist) {
		return { status: 404, error: 'Artist not found' };
	}

	const artworks = (artist.artworks || []).map((artwork: any) => {
		return {
			id: String(artwork.id),
			title: artwork.title,
			description: artwork.description,
			image_url: artwork.imageUrl,
			animation_url: artwork.animationUrl,
			dimensions: artwork.dimensions,
			contractAddr: artwork.contractAddress,
			contractAlias: null,
			tokenStandard: artwork.tokenStandard,
			tokenID: artwork.tokenId,
			mintDate: artwork.mintDate,
			mime: artwork.mime,
			tags: null,
			attributes: artwork.attributes
		};
	});

	return {
		artist: {
			id: artist.id,
			name: artist.name,
			addresses: artist.walletAddresses,
			artworks
		}
	};
};
