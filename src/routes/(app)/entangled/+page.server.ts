import { error } from '@sveltejs/kit';
import prisma from '$lib/prisma.js';
import { ENTANGLED_CONTRACTS } from '$lib/utils/entangledHelpers.js';

export async function load({ url }) {
	const ethTokenId = url.searchParams.get('ethToken');
	const tezosTokenId = url.searchParams.get('tezosToken');
	const tokenId = url.searchParams.get('tokenId'); // Single token ID to find pair for
	const contractAddress = url.searchParams.get('contract'); // Contract address if single token

	// Validate parameters - ensure we don't have undefined/null values
	const hasValidPairParams = ethTokenId && tezosTokenId && 
		ethTokenId !== 'undefined' && ethTokenId !== 'null' &&
		tezosTokenId !== 'undefined' && tezosTokenId !== 'null';
		
	const hasValidSingleParams = tokenId && contractAddress && 
		tokenId !== 'undefined' && tokenId !== 'null' &&
		contractAddress !== 'undefined' && contractAddress !== 'null';

	if (!hasValidPairParams && !hasValidSingleParams) {
		console.error('[Entangled] Invalid or missing parameters:', { ethTokenId, tezosTokenId, tokenId, contractAddress });
		throw error(400, 'Invalid parameters. Please provide valid token IDs and contract addresses.');
	}

	let ethArtwork = null;
	let tezosArtwork = null;

	try {
		// If we have both token IDs, fetch both artworks
		if (hasValidPairParams) {
			const [ethResult, tezosResult] = await Promise.all([
				prisma.artwork.findFirst({
					where: {
						tokenId: ethTokenId,
						contractAddress: ENTANGLED_CONTRACTS.ethereum
					},
					include: {
						Artist: true,
						Collection: true
					}
				}),
				prisma.artwork.findFirst({
					where: {
						tokenId: tezosTokenId,
						contractAddress: ENTANGLED_CONTRACTS.tezos
					},
					include: {
						Artist: true,
						Collection: true
					}
				})
			]);

			ethArtwork = ethResult;
			tezosArtwork = tezosResult;
		}
		// If we have a single token, find its pair
		else if (hasValidSingleParams) {
			const isEthereum = contractAddress.toLowerCase() === ENTANGLED_CONTRACTS.ethereum.toLowerCase();
			const isTezos = contractAddress.toLowerCase() === ENTANGLED_CONTRACTS.tezos.toLowerCase();

			if (!isEthereum && !isTezos) {
				throw error(400, 'Invalid contract address for Entangled artwork');
			}

			// Fetch the clicked artwork
			const clickedArtwork = await prisma.artwork.findFirst({
				where: {
					tokenId: tokenId,
					contractAddress: contractAddress
				},
				include: {
					Artist: true,
					Collection: true
				}
			});

			if (!clickedArtwork) {
				throw error(404, 'Artwork not found');
			}

			// Try to find pair by same token ID first
			const pairContract = isEthereum ? ENTANGLED_CONTRACTS.tezos : ENTANGLED_CONTRACTS.ethereum;
			let pairArtwork = await prisma.artwork.findFirst({
				where: {
					tokenId: tokenId,
					contractAddress: pairContract
				},
				include: {
					Artist: true,
					Collection: true
				}
			});

			// If no exact pair, find any artwork from the other chain
			if (!pairArtwork) {
				pairArtwork = await prisma.artwork.findFirst({
					where: {
						contractAddress: pairContract
					},
					include: {
						Artist: true,
						Collection: true
					}
				});
			}

			if (isEthereum) {
				ethArtwork = clickedArtwork;
				tezosArtwork = pairArtwork;
			} else {
				tezosArtwork = clickedArtwork;
				ethArtwork = pairArtwork;
			}
		}

		if (!ethArtwork && !tezosArtwork) {
			throw error(404, 'No Entangled artworks found');
		}

		return {
			ethArtwork,
			tezosArtwork,
			ethTokenId: ethArtwork?.tokenId || ethTokenId,
			tezosTokenId: tezosArtwork?.tokenId || tezosTokenId
		};
	} catch (err) {
		console.error('Error loading Entangled artworks:', err);
		
		// If it's already an error we threw, re-throw it
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		// Otherwise, throw a generic 500 error
		throw error(500, 'Failed to load Entangled artworks');
	}
} 