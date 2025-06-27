import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params }) => {
	const artistId = Number(params.id);
	const artworkId = Number(params.artworkId);

	// First, fetch the specific artwork with all its artists
	const artwork = await prisma.artwork.findUnique({
		where: { id: artworkId },
		include: {
			Artist: true // Include all artists associated with this artwork
		}
	});

	if (!artwork) {
		throw error(404, 'Artwork not found');
	}

	// Verify that the artist from the URL is one of the artwork's artists
	const isValidArtist = artwork.Artist.some(artist => artist.id === artistId);
	if (!isValidArtist) {
		throw error(404, 'Artist not associated with this artwork');
	}

	// Get the primary artist (from URL) for navigation context
	const primaryArtist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			Artwork: {
				include: {
					Artist: true // Include all artists for each artwork
				},
				orderBy: {
					title: 'asc'
				}
			}
		}
	});

	if (!primaryArtist) {
		throw error(404, 'Artist not found');
	}

	// Transform all artworks for navigation, including their artists
	const artworks = primaryArtist.Artwork.map((artwork) => {
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
			contractAddress: artwork.contractAddress, // Add this for platform links
			contractAlias: null,
			tokenStandard: artwork.tokenStandard,
			tokenID: artwork.tokenId,
			tokenId: artwork.tokenId, // Add this for platform links
			blockchain: artwork.blockchain, // Add this for platform links
			mintDate: artwork.mintDate,
			mime: artwork.mime,
			tags: null,
			attributes: artwork.attributes,
			supply: artwork.supply,
			fullscreen: artwork.fullscreen,
			artists: artwork.Artist.map(artist => ({
				id: artist.id,
				name: artist.name,
				avatarUrl: artist.avatarUrl,
				websiteUrl: artist.websiteUrl,
				bio: artist.bio,
				twitterHandle: artist.twitterHandle,
				instagramHandle: artist.instagramHandle
			}))
		};
	});

	// Find the current artwork index for navigation
	const currentIndex = artworks.findIndex(artwork => artwork.id === String(artworkId));

	return {
		artist: {
			id: primaryArtist.id,
			name: primaryArtist.name,
			bio: primaryArtist.bio,
			avatarUrl: primaryArtist.avatarUrl,
			websiteUrl: primaryArtist.websiteUrl,
			twitterHandle: primaryArtist.twitterHandle,
			instagramHandle: primaryArtist.instagramHandle,
			addresses: primaryArtist.walletAddresses,
			artworks
		},
		currentArtworkId: String(artworkId),
		currentIndex,
		// Include the current artwork's artists for display
		currentArtworkArtists: artwork.Artist.map(artist => ({
			id: artist.id,
			name: artist.name,
			avatarUrl: artist.avatarUrl,
			websiteUrl: artist.websiteUrl,
			bio: artist.bio,
			twitterHandle: artist.twitterHandle,
			instagramHandle: artist.instagramHandle
		}))
	};
}; 