import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			artworks: true
		}
	});

	if (!artist) {
		return { status: 404, error: 'Artist not found' };
	}

	const artworks = (artist.artworks || []).map((artwork) => {
		return {
			id: String(artwork.id),
			title: artwork.title,
			description: artwork.description,
			image_url: artwork.imageUrl,
			animation_url: artwork.animationUrl,
			generator_url: artwork.generatorUrl,
			thumbnail_url: artwork.thumbnailUrl,
			dimensions: artwork.dimensions,
			contractAddr: artwork.contractAddress,
			contractAlias: null,
			tokenStandard: artwork.tokenStandard,
			tokenID: artwork.tokenId,
			mintDate: artwork.mintDate,
			mime: artwork.mime,
			tags: null,
			attributes: artwork.attributes,
			supply: artwork.supply
		};
	});

	return {
		artist: {
			id: artist.id,
			name: artist.name,
			bio: artist.bio,
			avatarUrl: artist.avatarUrl,
			websiteUrl: artist.websiteUrl,
			twitterHandle: artist.twitterHandle,
			instagramHandle: artist.instagramHandle,
			addresses: artist.walletAddresses,
			artworks
		}
	};
};
