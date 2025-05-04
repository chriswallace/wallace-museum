// ** IMPORTANT: This file currently uses a placeholder for the Cloudinary Cloud Name. **
// ** You MUST define PUBLIC_CLOUDINARY_CLOUD_NAME in your SvelteKit environment **
// ** (e.g., in .env file) and uncomment the import below for Cloudinary URLs to work correctly. **

// import { PUBLIC_CLOUDINARY_CLOUD_NAME as CLOUD_NAME_FROM_ENV } from '$env/dynamic/public'; // Uncomment after defining in .env

// Placeholder logic - Relies solely on this until import is uncommented
const PUBLIC_CLOUDINARY_CLOUD_NAME = 'your_cloud_name_placeholder';
// const PUBLIC_CLOUDINARY_CLOUD_NAME = CLOUD_NAME_FROM_ENV || 'your_cloud_name_placeholder'; // Use this line once import is restored

/**
 * Extracts the public ID and resource type from a Cloudinary URL.
 * Assumes URL format like: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<version>/<public_id>.<format>
 * or https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<public_id>
 */
function extractPublicIdAndResourceType(url: string): { publicId: string | null; resourceType: string | null } {
	if (!url) {
		return { publicId: null, resourceType: null };
	}
	try {
		const urlParts = new URL(url).pathname.split('/');
		// Expected structure: ['', <cloud_name>, <resource_type>, 'upload', ..., <public_id_with_possible_version_and_format>]
		const uploadIndex = urlParts.indexOf('upload');
		if (uploadIndex === -1 || uploadIndex < 2) {
			console.warn('[cloudinaryUtils] Could not find "upload" segment or invalid structure:', url);
			return { publicId: null, resourceType: null };
		}

		const resourceType = urlParts[uploadIndex - 1];
		// Join remaining parts after 'upload/' and remove potential format extension
		const publicIdWithPotentialVersion = urlParts.slice(uploadIndex + 1).join('/');
		// Remove version prefix if present (e.g., v1234567890/)
		const publicIdWithoutVersion = publicIdWithPotentialVersion.replace(/^v\d+\//, '');
		// Remove format extension
		const publicId = publicIdWithoutVersion.replace(/\.[^/.]+$/, "");

		if (!publicId || !resourceType) {
 			console.warn('[cloudinaryUtils] Could not extract publicId or resourceType:', url);
 			return { publicId: null, resourceType: null };
 		}

		return { publicId, resourceType };
	} catch (error) {
		console.error('[cloudinaryUtils] Error parsing Cloudinary URL:', url, error);
		return { publicId: null, resourceType: null };
	}
}

/**
 * Generates a transformed Cloudinary URL.
 * @param baseUrl The original Cloudinary URL (e.g., from the database).
 * @param transformations Cloudinary transformation string (e.g., "w_400,q_auto,f_auto").
 * @returns The transformed URL, or the original URL if extraction fails.
 */
export function getCloudinaryTransformedUrl(baseUrl: string | undefined | null, transformations: string): string {
	if (!baseUrl) return ''; // Return empty string if no base URL

	// Check if using the placeholder
	if (!PUBLIC_CLOUDINARY_CLOUD_NAME || PUBLIC_CLOUDINARY_CLOUD_NAME === 'your_cloud_name_placeholder') {
		console.warn('*** CLOUDINARY WARNING: Using placeholder cloud name. Define PUBLIC_CLOUDINARY_CLOUD_NAME in your environment and update cloudinaryUtils.ts. ***');
		// Return original URL if env var is missing or using placeholder
        return baseUrl; 
	}

	const { publicId, resourceType } = extractPublicIdAndResourceType(baseUrl);

	if (!publicId || !resourceType) {
		return baseUrl; // Return original URL if extraction failed
	}

	// Construct the new URL
	// Note: We explicitly don't include the version here, letting Cloudinary handle caching via transformations.
	return `https://res.cloudinary.com/${PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${transformations}/${publicId}`;
}

/**
 * Generates a Cloudinary URL with automatic format and quality.
 * Primarily used for simple image displays where only width might be needed.
 */
export function getCloudinaryImageUrl(baseUrl: string | undefined | null, width?: number): string {
    const baseTransforms = 'q_auto,f_auto';
    const widthTransform = width ? `,w_${width}` : '';
    return getCloudinaryTransformedUrl(baseUrl, `${baseTransforms}${widthTransform}`);
} 