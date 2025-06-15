import { prismaRead, prismaWrite } from '$lib/prisma';
import { Prisma } from '@prisma/client';
import { cachedArtworkQueries, cachedCollectionQueries, cachedArtistQueries, cachedSearchQueries } from '$lib/cache/db-cache';

// GET: Fetch Artwork Details
export async function GET({ params }) {
	const { id } = params;
	const artwork = await prismaRead.artwork.findUnique({
		where: { id: parseInt(id, 10) },
		include: {
			Collection: true,
			Artist: true
		}
	});

	if (!artwork) {
		return new Response(JSON.stringify({ error: 'Artwork not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return new Response(JSON.stringify(artwork), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

// PUT: Update Artwork Details
export async function PUT({ params, request }) {
	const { id } = params;
	const artworkId = parseInt(id, 10);

	interface ArtworkUpdateRequestData {
		title?: string;
		description?: string;
		collectionId?: number | null;
		imageUrl?: string | null;
		animationUrl?: string | null;
		thumbnailUrl?: string | null;
		generatorUrl?: string | null;
		mime?: string | null;
		metadataUrl?: string | null;
		creatorAddress?: string | null;
		walletAddressId?: number | null;
		artistIds?: number[];
		tags?: string[];
		attributes?: Prisma.InputJsonValue | null;
		tokenId?: string;
		contractAddress?: string;
		blockchain?: string;
		tokenStandard?: string;
		mintDate?: string | Date | null;
		supply?: number;
		dimensions?: { width: number; height: number } | null;
		fullscreen?: boolean;
		features?: Prisma.InputJsonValue | null;
		uid?: string;
	}

	const requestData = (await request.json()) as ArtworkUpdateRequestData;

	try {
		// Get the current artwork to track changes for cache invalidation
		const currentArtwork = await prismaRead.artwork.findUnique({
			where: { id: artworkId },
			select: {
				id: true,
				uid: true,
				collectionId: true,
				Artist: { select: { id: true } }
			}
		});

		if (!currentArtwork) {
			return new Response(
				JSON.stringify({ error: 'Artwork not found to update.' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const updateData: Prisma.ArtworkUpdateInput = {};

		// Map fields directly
		if (requestData.title !== undefined) updateData.title = requestData.title;
		if (requestData.description !== undefined) updateData.description = requestData.description;
		if (requestData.imageUrl !== undefined) updateData.imageUrl = requestData.imageUrl;
		if (requestData.animationUrl !== undefined) updateData.animationUrl = requestData.animationUrl;
		if (requestData.thumbnailUrl !== undefined) updateData.thumbnailUrl = requestData.thumbnailUrl;
		if (requestData.generatorUrl !== undefined) updateData.generatorUrl = requestData.generatorUrl;
		if (requestData.mime !== undefined) updateData.mime = requestData.mime;
		if (requestData.metadataUrl !== undefined) updateData.metadataUrl = requestData.metadataUrl;
		if (requestData.tokenId !== undefined) updateData.tokenId = requestData.tokenId;
		if (requestData.contractAddress !== undefined) updateData.contractAddress = requestData.contractAddress;
		if (requestData.blockchain !== undefined) updateData.blockchain = requestData.blockchain;
		if (requestData.tokenStandard !== undefined) updateData.tokenStandard = requestData.tokenStandard;
		if (requestData.supply !== undefined) updateData.supply = requestData.supply;
		if (requestData.fullscreen !== undefined) updateData.fullscreen = requestData.fullscreen;
		if (requestData.uid !== undefined) updateData.uid = requestData.uid;

		if (requestData.mintDate !== undefined) {
			updateData.mintDate = requestData.mintDate ? new Date(requestData.mintDate) : null;
		}

		if (requestData.attributes !== undefined) {
			updateData.attributes = requestData.attributes === null ? Prisma.JsonNull : requestData.attributes;
		}

		if (requestData.dimensions !== undefined) {
			updateData.dimensions = requestData.dimensions === null ? Prisma.JsonNull : requestData.dimensions;
		}

		if (requestData.features !== undefined) {
			updateData.features = requestData.features === null ? Prisma.JsonNull : requestData.features;
		}

		// Collection linking
		if (requestData.collectionId !== undefined) {
			updateData.Collection = requestData.collectionId
				? { connect: { id: requestData.collectionId } }
				: { disconnect: true };
		}

		// Artist linking
		if (requestData.artistIds !== undefined) {
			if (requestData.artistIds.length > 0) {
				updateData.Artist = {
					set: requestData.artistIds.map(id => ({ id }))
				};
			} else {
				updateData.Artist = { set: [] };
			}
		}

		const updatedArtwork = await prismaWrite.artwork.update({
			where: { id: artworkId },
			data: updateData,
			include: {
				Collection: true,
				Artist: true
			}
		});

		// Invalidate artwork cache since it was updated
		await cachedArtworkQueries.invalidate(artworkId, currentArtwork.uid || undefined);

		// Invalidate collection cache if collection relationship changed
		if (requestData.collectionId !== undefined) {
			// Invalidate old collection if it existed
			if (currentArtwork.collectionId) {
				await cachedCollectionQueries.invalidate(currentArtwork.collectionId);
			}
			// Invalidate new collection if it was set
			if (requestData.collectionId) {
				await cachedCollectionQueries.invalidate(requestData.collectionId);
			}
		}

		// Invalidate artist cache if artist relationship changed
		if (requestData.artistIds !== undefined) {
			// Invalidate old artists
			for (const artist of currentArtwork.Artist) {
				await cachedArtistQueries.invalidate(artist.id);
			}
			// Invalidate new artists
			for (const artistId of requestData.artistIds) {
				await cachedArtistQueries.invalidate(artistId);
			}
		}

		// Invalidate search cache since artwork data has changed
		await cachedSearchQueries.invalidate();

		return new Response(JSON.stringify(updatedArtwork), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error: any) {
		console.error(`Error updating artwork ${artworkId}:`, error);
		const errorMessage = error.message || 'Unknown error';
		
		if (error.code === 'P2025') {
			return new Response(
				JSON.stringify({ error: 'Artwork not found to update.', details: errorMessage }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
		
		return new Response(
			JSON.stringify({ error: 'Failed to update artwork.', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

// DELETE: Delete Artwork
export async function DELETE({ params }) {
	const { id } = params;

	try {
		// First, get the artwork and related data for cache invalidation
		const artwork = await prismaRead.artwork.findUnique({
			where: { id: parseInt(id, 10) },
			select: {
				id: true,
				uid: true,
				title: true,
				imageUrl: true,
				thumbnailUrl: true,
				animationUrl: true,
				metadataUrl: true,
				collectionId: true,
				Artist: { select: { id: true } }
			}
		});

		if (!artwork) {
			return new Response(
				JSON.stringify({ error: 'Artwork not found' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Unpin files from Pinata if they exist
		try {
			const { unpinArtworkCids } = await import('$lib/pinataHelpers');
			await unpinArtworkCids({
				title: artwork.title,
				imageUrl: artwork.imageUrl,
				thumbnailUrl: artwork.thumbnailUrl,
				animationUrl: artwork.animationUrl,
				metadataUrl: artwork.metadataUrl
			});
			console.log(`Unpinned files for artwork: ${artwork.title}`);
		} catch (unpinError) {
			console.error(`Error unpinning artwork files for ${artwork.title}:`, unpinError);
			// Continue with deletion even if unpinning fails
		}

		// Disconnect ArtworkIndex records
		await prismaWrite.artworkIndex.updateMany({
			where: { artworkId: parseInt(id, 10) },
			data: { 
				artworkId: null,
				importStatus: 'pending'
			}
		});

		// Delete the artwork
		await prismaWrite.artwork.delete({
			where: { id: parseInt(id, 10) }
		});

		// Invalidate artwork cache
		await cachedArtworkQueries.invalidate(parseInt(id, 10), artwork.uid || undefined);

		// Invalidate collection cache if artwork was in a collection
		if (artwork.collectionId) {
			await cachedCollectionQueries.invalidate(artwork.collectionId);
		}

		// Invalidate artist cache for all artists associated with this artwork
		for (const artist of artwork.Artist) {
			await cachedArtistQueries.invalidate(artist.id);
		}

		// Invalidate search cache since artwork data has changed
		await cachedSearchQueries.invalidate();

		return new Response(null, { status: 204 });
	} catch (error) {
		console.error('Error deleting artwork:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		return new Response(
			JSON.stringify({ error: 'Error deleting artwork', details: errorMessage }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
