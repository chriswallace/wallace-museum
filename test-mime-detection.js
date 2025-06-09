/**
 * Simple test script to verify MIME type detection API
 * Run with: node test-mime-detection.js
 */

const testArtworks = [
	{
		id: 1,
		image_url: 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/image.png',
		animation_url: null,
		thumbnailUrl: null
	},
	{
		id: 2,
		image_url: 'https://ipfs.io/ipfs/QmSomeVideoHash/video.mp4',
		animation_url: 'https://ipfs.io/ipfs/QmSomeVideoHash/video.mp4',
		thumbnailUrl: null
	},
	{
		id: 3,
		image_url: null,
		animation_url: 'https://generator.artblocks.io/0x123/456',
		thumbnailUrl: null
	},
	{
		id: 4,
		image_url: 'https://cloudflare-ipfs.com/ipfs/QmNRyRpPkfbBjWtbdLBedEMBNyUJ8pJkfWzJ4jdUYMPW2M',
		animation_url: null,
		thumbnailUrl: null
	},
	{
		id: 5,
		image_url: null,
		animation_url: 'https://ipfs.io/ipfs/QmTestGifHash/animation.gif',
		thumbnailUrl: null
	}
];

async function testMimeDetection() {
	try {
		console.log('Testing MIME type detection API...');
		console.log('='.repeat(50));

		const response = await fetch('http://localhost:5173/api/admin/detect-mime', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				artworks: testArtworks
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const result = await response.json();

		console.log('MIME detection results:');
		console.log('-'.repeat(30));

		result.results.forEach((item, index) => {
			const artwork = testArtworks[index];
			console.log(`Artwork ${item.id}:`);
			console.log(`  Image URL: ${artwork.image_url || 'none'}`);
			console.log(`  Animation URL: ${artwork.animation_url || 'none'}`);
			console.log(`  Detected MIME: ${item.mime || 'none'}`);
			console.log('');
		});

		// Show detection method statistics if available
		if (result.stats) {
			console.log('Detection Method Statistics:');
			console.log('-'.repeat(30));
			Object.entries(result.stats).forEach(([method, count]) => {
				console.log(`  ${method}: ${count} artworks`);
			});
			console.log('');
		}

		// Performance summary
		const successful = result.results.filter((r) => r.mime !== null).length;
		const total = result.results.length;
		console.log(
			`Success Rate: ${successful}/${total} (${Math.round((successful / total) * 100)}%)`
		);
	} catch (error) {
		console.error('Error testing MIME detection:', error);
	}
}

// Only run if this file is executed directly
if (require.main === module) {
	testMimeDetection();
}

module.exports = { testMimeDetection };
