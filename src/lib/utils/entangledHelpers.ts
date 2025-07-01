// Entangled collection contract addresses
export const ENTANGLED_CONTRACTS = {
	ethereum: '0x19dbc1c820dd3f13260829a4e06dda6d9ef758db',
	tezos: 'kt1efsnuqwlawdd3o4pvfux1cah5gmdtrrvr'
};

export interface EntangledPair {
	ethereum: any;
	tezos: any;
	pairId: string;
}

/**
 * Check if an artwork is from the Entangled collection
 */
export function isEntangledArtwork(artwork: any): boolean {
	if (!artwork || (!artwork.contractAddr && !artwork.contractAddress)) return false;
	
	const contractAddress = (artwork.contractAddr || artwork.contractAddress || '').toLowerCase();
	
	// Ensure we have a valid contract address
	if (!contractAddress || contractAddress === 'null' || contractAddress === 'undefined') {
		return false;
	}
	
	return contractAddress === ENTANGLED_CONTRACTS.ethereum.toLowerCase() || 
		   contractAddress === ENTANGLED_CONTRACTS.tezos.toLowerCase();
}

/**
 * Get the blockchain for an Entangled artwork
 */
export function getEntangledBlockchain(artwork: any): 'ethereum' | 'tezos' | null {
	if (!artwork || (!artwork.contractAddr && !artwork.contractAddress)) return null;
	
	const contractAddress = (artwork.contractAddr || artwork.contractAddress || '').toLowerCase();
	
	// Ensure we have a valid contract address
	if (!contractAddress || contractAddress === 'null' || contractAddress === 'undefined') {
		return null;
	}
	
	if (contractAddress === ENTANGLED_CONTRACTS.ethereum.toLowerCase()) {
		return 'ethereum';
	}
	if (contractAddress === ENTANGLED_CONTRACTS.tezos.toLowerCase()) {
		return 'tezos';
	}
	return null;
}

/**
 * Extract Entangled artworks from a list and group them by blockchain
 */
export function extractEntangledArtworks(artworks: any[]): {
	ethereum: any[];
	tezos: any[];
	others: any[];
} {
	const ethereum: any[] = [];
	const tezos: any[] = [];
	const others: any[] = [];
	
	artworks.forEach(artwork => {
		if (isEntangledArtwork(artwork)) {
			const blockchain = getEntangledBlockchain(artwork);
			if (blockchain === 'ethereum') {
				ethereum.push(artwork);
			} else if (blockchain === 'tezos') {
				tezos.push(artwork);
			}
		} else {
			others.push(artwork);
		}
	});
	
	return { ethereum, tezos, others };
}

/**
 * Create Entangled pairs from Ethereum and Tezos artworks
 * This attempts to match artworks by token ID or other identifying features
 */
export function createEntangledPairs(ethereumArtworks: any[], tezosArtworks: any[]): {
	pairs: EntangledPair[];
	unpairedEthereum: any[];
	unpairedTezos: any[];
} {
	const pairs: EntangledPair[] = [];
	const unpairedEthereum = [...ethereumArtworks];
	const unpairedTezos = [...tezosArtworks];
	
	// Try to pair artworks by token ID
	ethereumArtworks.forEach((ethArtwork, ethIndex) => {
		const ethTokenId = ethArtwork.tokenId || ethArtwork.tokenID;
		
		// Skip if no valid token ID
		if (!ethTokenId || ethTokenId === 'null' || ethTokenId === 'undefined') {
			return;
		}
		
		const matchingTezosIndex = tezosArtworks.findIndex(tezosArtwork => {
			const tezosTokenId = tezosArtwork.tokenId || tezosArtwork.tokenID;
			return tezosTokenId && tezosTokenId !== 'null' && tezosTokenId !== 'undefined' && ethTokenId === tezosTokenId;
		});
		
		if (matchingTezosIndex !== -1) {
			const tezosArtwork = tezosArtworks[matchingTezosIndex];
			
			pairs.push({
				ethereum: ethArtwork,
				tezos: tezosArtwork,
				pairId: `entangled-${ethTokenId}`
			});
			
			// Remove from unpaired lists
			const ethUnpairedIndex = unpairedEthereum.findIndex(a => a === ethArtwork);
			if (ethUnpairedIndex !== -1) {
				unpairedEthereum.splice(ethUnpairedIndex, 1);
			}
			
			const tezosUnpairedIndex = unpairedTezos.findIndex(a => a === tezosArtwork);
			if (tezosUnpairedIndex !== -1) {
				unpairedTezos.splice(tezosUnpairedIndex, 1);
			}
		}
	});
	
	// If no token ID matching worked, try simple sequential pairing
	if (pairs.length === 0 && ethereumArtworks.length > 0 && tezosArtworks.length > 0) {
		const maxPairs = Math.min(ethereumArtworks.length, tezosArtworks.length);
		
		for (let i = 0; i < maxPairs; i++) {
			pairs.push({
				ethereum: ethereumArtworks[i],
				tezos: tezosArtworks[i],
				pairId: `entangled-sequential-${i}`
			});
		}
		
		// Update unpaired lists
		unpairedEthereum.splice(0, maxPairs);
		unpairedTezos.splice(0, maxPairs);
	}
	
	return { pairs, unpairedEthereum, unpairedTezos };
}

/**
 * Process artworks list to handle Entangled pairing
 * Returns a list where Entangled pairs are replaced with pair objects
 * and individual Entangled artworks are filtered out
 */
export function processArtworksForEntangled(artworks: any[]): (any | EntangledPair)[] {
	const { ethereum, tezos, others } = extractEntangledArtworks(artworks);
	
	// If we don't have both Ethereum and Tezos artworks, return original list
	if (ethereum.length === 0 || tezos.length === 0) {
		return artworks;
	}
	
	const { pairs } = createEntangledPairs(ethereum, tezos);
	
	// Return others + pairs (filtering out individual Entangled artworks)
	return [...others, ...pairs];
}

/**
 * Check if an item is an Entangled pair
 */
export function isEntangledPair(item: any): item is EntangledPair {
	return item && typeof item === 'object' && item.ethereum && item.tezos && item.pairId;
}

/**
 * Generate URL for the Entangled page
 */
export function getEntangledPageUrl(ethTokenId: string, tezosTokenId: string): string {
	// Validate input parameters
	if (!ethTokenId || ethTokenId === 'null' || ethTokenId === 'undefined') {
		console.warn('[entangledHelpers] getEntangledPageUrl: missing or invalid ethTokenId', { ethTokenId });
		return '/entangled';
	}
	
	if (!tezosTokenId || tezosTokenId === 'null' || tezosTokenId === 'undefined') {
		console.warn('[entangledHelpers] getEntangledPageUrl: missing or invalid tezosTokenId', { tezosTokenId });
		return '/entangled';
	}
	
	return `/entangled?ethToken=${encodeURIComponent(ethTokenId)}&tezosToken=${encodeURIComponent(tezosTokenId)}`;
}

/**
 * Generate URL for the Entangled page from a single artwork (to find its pair)
 */
export function getEntangledPageUrlFromArtwork(artwork: any): string {
	if (!artwork) {
		console.warn('[entangledHelpers] getEntangledPageUrlFromArtwork called with null/undefined artwork');
		return '/entangled';
	}
	
	const tokenId = artwork.tokenId || artwork.tokenID;
	const contractAddress = artwork.contractAddr || artwork.contractAddress;
	
	// Validate that we have the required values
	if (!tokenId || tokenId === 'null' || tokenId === 'undefined') {
		console.warn('[entangledHelpers] getEntangledPageUrlFromArtwork: missing or invalid tokenId', { tokenId, artwork });
		return '/entangled';
	}
	
	if (!contractAddress || contractAddress === 'null' || contractAddress === 'undefined') {
		console.warn('[entangledHelpers] getEntangledPageUrlFromArtwork: missing or invalid contractAddress', { contractAddress, artwork });
		return '/entangled';
	}
	
	return `/entangled?tokenId=${encodeURIComponent(tokenId)}&contract=${encodeURIComponent(contractAddress)}`;
} 