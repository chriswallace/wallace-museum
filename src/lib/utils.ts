export function getCoverImages(artworks, defaultImage, maxImages = 4) {
	// Create an array of image URLs or default images if the artwork doesn't exist
	return Array.from(
		{ length: maxImages },
		(_, index) => artworks[index]?.image_url || defaultImage
	);
}

export function placeholderAvatar(name) {
	const formattedName = name.trim().replace(/\s+/g, '');
	return `https://avatar.iran.liara.run/username?username=${formattedName}&length=1`;
}

// Helper function to find a specific attribute by name
export function findAttribute(attributes, trait_type) {
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
		return contentType && contentType.startsWith('video/');
	} catch (error) {
		console.error('Failed to detect content type:', error);
		return false;
	}
};

export const isImage = async (url: string): Promise<boolean> => {
	try {
		const response = await fetch(url, { method: 'HEAD' });
		const contentType = response.headers.get('Content-Type');
		return contentType && contentType.startsWith('image/');
	} catch (error) {
		console.error('Failed to detect content type:', error);
		return false;
	}
};
