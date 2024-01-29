import { env } from '$env/dynamic/private';
import imageKit from 'imagekit';
import { Readable } from 'stream';

const imagekit = new imageKit({
    publicKey: env.IMAGEKIT_PUBLIC_KEY,
    privateKey: env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
});

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function uploadToImageKit(fileStream, fileName) {
    try {
        const fileBuffer = await streamToBuffer(fileStream);

        const response = await imagekit.upload({
            file: fileBuffer,
            fileName: fileName,
        });

        console.log(response);

        if (response && response.url) {
            // Return an object with both URL and fileType
            return {
                url: response.url,
                fileType: response.fileType || 'image' // Default to 'image' if fileType is not provided
            };
        } else {
            throw new Error('Invalid response from ImageKit');
        }
    } catch (error) {
        console.error('Error uploading to ImageKit:', error);
        return null;
    }
}

export { uploadToImageKit };
