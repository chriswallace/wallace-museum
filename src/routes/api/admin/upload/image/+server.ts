import { json } from '@sveltejs/kit';
import { uploadToCloudinary } from '$lib/mediaHelpers'; // Keep helper here for now, but ensure IT doesn't import $env

// Ensure mediaHelpers doesn't ALSO import $env/dynamic/private
// Ideally, pass credentials from here if needed

export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('imageFile') as File; // Use 'imageFile' as the key

		if (!file || !file.name || !file.type) {
			return json({ error: 'Invalid file uploaded' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());

		// Call the updated upload function
		const uploadResponse = await uploadToCloudinary(buffer, file.name, file.type);

		if (uploadResponse && uploadResponse.url) {
			return json({ url: uploadResponse.url }, { status: 200 });
		} else {
			console.error('Cloudinary upload failed or returned invalid response:', uploadResponse);
			return json({ error: 'Image upload failed on server' }, { status: 500 });
		}
	} catch (error) {
		console.error('Error in image upload endpoint:', error);
		const message = error instanceof Error ? error.message : 'Unknown error';
		return json({ error: 'Server error during image upload', details: message }, { status: 500 });
	}
}
