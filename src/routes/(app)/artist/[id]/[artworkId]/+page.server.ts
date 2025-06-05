import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artworkId = Number(params.artworkId);

	// Fetch the artist with all artworks
	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			Artwork: true
		}
	});

	if (!artist) {
		throw error(404, 'Artist not found');
	}

	// Find the specific artwork
	const currentArtwork = artist.Artwork.find(artwork => artwork.id === artworkId);
	
	if (!currentArtwork) {
		throw error(404, 'Artwork not found');
	}

	// Transform all artworks for navigation
	const artworks = artist.Artwork.map((artwork) => {
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
			supply: artwork.supply,
			fullscreen: artwork.fullscreen
		};
	});

	// Find the current artwork index for navigation
	const currentIndex = artworks.findIndex(artwork => artwork.id === String(artworkId));

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
		},
		currentArtworkId: String(artworkId),
		currentIndex
	};
}; 