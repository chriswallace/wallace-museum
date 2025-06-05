import { prismaRead, prismaWrite } from '$lib/prisma';
import type { RequestHandler } from './$types';
import { cachedArtworkQueries } from '$lib/cache/db-cache.js';

export const POST: RequestHandler = async ({ request }): Promise<Response> => {
	try {
		const { action, artworkIds, data } = await request.json();

		if (!action || !artworkIds || !Array.isArray(artworkIds) || artworkIds.length === 0) {
			return new Response(
				JSON.stringify({ error: 'Missing action, artworkIds, or invalid artworkIds array' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const artworkIdsInt = artworkIds.map(id => parseInt(id.toString(), 10));

		switch (action) {
			case 'delete':
				return await handleBulkDelete(artworkIdsInt);
			case 'edit':
				return await handleBulkEdit(artworkIdsInt, data);
			default:
				return new Response(
					JSON.stringify({ error: 'Invalid action. Supported actions: delete, edit' }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
		}
	} catch (error) {
		console.error('Error in bulk artwork operation:', error);
		return new Response(
			JSON.stringify({ error: 'An error occurred while processing bulk operation' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};

async function handleBulkDelete(artworkIds: number[]): Promise<Response> {
	try {
		// First, get the artworks to unpin their files and get their UIDs for cache invalidation
		const artworks = await prismaRead.artwork.findMany({
			where: { id: { in: artworkIds } },
			select: { 
				id: true,
				uid: true,
				title: true,
				imageUrl: true,
				thumbnailUrl: true,
				animationUrl: true,
				metadataUrl: true
			}
		});

		// Unpin files from Pinata for each artwork
		for (const artwork of artworks) {
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
		}

		// Disconnect ArtworkIndex records
		await prismaWrite.artworkIndex.updateMany({
			where: { artworkId: { in: artworkIds } },
			data: { 
				artworkId: null,
				importStatus: 'pending'
			}
		});

		// Delete the artworks
		const deletedArtworks = await prismaWrite.artwork.deleteMany({
			where: { id: { in: artworkIds } }
		});

		// Invalidate cache for all affected artworks
		for (const artwork of artworks) {
			await cachedArtworkQueries.invalidate(artwork.id, artwork.uid || undefined);
		}

		return new Response(
			JSON.stringify({ 
				success: true, 
				deletedCount: deletedArtworks.count,
				message: `Successfully deleted ${deletedArtworks.count} artwork(s)`
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Error in bulk delete:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to delete artworks' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

async function handleBulkEdit(artworkIds: number[], data: any): Promise<Response> {
	try {
		const updateData: any = {};

		// Handle artist assignment
		if (data.artistIds !== undefined) {
			if (Array.isArray(data.artistIds) && data.artistIds.length > 0) {
				updateData.Artist = {
					set: data.artistIds.map((id: number) => ({ id }))
				};
			} else {
				updateData.Artist = { set: [] };
			}
		}

		// Handle collection assignment
		if (data.collectionId !== undefined) {
			if (data.collectionId) {
				updateData.collectionId = data.collectionId;
			} else {
				updateData.collectionId = null;
			}
		}

		if (Object.keys(updateData).length === 0) {
			return new Response(
				JSON.stringify({ error: 'No valid update data provided' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Update artworks one by one to handle the many-to-many relationship properly
		const updatePromises = artworkIds.map(id => 
			prismaWrite.artwork.update({
				where: { id },
				data: updateData
			})
		);

		const updatedArtworks = await Promise.all(updatePromises);

		// Invalidate cache for all affected artworks
		for (const artworkId of artworkIds) {
			await cachedArtworkQueries.invalidate(artworkId);
		}

		// Update artwork indexes
		try {
			const { indexArtwork } = await import('$lib/artworkIndexer');
			for (const artworkId of artworkIds) {
				await indexArtwork(artworkId);
			}
		} catch (indexError) {
			console.error('Error updating artwork indexes:', indexError);
			// Don't fail the update if indexing fails
		}

		return new Response(
			JSON.stringify({ 
				success: true, 
				updatedCount: updatedArtworks.length,
				message: `Successfully updated ${updatedArtworks.length} artwork(s)`
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('Error in bulk edit:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to update artworks' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
} 