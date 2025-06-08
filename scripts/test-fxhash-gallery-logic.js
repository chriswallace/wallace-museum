import { OptimizedTezosAPI } from '../src/lib/indexing/tezos-optimized-api.js';

// Known fxhash contract addresses
const FXHASH_CONTRACTS = [
	'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash v1
	'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash v2
	'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', // fxhash gentk v1
	'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr' // fxhash gentk v2
];

/**
 * Check if a contract address is an fxhash contract
 */
function isFxhashContract(contractAddress) {
	return FXHASH_CONTRACTS.includes(contractAddress);
}

/**
 * Test fxhash gallery logic with real API data
 */
async function testFxhashGalleryLogic() {
	console.log('🧪 Testing fxhash gallery logic with real API data...\n');

	const api = new OptimizedTezosAPI();

	// Test wallets known to have fxhash tokens
	const testWallets = [
		'tz1fepn7jZsCYBqCDhpM63hzh9g2Ytqk4Tpv', // Known fxhash collector
		'tz1g6JRCpsEnD2BLiAzPNK3GBD1fKicV9rCx', // Another known collector
		'tz1UBZUkXpKGhYsP5KtzDNqLLchwF4uHrGjw' // Another test wallet
	];

	let totalTokensTested = 0;
	let fxhashTokensFound = 0;
	let tokensWithGalleries = 0;
	let tokensUsingGalleryForCollection = 0;

	for (const wallet of testWallets) {
		console.log(`\n📋 Testing wallet: ${wallet}`);

		try {
			// Fetch owned tokens for this wallet
			const result = await api.fetchWalletNFTs(wallet, 'owned', 50, 0);
			console.log(`   Found ${result.nfts.length} tokens`);

			for (const nft of result.nfts) {
				totalTokensTested++;

				// Check if this is an fxhash token
				if (isFxhashContract(nft.contractAddress)) {
					fxhashTokensFound++;
					console.log(`\n   🎨 fxhash Token Found:`);
					console.log(`      Contract: ${nft.contractAddress}`);
					console.log(`      Token ID: ${nft.tokenId}`);
					console.log(`      Name: ${nft.name}`);
					console.log(`      Collection: ${nft.collection?.title} (${nft.collection?.slug})`);

					// Fetch detailed token data to examine galleries
					const tokenDetails = await api.fetchTokenDetails(nft.contractAddress, nft.tokenId);

					if (tokenDetails && tokenDetails.rawData && tokenDetails.rawData.galleries) {
						tokensWithGalleries++;
						const galleries = tokenDetails.rawData.galleries;

						console.log(`      📚 Galleries found: ${galleries.length}`);

						galleries.forEach((galleryToken, index) => {
							const gallery = galleryToken.gallery;
							console.log(
								`         ${index + 1}. ${gallery.name} (ID: ${gallery.gallery_id}, Slug: ${gallery.slug})`
							);
							console.log(
								`            Registry: ${gallery.registry?.name} (${gallery.registry?.slug})`
							);

							if (index === 0) {
								console.log(`            ⭐ FIRST GALLERY - This should be used for collection`);

								// Check if the collection data matches the first gallery
								if (
									tokenDetails.collection?.slug === gallery.slug ||
									tokenDetails.collection?.externalCollectionId === gallery.gallery_id
								) {
									tokensUsingGalleryForCollection++;
									console.log(`            ✅ Collection data correctly uses first gallery`);
								} else {
									console.log(`            ❌ Collection data does NOT match first gallery`);
									console.log(
										`               Expected: ${gallery.slug} or ID ${gallery.gallery_id}`
									);
									console.log(
										`               Got: ${tokenDetails.collection?.slug} (ID: ${tokenDetails.collection?.externalCollectionId})`
									);
								}
							}
						});
					} else {
						console.log(`      📚 No galleries found for this token`);
					}

					// Add a small delay to be respectful to the API
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}

			// Add delay between wallets
			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			console.error(`   ❌ Error testing wallet ${wallet}:`, error.message);
		}
	}

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('📊 TEST SUMMARY');
	console.log('='.repeat(60));
	console.log(`Total tokens tested: ${totalTokensTested}`);
	console.log(`fxhash tokens found: ${fxhashTokensFound}`);
	console.log(`fxhash tokens with galleries: ${tokensWithGalleries}`);
	console.log(`fxhash tokens correctly using first gallery: ${tokensUsingGalleryForCollection}`);

	if (fxhashTokensFound > 0) {
		const successRate = ((tokensUsingGalleryForCollection / fxhashTokensFound) * 100).toFixed(1);
		console.log(`Success rate: ${successRate}%`);

		if (successRate < 90) {
			console.log('\n⚠️  WARNING: Success rate is below 90%. Gallery logic may need adjustment.');
		} else {
			console.log('\n✅ SUCCESS: Gallery logic appears to be working correctly!');
		}
	} else {
		console.log(
			'\n⚠️  No fxhash tokens found in test wallets. Try different wallets or check API connectivity.'
		);
	}
}

/**
 * Test specific fxhash tokens by contract and token ID
 */
async function testSpecificFxhashTokens() {
	console.log('\n🎯 Testing specific known fxhash tokens...\n');

	const api = new OptimizedTezosAPI();

	// Known fxhash tokens to test
	const testTokens = [
		{ contract: 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', tokenId: '1' },
		{ contract: 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', tokenId: '100' },
		{ contract: 'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', tokenId: '1' },
		{ contract: 'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', tokenId: '1' }
	];

	for (const token of testTokens) {
		console.log(`\n🔍 Testing token ${token.contract}:${token.tokenId}`);

		try {
			const tokenDetails = await api.fetchTokenDetails(token.contract, token.tokenId);

			if (tokenDetails) {
				console.log(`   Name: ${tokenDetails.name}`);
				console.log(
					`   Collection: ${tokenDetails.collection?.title} (${tokenDetails.collection?.slug})`
				);

				if (tokenDetails.rawData && tokenDetails.rawData.galleries) {
					const galleries = tokenDetails.rawData.galleries;
					console.log(`   Galleries: ${galleries.length} found`);

					galleries.forEach((galleryToken, index) => {
						const gallery = galleryToken.gallery;
						console.log(
							`      ${index + 1}. ${gallery.name} (${gallery.slug}) - Registry: ${gallery.registry?.name}`
						);
					});

					if (galleries.length > 0) {
						const firstGallery = galleries[0].gallery;
						console.log(
							`   First gallery should be collection: ${firstGallery.name} (${firstGallery.slug})`
						);

						if (tokenDetails.collection?.slug === firstGallery.slug) {
							console.log(`   ✅ Collection correctly uses first gallery`);
						} else {
							console.log(`   ❌ Collection does not match first gallery`);
						}
					}
				} else {
					console.log(`   No galleries found`);
				}
			} else {
				console.log(`   ❌ Token not found or error fetching details`);
			}

			// Rate limiting
			await new Promise((resolve) => setTimeout(resolve, 1500));
		} catch (error) {
			console.error(`   ❌ Error testing token:`, error.message);
		}
	}
}

/**
 * Main test function
 */
async function main() {
	console.log('🚀 Starting fxhash gallery logic tests...\n');

	try {
		// Test with real wallet data
		await testFxhashGalleryLogic();

		// Test specific tokens
		await testSpecificFxhashTokens();

		console.log('\n✨ All tests completed!');
	} catch (error) {
		console.error('❌ Test suite failed:', error);
		process.exit(1);
	}
}

// Run the tests
main().catch(console.error);
