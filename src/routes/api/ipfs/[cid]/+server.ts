import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const IPFS_GATEWAY = 'https://ipfs.wallacemuseum.com/ipfs/'; // Use Wallace Museum Pinata proxy for media
const PINATA_GATEWAY_TOKEN = 'ezmv1YoBrLBuXqWs1CyFxZ2P1SOpOF-X9mgJTP1EmH9d-1F6m6spo1dpD4YoXxw6';

export const GET: RequestHandler = async ({ params, url, fetch }) => {
	const { cid } = params;
	
	if (!cid) {
		throw error(400, 'CID is required');
	}

	// Validate CID format (basic check)
	if (!cid.startsWith('Qm') && !cid.startsWith('bafy')) {
		throw error(400, 'Invalid CID format');
	}

	// Get any additional path from the URL
	const path = url.searchParams.get('path') || '';
	const fullPath = path ? `${cid}/${path}` : cid;

	try {
		// Forward the request to the Wallace Museum IPFS gateway with token
		const gatewayUrl = new URL(`${IPFS_GATEWAY}${fullPath}`);
		gatewayUrl.searchParams.set('pinataGatewayToken', PINATA_GATEWAY_TOKEN);
		
		const response = await fetch(gatewayUrl.toString(), {
			headers: {
				'User-Agent': 'Wallace Museum Collection'
			}
		});

		if (!response.ok) {
			throw error(response.status, `Failed to fetch from IPFS: ${response.statusText}`);
		}

		// Get the content type from the response
		const contentType = response.headers.get('content-type') || 'application/octet-stream';
		
		// Stream the response back to the client
		return new Response(response.body, {
			status: response.status,
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (err) {
		console.error('IPFS proxy error:', err);
		throw error(500, 'Failed to fetch content from IPFS');
	}
}; 