/**
 * Test script to verify Tezos gallery information is being used for collection resolution
 * This script tests the updated indexing process that prioritizes gallery data over FA contract data
 */

// Mock Tezos token data with gallery information
const mockTezosTokenWithGallery = {
	token_id: '1',
	name: 'Test Artwork',
	description: 'A test artwork with gallery information',
	display_uri: 'https://example.com/image.jpg',
	fa: {
		contract: 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi',
		name: 'fxhash Contract',
		description: 'fxhash smart contract'
	},
	galleries: [
		{
			gallery: {
				gallery_id: '15053',
				logo: 'ipfs://QmeSURYMdeC9e5dTZxTDMjFW8JC8DvVAFe8GNAs4xKey3h',
				name: 'Shapes on a Plane',
				slug: 'shapes-on-a-plane',
				pk: 907478,
				registry: {
					type: 'auto',
					name: 'fxhash',
					slug: 'fxhash',
					__typename: 'gallery_registry'
				},
				__typename: 'gallery'
			},
			__typename: 'gallery_token'
		}
	],
	creators: [
		{
			creator_address: 'tz1fepn7jZsCYBqCDhpM63hzh9g2Ytqk4Tpv',
			holder: {
				address: 'tz1fepn7jZsCYBqCDhpM63hzh9g2Ytqk4Tpv',
				alias: 'Test Artist'
			}
		}
	]
};

// Mock Tezos token data without gallery information (fallback to FA contract)
const mockTezosTokenWithoutGallery = {
	token_id: '2',
	name: 'Test Artwork 2',
	description: 'A test artwork without gallery information',
	display_uri: 'https://example.com/image2.jpg',
	fa: {
		contract: 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi',
		name: 'fxhash Contract',
		description: 'fxhash smart contract'
	},
	creators: [
		{
			creator_address: 'tz1fepn7jZsCYBqCDhpM63hzh9g2Ytqk4Tpv',
			holder: {
				address: 'tz1fepn7jZsCYBqCDhpM63hzh9g2Ytqk4Tpv',
				alias: 'Test Artist'
			}
		}
	]
};

async function testTezosGalleryIndexing() {
	console.log('🧪 Testing Tezos Gallery Indexing with Mock Data...\n');

	try {
		// Import the transformer from the built server chunks (exported as 'M')
		const { M: MinimalNFTTransformer } = await import(
			'../.svelte-kit/output/server/chunks/minimal-transformers.js'
		);
		const transformer = new MinimalNFTTransformer();

		console.log('✅ Successfully imported MinimalNFTTransformer\n');

		// Test 1: Token with gallery information
		console.log('🎨 Test 1: Token WITH gallery information');
		const nftWithGallery = await transformer.transformTezosToken(mockTezosTokenWithGallery);

		console.log(`   Title: ${nftWithGallery.title}`);
		console.log(`   Contract: ${nftWithGallery.contractAddress}`);
		console.log(`   Token ID: ${nftWithGallery.tokenId}`);

		if (nftWithGallery.collection) {
			console.log(`   Collection Slug: ${nftWithGallery.collection.slug}`);
			console.log(`   Collection Title: ${nftWithGallery.collection.title}`);
			console.log(`   Collection Image: ${nftWithGallery.collection.imageUrl || 'None'}`);

			// Check if the collection slug looks like a gallery slug vs contract address
			if (nftWithGallery.collection.slug !== nftWithGallery.contractAddress) {
				console.log(
					`   ✅ SUCCESS: Using gallery-based collection (slug: "${nftWithGallery.collection.slug}" differs from contract: "${nftWithGallery.contractAddress}")`
				);
			} else {
				console.log(`   ❌ FAIL: Using contract-based collection (slug matches contract)`);
			}
		} else {
			console.log(`   ❌ FAIL: No collection information found`);
		}

		console.log('');

		// Test 2: Token without gallery information (should fallback to FA contract)
		console.log('🎨 Test 2: Token WITHOUT gallery information (should fallback to FA contract)');
		const nftWithoutGallery = await transformer.transformTezosToken(mockTezosTokenWithoutGallery);

		console.log(`   Title: ${nftWithoutGallery.title}`);
		console.log(`   Contract: ${nftWithoutGallery.contractAddress}`);
		console.log(`   Token ID: ${nftWithoutGallery.tokenId}`);

		if (nftWithoutGallery.collection) {
			console.log(`   Collection Slug: ${nftWithoutGallery.collection.slug}`);
			console.log(`   Collection Title: ${nftWithoutGallery.collection.title}`);
			console.log(`   Collection Image: ${nftWithoutGallery.collection.imageUrl || 'None'}`);

			// Check if the collection slug matches the contract address (expected for fallback)
			if (nftWithoutGallery.collection.slug === nftWithoutGallery.contractAddress) {
				console.log(
					`   ✅ SUCCESS: Using FA contract-based collection as fallback (slug matches contract)`
				);
			} else {
				console.log(`   ❌ FAIL: Collection slug doesn't match contract address`);
			}
		} else {
			console.log(`   ❌ FAIL: No collection information found`);
		}

		console.log('\n🎉 Gallery indexing test completed!');
	} catch (error) {
		console.error('❌ Test failed:', error);
	}
}

// Run the test
testTezosGalleryIndexing().catch(console.error);
