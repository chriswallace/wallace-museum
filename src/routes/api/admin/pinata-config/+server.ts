import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

/**
 * Diagnostic endpoint to check Pinata configuration
 * Only shows whether variables are set, not their actual values
 */
export const GET: RequestHandler = async () => {
	const pinataGateway = env.PINATA_GATEWAY;
	const pinataGatewayKey = env.PINATA_GATEWAY_KEY;
	const pinataJwt = env.PINATA_JWT;

	return json({
		config: {
			PINATA_GATEWAY: {
				isSet: !!pinataGateway,
				value: pinataGateway ? `${pinataGateway.substring(0, 10)}...` : null,
				length: pinataGateway?.length || 0
			},
			PINATA_GATEWAY_KEY: {
				isSet: !!pinataGatewayKey,
				length: pinataGatewayKey?.length || 0,
				preview: pinataGatewayKey ? `${pinataGatewayKey.substring(0, 8)}...` : null
			},
			PINATA_JWT: {
				isSet: !!pinataJwt,
				length: pinataJwt?.length || 0
			}
		}
	});
};
