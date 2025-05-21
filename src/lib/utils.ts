// Define a simple type for artwork objects
interface Artwork {
	image_url?: string;
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
		(_, index) => artworks[index]?.image_url || defaultImage
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

export function getContractUrl(address: string, blockchain?: string): string | undefined {
	if (!address) return undefined;

	// Handle Tezos addresses
	if (address.startsWith('KT1') || address.startsWith('KT2')) {
		return `https://tzkt.io/${address}`;
	}

	// Handle Ethereum-like addresses
	if (address.startsWith('0x')) {
		switch (blockchain?.toLowerCase()) {
			case 'polygon':
				return `https://polygonscan.com/address/${address}`;
			case 'ethereum':
			default:
				return `https://etherscan.io/address/${address}`;
		}
	}

	return undefined;
}
