/**
 * Auto-detect blockchain type based on wallet address format
 * @param {string} address - The wallet address to analyze
 * @returns {string} - The detected blockchain ('ethereum', 'tezos', or 'unknown')
 */
export function detectBlockchain(address) {
	if (!address || typeof address !== 'string') {
		return 'unknown';
	}

	const cleanAddress = address.trim();

	// Ethereum addresses: start with 0x and are 42 characters long
	if (cleanAddress.startsWith('0x') && cleanAddress.length === 42) {
		return 'ethereum';
	}

	// Tezos addresses: start with tz1, tz2, tz3, or KT1
	if (cleanAddress.match(/^(tz1|tz2|tz3|KT1)[a-zA-Z0-9]{33}$/)) {
		return 'tezos';
	}

	return 'unknown';
}

/**
 * Auto-detect blockchain type based on smart contract address format
 * @param {string} contractAddress - The smart contract address to analyze
 * @returns {string} - The detected blockchain ('ethereum', 'tezos', or 'unknown')
 */
export function detectBlockchainFromContract(contractAddress) {
	if (!contractAddress || typeof contractAddress !== 'string') {
		return 'unknown';
	}

	const cleanAddress = contractAddress.trim();

	// Tezos smart contracts: start with KT1 or KT2 (case insensitive)
	if (
		cleanAddress.toLowerCase().startsWith('kt1') ||
		cleanAddress.toLowerCase().startsWith('kt2')
	) {
		return 'tezos';
	}

	// Ethereum smart contracts: start with 0x
	if (cleanAddress.startsWith('0x')) {
		return 'ethereum';
	}

	return 'unknown';
}

/**
 * Validate wallet address format
 * @param {string} address - The wallet address to validate
 * @param {string|null} blockchain - Optional blockchain to validate against
 * @returns {boolean} - Whether the address is valid
 */
export function isValidWalletAddress(address, blockchain = null) {
	if (!address || typeof address !== 'string') {
		return false;
	}

	const detectedBlockchain = detectBlockchain(address);

	if (blockchain) {
		return detectedBlockchain === blockchain;
	}

	return detectedBlockchain !== 'unknown';
}

/**
 * Format wallet addresses array for database storage
 * @param {string[]} addresses - Array of wallet addresses
 * @returns {Array<{address: string, blockchain: string}>} - Array of wallet objects with address and blockchain
 */
export function formatWalletsForStorage(addresses) {
	if (!Array.isArray(addresses)) {
		return [];
	}

	return addresses
		.filter((address) => isValidWalletAddress(address))
		.map((address) => ({
			address: address.trim(),
			blockchain: detectBlockchain(address.trim())
		}));
}

/**
 * Parse wallet addresses from various input formats
 * @param {string|string[]} input - Comma-separated string or array of addresses
 * @returns {string[]} - Array of cleaned wallet addresses
 */
export function parseWalletInput(input) {
	if (!input) {
		return [];
	}

	/** @type {string[]} */
	let addresses = [];

	if (typeof input === 'string') {
		// Split by comma, newline, or semicolon
		addresses = input
			.split(/[,;\n]/)
			.map((addr) => addr.trim())
			.filter(Boolean);
	} else if (Array.isArray(input)) {
		addresses = input.map((addr) => String(addr).trim()).filter(Boolean);
	}

	return addresses;
}

/**
 * Get blockchain display name
 * @param {string} blockchain - The blockchain identifier
 * @returns {string} - Human-readable blockchain name
 */
export function getBlockchainDisplayName(blockchain) {
	/** @type {Record<string, string>} */
	const names = {
		ethereum: 'Ethereum',
		base: 'Base',
		shape: 'Shape',
		polygon: 'Polygon',
		tezos: 'Tezos',
		unknown: 'Unknown'
	};

	return names[blockchain] || 'Unknown';
}

/**
 * Group wallets by blockchain
 * @param {Array<{address: string, blockchain: string}>} wallets - Array of wallet objects
 * @returns {Record<string, Array<{address: string, blockchain: string}>>} - Wallets grouped by blockchain
 */
export function groupWalletsByBlockchain(wallets) {
	if (!Array.isArray(wallets)) {
		return {};
	}

	return wallets.reduce((groups, wallet) => {
		const blockchain = wallet.blockchain || 'unknown';
		if (!groups[blockchain]) {
			groups[blockchain] = [];
		}
		groups[blockchain].push(wallet);
		return groups;
	}, /** @type {Record<string, Array<{address: string, blockchain: string}>>} */ ({}));
}
