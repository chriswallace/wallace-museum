import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			Artwork: {
				orderBy: {
					title: 'asc'
				}
			}
		}
	});

	if (!artist) {
		return { status: 404, error: 'Artist not found' };
	}

	// Transform artwork data
	const artworks = (artist.Artwork || []).map((artwork) => {
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
			displayName: artist.displayName,
			username: artist.username,
			bio: artist.bio,
			description: artist.description,
			avatarUrl: artist.avatarUrl,
			websiteUrl: artist.websiteUrl,
			twitterHandle: artist.twitterHandle,
			instagramHandle: artist.instagramHandle,
			profileUrl: artist.profileUrl,
			ensName: artist.ensName,
			isVerified: artist.isVerified,
			walletAddresses: artist.walletAddresses,
			socialLinks: artist.socialLinks,
			profileData: artist.profileData,
			resolutionSource: artist.resolutionSource,
			resolvedAt: artist.resolvedAt,
			createdAt: artist.createdAt,
			updatedAt: artist.updatedAt,
			artworks
		}
	};
};
