// src/routes/(dashboard)/admin/artists/edit/[id]/+page.server.ts
import type { PageServerLoad } from './$types';
import prisma from '$lib/prisma';
import { redirect, error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ request, locals, params }) => {
	// Correctly retrieve session and user
	const cookies = request.headers.get('cookie') || '';
	const sessionCookie = cookies.split(';').find((c) => c.trim().startsWith('session='));
	const sessionId = sessionCookie ? sessionCookie.split('=')[1] : '';

	let user = null;
	if (sessionId) {
		const session = await prisma.session.findUnique({
			where: { sessionId },
			include: { User: true }
		});

		if (session && new Date(session.expiresAt) > new Date()) {
			user = session.User;
		}
	}

	if (!user) {
		// If no valid user session, redirect to login
		throw redirect(302, '/login');
	}
	// User is authenticated, proceed to load artist data

	const artistId = parseInt(params.id, 10);
	if (isNaN(artistId)) {
		throw error(400, 'Invalid artist ID');
	}

	const artist = await prisma.artist.findUnique({
		where: { id: artistId },
		include: {
			Collection: {
				select: {
					id: true,
					title: true,
					slug: true,
					imageUrl: true
				}
			}
		}
	});

	if (!artist) {
		throw error(404, 'Artist not found');
	}

	// Get artworks for this artist using a raw query
	const artworks = await prisma.$queryRaw`
		SELECT a.id, a.title, a."imageUrl", a.description, a."collectionId"
		FROM "Artwork" a
		JOIN "_ArtistArtworks" aa ON a.id = aa."B"
		WHERE aa."A" = ${artistId}
	`;

	// Transform the artist data to match the expected format
	const transformedArtist = {
		...artist,
		// Add artworks directly to the artist object
		artworks: artworks,
		// Transform walletAddresses JSON to addresses array
		addresses: Array.isArray((artist as any).walletAddresses) 
			? ((artist as any).walletAddresses as any[]).map((wallet: any, index: number) => ({
				id: index, // Use index as ID since these aren't separate records
				address: wallet.address,
				blockchain: wallet.blockchain || 'ethereum',
				createdAt: new Date(),
				updatedAt: new Date()
			}))
			: [],
		// Map artworks to the old creatorAddresses format for compatibility
		// But only show artworks in the first entry to avoid duplicates
		creatorAddresses: Array.isArray((artist as any).walletAddresses)
			? ((artist as any).walletAddresses as any[]).map((wallet: any, index: number) => ({
				id: index,
				address: wallet.address,
				blockchain: wallet.blockchain || 'ethereum',
				artworks: index === 0 ? artworks : [], // Only include artworks in the first entry
				createdAt: new Date(),
				updatedAt: new Date()
			}))
			: [
				// If no wallet addresses, create a default entry with artworks
				{
					id: 0,
					address: '',
					blockchain: 'ethereum',
					artworks: artworks,
					createdAt: new Date(),
					updatedAt: new Date()
				}
			]
	};

	// Return user and artist data to the page
	return { artist: transformedArtist, user };
};
