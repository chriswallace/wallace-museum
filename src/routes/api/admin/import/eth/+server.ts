// src/routes/api/import-nfts.js
import { json } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';
import { uploadToImageKit, fetchMedia, resizeImage, normalizeMetadata } from '$lib/mediaHelpers';
import { fetchCollection, fetchArtist } from '$lib/openseaHelpers';

const prisma = new PrismaClient();

export const POST = async ({ request }) => {
    try {
        const { nfts } = await request.json(); // Destructure the nfts array from the incoming JSON

        if (!Array.isArray(nfts) || nfts.length === 0) {
            return new Response(JSON.stringify({ error: 'No NFTs provided for import.' }), { status: 400 });
        }

        // Fetch NFT metadata in parallel
        await Promise.all(nfts.map(async (nft) => {
            try {
                if (nft.metadata_url) {
                    const metadataResponse = await fetch(nft.metadata_url);
                    if (metadataResponse.ok) {
                        const metadataJson = await metadataResponse.json();
                        // Attach the fetched metadata to the nft object
                        nft.metadata = metadataJson;
                    } else {
                        console.error(`Failed to fetch metadata for NFT from ${nft.metadata_url}`);
                    }
                }

                for (const nft of nfts) {
                    // Simplified example of processing each artwork
                    try {

                        // Fetch collection data from OpenSea API
                        nft.collection_data = await fetchCollection(nft.collection);

                        // Fetch artist data from OpenSea API via collection data
                        nft.artist = await fetchArtist(nft.collection_data.owner);

                        // Assuming you have a unique way to identify artists and collections, such as a username or slug
                        const artistUniqueIdentifier = nft.artist.username || nft.artist.address; // Ensure this is truly unique
                        const collectionUniqueIdentifier = nft.collection_data.collection; // Assuming you have a slug or some unique identifier

                        // Upsert for artist
                        const artist = await prisma.artist.upsert({
                            where: {
                                // This needs to be a unique identifier for the artist
                                name: artistUniqueIdentifier, // Assuming 'username' is the unique field in your Artist model
                            },
                            update: {
                                // Update existing artist data
                                name: nft.artist.username,
                                bio: nft.artist.bio,
                                // Include other fields as necessary
                            },
                            create: {
                                // Create new artist data
                                name: artistUniqueIdentifier,
                                bio: nft.artist.bio,
                                // Include other fields as necessary
                            },
                        });

                        // Upsert for collection
                        const collection = await prisma.collection.upsert({
                            where: {
                                // This needs to be a unique identifier for the collection
                                slug: collectionUniqueIdentifier, // Assuming 'slug' is the unique field in your Collection model
                            },
                            update: {
                                // Update existing collection data
                                title: nft.collection_data.name,
                                description: nft.collection_data.description,
                                // Include other fields as necessary
                            },
                            create: {
                                // Create new collection data
                                slug: collectionUniqueIdentifier,
                                title: nft.collection_data.name,
                                description: nft.collection_data.description,
                                enabled: false
                                // Include other fields as necessary
                            },
                        });


                        const mediaData = await fetchMedia(nft.metadata.image);
                        if (!mediaData) continue;

                        // Resize and upload to ImageKit
                        const resizedBuffer = await resizeImage(mediaData.buffer);
                        const uploadResult = await uploadToImageKit(resizedBuffer, mediaData.fileName);
                        if (!uploadResult) continue;

                        // Normalize metadata and store in database (adapt as necessary)
                        // This is a placeholder for your database logic
                        const normalizedMetadata = await normalizeMetadata(nft); // Implement this function based on your needs

                        // Assuming `normalizedMetadata` contains both `tokenID` and `contractAddr`
                        const { identifier, contractAddr } = nft;

                        // First, try to find an existing artwork with the same tokenID and contractAddr
                        const existingArtwork = await prisma.artwork.findFirst({
                            where: {
                                AND: [
                                    { tokenID: identifier },
                                    { contractAddr: contractAddr }
                                ],
                            },
                        });

                        // Then, based on whether the artwork exists, either update it or create a new one
                        if (existingArtwork) {
                            // If the artwork exists, update it
                            await prisma.artwork.update({
                                where: { id: existingArtwork.id },
                                data: {
                                    // Update fields
                                    enabled: true,
                                    title: normalizedMetadata.name,
                                    description: normalizedMetadata.description,
                                    image: normalizedMetadata.image,
                                    dimensions: normalizedMetadata.dimensions ? JSON.stringify(normalizedMetadata.dimensions) : undefined,
                                    video: normalizedMetadata.video,
                                    liveUri: normalizedMetadata.live_uri,
                                    attributes: normalizedMetadata.attributes ? JSON.stringify(normalizedMetadata.attributes) : undefined,
                                    curatorNotes: '', // Example field
                                    blockchain: 'ethereum',
                                    contractAddr: contractAddr,
                                    contractAlias: normalizedMetadata.contractAlias,
                                    tokenID: identifier,
                                    mintDate: normalizedMetadata.mintDate ? new Date(normalizedMetadata.mintDate) : null,
                                    tags: normalizedMetadata.tags ? JSON.stringify(normalizedMetadata.tags) : null,
                                    // Link to artist and collection if applicable
                                    artistId: artist.id,
                                    collectionId: collection.id,
                                },
                            });
                        } else {
                            // If the artwork does not exist, create a new one
                            await prisma.artwork.create({
                                data: {
                                    // Create fields
                                    enabled: true,
                                    title: normalizedMetadata.name,
                                    description: normalizedMetadata.description,
                                    image: uploadResult.url,
                                    dimensions: normalizedMetadata.dimensions ? JSON.stringify(normalizedMetadata.dimensions) : undefined,
                                    video: normalizedMetadata.video,
                                    liveUri: normalizedMetadata.live_uri,
                                    attributes: normalizedMetadata.attributes ? JSON.stringify(normalizedMetadata.attributes) : undefined,
                                    curatorNotes: '', // Example field
                                    blockchain: 'ethereum',
                                    contractAddr: contractAddr,
                                    contractAlias: normalizedMetadata.contractAlias,
                                    tokenID: identifier,
                                    mintDate: normalizedMetadata.mintDate ? new Date(normalizedMetadata.mintDate) : null,
                                    tags: normalizedMetadata.tags ? JSON.stringify(normalizedMetadata.tags) : null,
                                    // Link to artist and collection if applicable
                                    artistId: artist.id,
                                    collectionId: collection.id,
                                },
                            });
                        }

                    } catch (error) {
                        console.error('Error processing artwork:', error);
                        // Handle error (you might want to return a failure response or log the error)
                    }
                }

            } catch (error) {
                console.error('Error fetching or processing NFT metadata:', error);
                // Handle error (you might want to return a failure response or log the error)
            }
        }));

        return json({ success: true, message: 'Artworks processed successfully.' });
    } catch (error) {
        console.error('Error processing request:', error);
        return json({ success: false, message: 'Server error occurred.' }, { status: 500 });
    }
};
