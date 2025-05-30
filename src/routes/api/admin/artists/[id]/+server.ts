import prisma from '$lib/prisma';
import { Prisma } from '@prisma/client'; // Import Prisma types
import { unpinArtworkCids } from '$lib/pinataHelpers';

// Define a type for the artist object including relations we expect
type ArtistWithRelations = Prisma.ArtistGetPayload<{
	include: {
		collections: true;
		walletAddresses: {
			include: {
				artworks: true;
				collections: true;
			};
		};
	};
}>;

// GET: Fetch Artist Details
export async function GET({ params }: { params: { id: string } }): Promise<Response> {
	const { id } = params;

	try {
		const artist = await prisma.artist.findUnique({
			where: { id: parseInt(id, 10) },
			include: {
				collections: true
			}
		});

		if (!artist) {
			return new Response(JSON.stringify({ error: 'Artist not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// Get artworks for this artist using a raw query to bypass TypeScript issues
		const artworks = await prisma.$queryRaw`
			SELECT a.id, a.title, a."imageUrl", a.description, a."collectionId"
			FROM "Artwork" a
			JOIN "_ArtistArtworks" aa ON a.id = aa."B"
			WHERE aa."A" = ${parseInt(id, 10)}
		`;

		// Transform the artist data to match the expected format
		const transformedArtist = {
			...artist,
			// Add artworks directly to the artist object
			artworks: artworks,
			// Transform walletAddresses JSON to addresses array
			addresses: Array.isArray((artist as any).walletAddresses) 
				? ((artist as any).walletAddresses as any[]).map((wallet: any, index: number) => ({
					id: index,
					address: wallet.address,
					blockchain: wallet.blockchain || 'ethereum',
					createdAt: new Date(),
					updatedAt: new Date()
				}))
				: [],
			// Map artworks to the old creatorAddresses format for compatibility with existing UI
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

		return new Response(JSON.stringify(transformedArtist), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error('Error fetching artist:', error);
		return new Response(JSON.stringify({ error: 'Error fetching artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// PUT: Update Artist Details
export async function PUT({
	params,
	request
}: {
	params: { id: string };
	request: Request;
}): Promise<Response> {
	const { id } = params;
	const data = await request.json();

	try {
		const updatedArtist = await prisma.artist.update({
			where: { id: parseInt(id, 10) },
			data: {
				name: data.name,
				bio: data.bio,
				websiteUrl: data.websiteUrl,
				twitterHandle: data.twitterHandle,
				instagramHandle: data.instagramHandle,
				avatarUrl: data.avatarUrl
			},
			include: {
				collections: true
			}
		});

		// Transform the artist data to match the expected format
		const transformedArtist = {
			...updatedArtist,
			// Transform walletAddresses JSON to addresses array
			addresses: Array.isArray((updatedArtist as any).walletAddresses) 
				? ((updatedArtist as any).walletAddresses as any[]).map((wallet: any, index: number) => ({
					id: index,
					address: wallet.address,
					blockchain: wallet.blockchain || 'ethereum',
					createdAt: new Date(),
					updatedAt: new Date()
				}))
				: []
		};

		return new Response(JSON.stringify(transformedArtist), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: 'Error updating artist' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
}

// DELETE: Delete Artist
export async function DELETE({ params }: { params: { id: string } }): Promise<Response> {
	const { id } = params;
	const artistId = parseInt(id, 10);

	try {
		// First, get the artist to check for files to unpin
		const artist = await prisma.artist.findUnique({
			where: { id: artistId }
		});

		if (!artist) {
			return new Response(
				JSON.stringify({ error: 'Artist not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Unpin avatar if it exists and is from Pinata
		try {
			if (artist.avatarUrl && artist.avatarUrl.includes('pinata.cloud')) {
				const { unpinFromPinata, extractCidFromUrl } = await import('$lib/pinataHelpers');
				const avatarCid = extractCidFromUrl(artist.avatarUrl);
				if (avatarCid) {
					const result = await unpinFromPinata(avatarCid);
					if (result.success) {
						if (result.wasNotPinned) {
							console.log(`Avatar for artist ${artist.name} was not pinned (no action needed)`);
						} else {
							console.log(`Unpinned avatar for artist: ${artist.name}`);
						}
					} else {
						console.error(`Failed to unpin avatar for artist ${artist.name}:`, result.error);
					}
				}
			}
		} catch (unpinError) {
			console.error('Error unpinning artist files:', unpinError);
			// Continue with deletion even if unpinning fails
		}

		// Delete the artist (cascade will handle related records)
		await prisma.artist.delete({
			where: { id: artistId }
		});

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting artist:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ error: 'Error deleting artist', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
