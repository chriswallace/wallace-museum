import { uploadToCloudinary } from './mediaHelpers';

export async function uploadAvatarImage(file: File): Promise<{ url: string }> {
	try {
		// Convert File to buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// Upload to Cloudinary with specific options for avatars
		const result = await uploadToCloudinary(
			buffer,
			`avatar_${Date.now()}`,
			file.type,
			'artist-avatars' // Tag for artist avatars
		);

		if (!result) {
			throw new Error('Failed to upload avatar to Cloudinary');
		}

		return { url: result.url };
	} catch (error) {
		console.error('Error uploading avatar:', error);
		throw new Error('Failed to upload avatar');
	}
}
