/**
 * Etherscan API helpers for getting accurate mint dates when OpenSea doesn't have events
 */

/**
 * Fetches the actual mint date from Etherscan by looking for the first transfer event from zero address
 * @param {string} contractAddress - The contract address
 * @param {string} tokenId - The token ID
 * @param {string|undefined} apiKey - Etherscan API key (optional, but recommended for rate limits)
 * @returns {Promise<string|null>} - The mint date timestamp or null if not found
 */
export async function fetchMintDateFromEtherscan(contractAddress, tokenId, apiKey) {
	try {
		// For high token IDs like 70679, we need to search through more results
		// Use a systematic approach with larger offsets
		const maxPages = 100; // Increased search range
		const offsetPerPage = 1000; // Large offset to cover more ground

		for (let page = 1; page <= maxPages; page++) {
			console.log(`[etherscanHelpers] Searching page ${page} for token ${tokenId}...`);

			// Etherscan API endpoint for ERC721 transfers
			const baseUrl = 'https://api.etherscan.io/api';
			const params = new URLSearchParams({
				module: 'account',
				action: 'tokennfttx',
				contractaddress: contractAddress,
				page: page.toString(),
				offset: offsetPerPage.toString(),
				sort: 'asc', // Oldest first
				...(apiKey && { apikey: apiKey })
			});

			const url = `${baseUrl}?${params}`;

			const response = await fetch(url);

			if (!response.ok) {
				console.warn(`[etherscanHelpers] Etherscan API request failed: ${response.status}`);
				continue; // Try next page
			}

			const data = await response.json();

			if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
				console.warn(
					`[etherscanHelpers] Etherscan API returned error on page ${page}:`,
					data.message
				);
				if (data.result === 'No transactions found') {
					break; // No more results
				}
				continue;
			}

			console.log(`[etherscanHelpers] Found ${data.result.length} transfers on page ${page}`);

			// Look for the mint event (transfer from zero address) for this specific token
			const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
			const mintTransfer = data.result.find(
				/** @param {any} tx */
				(tx) => tx.from.toLowerCase() === ZERO_ADDRESS.toLowerCase() && tx.tokenID === tokenId
			);

			if (mintTransfer && mintTransfer.timeStamp) {
				// Convert Unix timestamp to ISO string
				const mintDate = new Date(parseInt(mintTransfer.timeStamp) * 1000);
				console.log(`[etherscanHelpers] Found mint date from Etherscan: ${mintDate.toISOString()}`);
				return mintDate.toISOString();
			}

			// Show token range for debugging
			if (data.result.length > 0) {
				const tokenIds = data.result
					.map(/** @param {any} tx */ (tx) => parseInt(tx.tokenID))
					.sort(/** @param {number} a @param {number} b */ (a, b) => a - b);
				const maxTokenInPage = tokenIds[tokenIds.length - 1];
				console.log(
					`[etherscanHelpers] Page ${page} token range: ${tokenIds[0]} - ${maxTokenInPage}`
				);

				// Check if we found our target token in the range (even if not a mint)
				const foundTargetToken = data.result.some(
					/** @param {any} tx */ (tx) => tx.tokenID === tokenId
				);
				if (foundTargetToken) {
					console.log(
						`[etherscanHelpers] Found token ${tokenId} in results but no mint event (transfer from zero address)`
					);
				}
			}

			// Add delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		console.warn(
			`[etherscanHelpers] No mint transfer found for token ${tokenId} in contract ${contractAddress} after searching ${maxPages} pages`
		);
		return null;
	} catch (error) {
		console.error(`[etherscanHelpers] Error fetching mint date from Etherscan:`, error);
		return null;
	}
}

/**
 * Fetches contract creation date from Etherscan as a fallback
 * @param {string} contractAddress - The contract address
 * @param {string|undefined} apiKey - Etherscan API key (optional)
 * @returns {Promise<string|null>} - The contract creation date or null if not found
 */
export async function fetchContractCreationDate(contractAddress, apiKey) {
	try {
		const baseUrl = 'https://api.etherscan.io/api';
		const params = new URLSearchParams({
			module: 'contract',
			action: 'getcontractcreation',
			contractaddresses: contractAddress,
			...(apiKey && { apikey: apiKey })
		});

		const url = `${baseUrl}?${params}`;
		console.log(
			`[etherscanHelpers] Fetching contract creation date from Etherscan for ${contractAddress}`
		);

		const response = await fetch(url);

		if (!response.ok) {
			console.warn(`[etherscanHelpers] Etherscan contract API request failed: ${response.status}`);
			return null;
		}

		const data = await response.json();

		if (
			data.status !== '1' ||
			!data.result ||
			!Array.isArray(data.result) ||
			data.result.length === 0
		) {
			console.warn(`[etherscanHelpers] Etherscan contract API returned no results`);
			return null;
		}

		const contractInfo = data.result[0];
		if (contractInfo.txHash) {
			// Get the transaction details to get the timestamp
			return await fetchTransactionTimestamp(contractInfo.txHash, apiKey);
		}

		return null;
	} catch (error) {
		console.error(`[etherscanHelpers] Error fetching contract creation date:`, error);
		return null;
	}
}

/**
 * Fetches transaction timestamp from Etherscan
 * @param {string} txHash - The transaction hash
 * @param {string|undefined} apiKey - Etherscan API key (optional)
 * @returns {Promise<string|null>} - The transaction timestamp or null if not found
 */
export async function fetchTransactionTimestamp(txHash, apiKey) {
	try {
		const baseUrl = 'https://api.etherscan.io/api';
		const params = new URLSearchParams({
			module: 'proxy',
			action: 'eth_getTransactionByHash',
			txhash: txHash,
			...(apiKey && { apikey: apiKey })
		});

		const url = `${baseUrl}?${params}`;

		const response = await fetch(url);

		if (!response.ok) {
			console.warn(
				`[etherscanHelpers] Etherscan transaction API request failed: ${response.status}`
			);
			return null;
		}

		const data = await response.json();

		if (!data.result || !data.result.blockNumber) {
			console.warn(`[etherscanHelpers] No transaction data found for ${txHash}`);
			return null;
		}

		// Get block timestamp
		const blockNumber = data.result.blockNumber;
		return await fetchBlockTimestamp(blockNumber, apiKey);
	} catch (error) {
		console.error(`[etherscanHelpers] Error fetching transaction timestamp:`, error);
		return null;
	}
}

/**
 * Fetches block timestamp from Etherscan
 * @param {string} blockNumber - The block number (hex)
 * @param {string|undefined} apiKey - Etherscan API key (optional)
 * @returns {Promise<string|null>} - The block timestamp or null if not found
 */
export async function fetchBlockTimestamp(blockNumber, apiKey) {
	try {
		const baseUrl = 'https://api.etherscan.io/api';
		const params = new URLSearchParams({
			module: 'proxy',
			action: 'eth_getBlockByNumber',
			tag: blockNumber,
			boolean: 'false',
			...(apiKey && { apikey: apiKey })
		});

		const url = `${baseUrl}?${params}`;

		const response = await fetch(url);

		if (!response.ok) {
			console.warn(`[etherscanHelpers] Etherscan block API request failed: ${response.status}`);
			return null;
		}

		const data = await response.json();

		if (!data.result || !data.result.timestamp) {
			console.warn(`[etherscanHelpers] No block data found for ${blockNumber}`);
			return null;
		}

		// Convert hex timestamp to ISO string
		const timestamp = parseInt(data.result.timestamp, 16);
		const date = new Date(timestamp * 1000);
		return date.toISOString();
	} catch (error) {
		console.error(`[etherscanHelpers] Error fetching block timestamp:`, error);
		return null;
	}
}
