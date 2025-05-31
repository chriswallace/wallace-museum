// Define a simple type for artwork objects
interface Artwork {
	imageUrl?: string;
	// Add other potential properties if known
}

// Define a simple type for attribute objects
interface Attribute {
	trait_type: string;
	value: any; // Use 'any' for now, or a more specific union type if possible
}

export function getCoverImages(artworks: Artwork[], defaultImage: string, maxImages = 4): string[] {
	// Create an array of image URLs or default images if the artwork doesn't exist
	return Array.from(
		{ length: maxImages },
		(_, index) => artworks[index]?.imageUrl || defaultImage
	);
}

export function placeholderAvatar(name: string): string {
	const formattedName = name.trim().replace(/\s+/g, '');
	return `https://avatar.iran.liara.run/username?username=${formattedName}&length=1`;
}

// Helper function to find a specific attribute by name
export function findAttribute(
	attributes: Attribute[] | null | undefined,
	trait_type: string
): any | null {
	if (!attributes || !Array.isArray(attributes)) return null;
	const attribute = attributes.find((attr) => attr.trait_type === trait_type);
	return attribute ? attribute.value : null;
}

export const isVideo = async (url: string): Promise<boolean> => {
	try {
		if (!url) {
			console.error('isVideo: URL is undefined or empty');
			return false;
		}
		const response = await fetch(url, { method: 'HEAD' });
		const contentType = response.headers.get('Content-Type');
		return !!(contentType && contentType.startsWith('video/'));
	} catch (error) {
		console.error('Failed to detect content type:', error);
		return false;
	}
};

export const isImage = async (url: string): Promise<boolean> => {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		const contentType = response.headers.get('Content-Type');
		return !!(contentType && contentType.startsWith('image/'));
	} catch (error) {
		console.error('Failed to detect content type:', error);
		return false;
	}
};

// Contract name mappings for well-known contracts
const CONTRACT_NAMES: Record<string, string> = {
	// Art Blocks Ethereum contracts
	'0x059edd72cd353df5106d2b9cc5ab83a52287ac3a': 'Art Blocks Curated',
	'0xa7d8d9ef8d8ce8992df33d8b8cf4aebabd5bd270': 'Art Blocks Factory',
	'0x99a9b7c1116f9ceeb1652de04d5969cce509b069': 'Art Blocks Playground',
	'0x0e6a21cf97d6a9d9d8f794d26dfb3e3baa49f3ac': 'Art Blocks Presents Flex',

	// Shared platforms Ethereum
	'0x495f947276749ce646f68ac8c248420045cb7b5e': 'OpenSea Shared Storefront',
	'0xa5409ec958c83c3f309868babaca7c86dcb077c1': 'OpenSea Collections',
	'0x2953399124f0cbb46d2cbacd8a89cf0599974963': 'OpenSea Collections v2',
	'0xd07dc4262bcdbf85190c01c996b4c06a461d2430': 'Rarible ERC-721',
	'0xb66a603f4cfe17e3d27b87a8bfcad319856518b8': 'Rarible ERC-1155',
	'0xb932a70a57673d89f4acffbe830e8ed7f75fb9e0': 'SuperRare',
	'0x3b3ee1931dc30c1957379fac9aba94d1c48a5405': 'Foundation',
	'0xabefbc9fd2f806065b4f3c237d4b59d9a97bcac7': 'Zora Media',
	'0x7c2668bd0d3c050703cecc956c11bd520c26f7d4': 'Zora Editions',

	// Tezos contracts
	KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton: 'hic et nunc',
	KT1Hkg5qeNhfwpKW4fXvq7HGZB9z2EnmCCA9: 'hic et nunc v2',
	KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi: 'fxhash v1',
	KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE: 'fxhash v2',
	KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk: 'fxhash gentk v1',
	KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr: 'fxhash gentk v2',
	KT1My1wDZHDGweCrJnQJi3wcFaS67iksirvj: 'Teia Community',
	KT1LjmAdYQCLBjwv4S2oFkEzyHVkomAf5MrW: 'Versum',
	KT1EpGgjQs73QfFJs9z7m1Mxm5MTnpC2tqse: 'Kalamint',
	KT1VoZeuBMJF6vxtLqEFMoc4no4VDuu1QVwc: 'Typed',
	KT1MxDwChiDwd6WBVs24g1NjERUoK622ZEFp: '8bidou',
	KT1XTKaKBXKJVmhxtLF96mn4WQLqmfGGYuKy: 'DNA'
};

/**
 * Truncate an address to show first 6 and last 4 characters
 */
export function truncateAddress(address: string): string {
	if (!address || address.length <= 10) {
		return address;
	}
	return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * Get a human-readable name for a contract address
 */
export function getContractName(address: string, contractAlias?: string): string {
	if (!address) return contractAlias || 'Unknown Contract';

	// Check if we have a known contract name
	const normalizedAddress = address.toLowerCase();
	const knownName = CONTRACT_NAMES[normalizedAddress] || CONTRACT_NAMES[address];

	if (knownName) {
		return knownName;
	}

	// Fall back to provided alias or shortened address
	if (contractAlias) {
		return contractAlias;
	}

	// Return shortened address as fallback
	if (address.length > 10) {
		return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
	}

	return address;
}

export function getContractUrl(
	address: string,
	blockchain?: string,
	tokenId?: string
): string | undefined {
	if (!address) return undefined;

	// Handle Tezos addresses
	if (address.startsWith('KT1') || address.startsWith('KT2')) {
		if (tokenId) {
			return `https://tzkt.io/${address}/tokens/${tokenId}`;
		}
		return `https://tzkt.io/${address}`;
	}

	// Handle Ethereum-like addresses
	if (address.startsWith('0x')) {
		switch (blockchain?.toLowerCase()) {
			case 'polygon':
				if (tokenId) {
					return `https://polygonscan.com/token/${address}?a=${tokenId}`;
				}
				return `https://polygonscan.com/address/${address}`;
			case 'ethereum':
			default:
				if (tokenId) {
					return `https://etherscan.io/token/${address}?a=${tokenId}`;
				}
				return `https://etherscan.io/address/${address}`;
		}
	}

	return undefined;
}

export function isFxhashContract(contractAddress: string): boolean {
	const fxhashContracts = [
		'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi', // fxhash v1
		'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE', // fxhash v2
		'KT1AaaBSo5AE6Eo8fpEN5xhCD4w3kHStafxk', // fxhash gentk v1
		'KT1XCoGnfupWk7Sp8536EfrxcP73LmT68Nyr' // fxhash gentk v2
	];

	return fxhashContracts.includes(contractAddress);
}

/**
 * Utility to validate blockchain addresses (Ethereum/Tezos)
 */
export function isValidAddress(address: string | undefined | null): boolean {
	if (!address) return false;
	if (address === '-') return false;
	if (address === '0x0000000000000000000000000000000000000000') return false;
	if (address.length < 20) return false;
	return true;
}
