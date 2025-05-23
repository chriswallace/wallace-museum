import { env } from '$env/dynamic/public';

// ** IMPORTANT: This file currently uses a placeholder for the Cloudinary Cloud Name. **
// ** You MUST define PUBLIC_CLOUDINARY_CLOUD_NAME in your SvelteKit environment **
// ** (e.g., in .env file) and uncomment the import below for Cloudinary URLs to work correctly. **

// import { PUBLIC_CLOUDINARY_CLOUD_NAME as CLOUD_NAME_FROM_ENV } from '$env/dynamic/public'; // Uncomment after defining in .env

// Placeholder logic - Relies solely on this until import is uncommented
const PUBLIC_CLOUDINARY_CLOUD_NAME = env.PUBLIC_CLOUDINARY_CLOUD_NAME;
// const PUBLIC_CLOUDINARY_CLOUD_NAME = CLOUD_NAME_FROM_ENV || 'your_cloud_name_placeholder'; // Use this line once import is restored

/**
 * Extracts the public ID and resource type from a Cloudinary URL.
 * Assumes URL format like: https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<version>/<public_id>.<format>
 * or https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/<public_id>
 */
function extractPublicIdAndResourceType(url: string): {
	publicId: string | null;
	resourceType: string | null;
} {
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
		// Join remaining parts after 'upload/'
		const publicIdWithPotentialVersionAndFormat = urlParts.slice(uploadIndex + 1).join('/');
		// Remove version prefix if present (e.g., v1234567890/)
		const publicIdWithFormat = publicIdWithPotentialVersionAndFormat.replace(/^v\d+\//, '');
		// The publicId now correctly includes the format (extension)
		const publicId = publicIdWithFormat;

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
export function getCloudinaryTransformedUrl(
	baseUrl: string | undefined | null,
	transformations: string
): string {
	if (!baseUrl) return ''; // Return empty string if no base URL

	// If the baseUrl is for a GIF or WebP, return it directly to bypass transformations
	const lowerBaseUrl = baseUrl.toLowerCase();
	if (lowerBaseUrl.endsWith('.gif') || lowerBaseUrl.endsWith('.webp')) {
		console.log(
			'[cloudinaryUtils] Bypassing transformations for GIF/WebP, serving raw URL:',
			baseUrl
		);
		return baseUrl;
	}

	// Check if using the placeholder
	if (
		!PUBLIC_CLOUDINARY_CLOUD_NAME ||
		PUBLIC_CLOUDINARY_CLOUD_NAME === 'your_cloud_name_placeholder'
	) {
		console.warn(
			'*** CLOUDINARY WARNING: Using placeholder cloud name. Define PUBLIC_CLOUDINARY_CLOUD_NAME in your environment and update cloudinaryUtils.ts. ***'
		);
		// Return original URL if env var is missing or using placeholder
		return baseUrl;
	}

	const { publicId, resourceType } = extractPublicIdAndResourceType(baseUrl);

	if (!publicId || !resourceType) {
		return baseUrl; // Return original URL if extraction failed
	}

	// If no transformations contain c_fill or c_crop, ensure we're using c_limit to preserve aspect ratio
	if (
		!transformations.includes('c_fill') &&
		!transformations.includes('c_crop') &&
		!transformations.includes('c_fit') &&
		!transformations.includes('c_limit')
	) {
		// Add c_limit to preserve aspect ratio if a width or height is specified
		if (transformations.includes('w_') || transformations.includes('h_')) {
			transformations = `c_limit,${transformations}`;
		}
	}

	// Construct the new URL
	// Note: We explicitly don't include the version here, letting Cloudinary handle caching via transformations.
	// The publicId used here will now correctly include its file extension.
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

/**
 * Sanitizes a string to be used as a Cloudinary public_id.
 * Replaces invalid characters and ensures the result is URL and Cloudinary-safe.
 */
export function sanitizeCloudinaryPublicId(input: string): string {
	if (!input) return '';

	return input
		.replace(/[^a-zA-Z0-9]/g, '_') // Replace any non-alphanumeric chars with underscore
		.replace(/_+/g, '_') // Replace multiple underscores with single underscore
		.replace(/^_|_$/g, '') // Remove leading/trailing underscores
		.toLowerCase(); // Convert to lowercase for consistency
}
