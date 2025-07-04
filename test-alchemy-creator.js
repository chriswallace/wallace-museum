import { AlchemyNFTIndexer } from './src/lib/alchemy-nft-indexer.ts';

async function testAlchemyCreatorInfo() {
	try {
		// Initialize Alchemy indexer for Base
		const indexer = new AlchemyNFTIndexer(process.env.ALCHEMY_API_KEY, 'base');

		console.log('Testing Alchemy API response for Base NFTs...');

		// Get a single NFT to examine the response structure
		const nfts = await indexer.getWalletNFTs('0x8367a713bc14212ab1bb8c55a778e43e50b8b927', {
			pageSize: 1,
			includeMetadata: true
		});

		if (nfts.length > 0) {
			const nft = nfts[0];
			console.log('Sample NFT data:');
			console.log('Contract:', nft.contractAddress);
			console.log('Token ID:', nft.tokenId);
			console.log('Title:', nft.title);
			console.log('Creator:', nft.creator);

			if (nft.creator) {
				console.log('Creator address:', nft.creator.address);
				console.log('Resolution source:', nft.creator.resolutionSource);
			} else {
				console.log('No creator information found');
			}
		} else {
			console.log('No NFTs found');
		}
	} catch (error) {
		console.error('Error testing Alchemy creator info:', error);
	}
}

testAlchemyCreatorInfo();
