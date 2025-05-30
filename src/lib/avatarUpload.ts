import { uploadToPinata } from './pinataHelpers';

export async function uploadAvatarImage(file: File): Promise<{ url: string }> {
	try {
		// Convert File to buffer
		const buffer = Buffer.from(await file.arrayBuffer());

		// Upload to Pinata with specific options for avatars
		const result = await uploadToPinata(
			buffer,
			`avatar_${Date.now()}`,
			file.type,
			{ category: 'artist-avatars' } // Metadata for artist avatars
		);

		if (!result) {
			throw new Error('Failed to upload avatar to Pinata');
		}

		return { url: result.url };
	} catch (error) {
		console.error('Error uploading avatar:', error);
		throw new Error('Failed to upload avatar');
	}
}
