import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { fetchCollection, fetchArtist } from '$lib/objktHelpers';

/**
 * Process items in batches with controlled concurrency
 * @param items Array of items to process
 * @param batchSize Number of items to process concurrently
 * @param processor Function to process each item
 */
async function processBatches<T, R>(
	items: T[],
	batchSize: number,
	processor: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = [];
	
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		
		const batchResults = await Promise.all(batch.map(processor));
		results.push(...batchResults);
		
		// Add a small delay between batches to be extra safe
		if (i + batchSize < items.length) {
			await new Promise(resolve => setTimeout(resolve, 500));
		}
	}
	
	return results;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { contractAddresses } = await request.json();

		if (!Array.isArray(contractAddresses)) {
			return json({ error: 'contractAddresses must be an array' }, { status: 400 });
		}

		const processContract = async (contractAddr: string) => {
			try {
				// Fetch collection data using the enhanced FA query
				const collectionData = await fetchCollection(contractAddr);
				const fa = collectionData?.data?.fa?.[0];

				if (!fa) {
					return { contractAddr, artist: null };
				}

				// CRITICAL FIX: Don't use fa.creator_address as primary source since it's often the contract creator, not the artist
				// Determine the primary creator from embedded creator data or verified_creators
				let creatorAddress = null;

				// Priority 1: If we have creator info embedded in the FA data, use it
				if (fa.creator && fa.creator.address) {
					return {
						contractAddr,
						artist: {
							name: fa.creator.alias || fa.creator.address,
							avatarUrl: fa.creator.logo || null,
							address: fa.creator.address,
							bio: fa.creator.description || null,
							website: fa.creator.website || null,
							twitter: fa.creator.twitter || null,
							instagram: fa.creator.instagram || null
						},
						collection: {
							name: fa.name,
							logo: fa.logo,
							description: fa.description,
							website: fa.website,
							twitter: fa.twitter
						}
					};
				}

				// Priority 2: Try to get from verified_creators (these are more reliable than creator_address)
				if (fa.verified_creators && fa.verified_creators.length > 0) {
					creatorAddress = fa.verified_creators[0];
				}

				// Note: We no longer fall back to fa.creator_address as it's often incorrect
				// If no creator info is found above, we'll return collection info without artist

				// If we have a creator address from verified_creators, fetch artist data separately
				if (creatorAddress) {
					const artistData = await fetchArtist(creatorAddress);

					if (artistData) {
						return {
							contractAddr,
							artist: {
								name: artistData.username || creatorAddress,
								avatarUrl: artistData.profile_image_url || null,
								address: creatorAddress,
								bio: artistData.bio || null,
								website: artistData.website || null,
								social_media_accounts: artistData.social_media_accounts || []
							},
							collection: {
								name: fa.name,
								logo: fa.logo,
								description: fa.description,
								website: fa.website,
								twitter: fa.twitter
							}
						};
					} else {
						// artistData is null, return with artist as null but include collection
						return {
							contractAddr,
							artist: null,
							collection: {
								name: fa.name,
								logo: fa.logo,
								description: fa.description,
								website: fa.website,
								twitter: fa.twitter
							}
						};
					}
				}

				// Return collection info even if no artist found
				return {
					contractAddr,
					artist: null,
					collection: {
						name: fa.name,
						logo: fa.logo,
						description: fa.description,
						website: fa.website,
						twitter: fa.twitter
					}
				};
			} catch (error) {
				console.error(`Error fetching artist data for ${contractAddr}:`, error);
				return { contractAddr, artist: null, collection: null };
			}
		};

		// Process contracts in batches of 3 to avoid overwhelming the API
		const results = await processBatches(contractAddresses, 3, processContract);

		// Convert to a map for easier lookup
		const artistMap: Record<string, any> = {};
		results.forEach((result) => {
			if (result.contractAddr) {
				artistMap[result.contractAddr] = {
					artist: result.artist,
					collection: result.collection
				};
			}
		});

		return json({ success: true, artistMap });
	} catch (error) {
		console.error('Error in collections/artists endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
