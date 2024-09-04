import axios from 'axios';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import { fileTypeFromBuffer } from 'file-type';
import imageKit from 'imagekit';

import { env } from '$env/dynamic/private';

const imagekit = new imageKit({
	publicKey: env.IMAGEKIT_PUBLIC_KEY,
	privateKey: env.IMAGEKIT_PRIVATE_KEY,
	urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
});

// Set the paths to the static binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

function createHashForString(string) {
	if (!string) {
		console.warn('createHashForString called with undefined or null name.');
		return '';
	}
	return crypto.createHash('sha256').update(string).digest('hex');
}

function extensionFromMimeType(mimeType) {
	switch (mimeType) {
		case 'image/jpeg':
			return '.jpg';
		case 'image/png':
			return '.png';
		case 'image/gif':
			return '.gif';
		case 'video/mp4':
			return '.mp4';
		default:
			console.error(`Unsupported MIME type for extension: ${mimeType}`);
			return '';
	}
}

function generateFileName(artwork, mimeType) {
	let baseName;
	if (artwork.contractAddr && artwork.tokenID) {
		baseName = `artwork-${artwork.contractAddr}-${artwork.tokenID}`;
	} else {
		baseName = artwork.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
	}

	const extension = extensionFromMimeType(mimeType);
	return `${baseName}${extension}`;
}

function generateTags(fileName, contractAddr, tokenID) {
	let tags = [];

	const fileHash = createHashForString(fileName);

	if (contractAddr && tokenID) {
		tags.push(`contractAddr:${contractAddr}`, `tokenID:${tokenID}`);
	}
	if (fileHash) {
		tags.push(`fileHash:${fileHash}`);
	}
	return tags.join(',');
}

function removeQueryString(url) {
	try {
		const parsedUrl = new URL(url);
		parsedUrl.search = ''; // Remove the query string
		return parsedUrl.toString();
	} catch (error) {
		console.error('Invalid URL:', url);
		return url; // Return the original URL if parsing fails
	}
}

export async function uploadToImageKit(fileStream, file, mimeType) {
	const tags = generateTags(fileStream);

	try {
		const searchResponse = await imagekit.listFiles({ tags });

		if (searchResponse.length > 0) {
			return {
				url: searchResponse[0].url,
				fileType: searchResponse[0].fileType,
				dimensions: { height: searchResponse[0].height, width: searchResponse[0].width }
			};
		}
	} catch (error) {
		console.error(`Error searching for existing file in ImageKit: ${error.message}`);
		return null;
	}

	try {
		const fileName = generateFileName(file, mimeType);
		const response = await imagekit.upload({
			file: fileStream,
			fileName,
			folder: 'compendium',
			tags
		});

		if (response && response.url) {
			return { url: response.url.split('?')[0], fileType: mimeType };
		} else {
			throw new Error('ImageKit upload failed with no response');
		}
	} catch (error) {
		console.error(`Error uploading to ImageKit: ${error.message}`);
		return null;
	}
}

export async function normalizeOpenSeaMetadata(nft) {
	const metadata = nft.metadata || {};

	return {
		name: metadata.name || nft.name,
		tokenID: metadata.tokenID || metadata.tokenId || nft.tokenID || nft.tokenId || nft.identifier,
		description: metadata.description || nft.description,
		artist: nft.creator || 'Unknown Artist',
		blockchain: 'Ethereum',
		image_url: metadata.image || nft.image_url || nft.display_image_url,
		animation_url: metadata.animation_url || nft.animation_url || nft.display_animation_url,
		tags: nft.tags || [],
		website: nft.website || metadata.external_url || '',
		attributes: metadata.attributes || nft.traits || []
	};
}

export async function normalizeTezosMetadata(nft) {
	const metadata = nft.metadata || {};
	const creator = nft.creators && nft.creators.length > 0 ? nft.creators[0] : {};

	return {
		name: metadata.name || nft.name || 'Unknown Name',
		tokenID: nft.tokenId || nft.tokenID || metadata.tokenId || metadata.tokenID || 'Unknown Token ID',
		description: metadata.description || nft.description || 'No Description Available',
		artist: {
			address: creator.creator_address || '',
			username: creator.holder?.alias || '',
			bio: creator.holder?.description || '',
			avatarUrl: creator.holder?.logo || '',
			website: creator.holder?.website || '',
			social_media_accounts: {
				twitter: creator.holder?.twitter || '',
				instagram: creator.holder?.instagram || ''
			},
		},
		platform: 'Tezos',
		mime: nft.mime || '',
		image_url: nft.image_url,
		animation_url: nft.animation_url,
		tags: metadata.tags || [],
		website: metadata.website || '',
		attributes: metadata.attributes || [],
		symbol: nft.symbol || '',
		supply: nft.supply || 1,
		collection: {
			name: nft.fa?.name || '',
			address: nft.fa?.contract || '',
			blockchain: 'Tezos',
		}
	};
}

export async function fetchWithRetry(url, retries = 3, delay = 1000) {
	for (let i = 0; i < retries; i++) {
		try {
			return await axios.get(url, {
				responseType: 'arraybuffer',
				timeout: 10000 // Timeout of 10 seconds
			});
		} catch (error) {
			if (i < retries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			} else {
				throw error;
			}
		}
	}
}

export function fixIpfsUrl(url) {
	if (url) {
		url = convertIpfsUriToHttpUrl(url);
	}
	return url;
}

function convertIpfsUriToHttpUrl(ipfsUri) {
	if (!ipfsUri) {
		return '';
	}
	const ipfsPrefix = 'ipfs://';
	if (ipfsUri.startsWith(ipfsPrefix)) {
		const ipfsHash = ipfsUri.slice(ipfsPrefix.length);
		return `https://ipfs.io/ipfs/${ipfsHash}`;
	}
	return ipfsUri;
}

export async function fetchMedia(uri) {
	try {
		const sanitizedUri = removeQueryString(uri);
		const httpUrl = convertIpfsUriToHttpUrl(sanitizedUri);
		const response = await axios.get(httpUrl, { responseType: 'arraybuffer' });
		const buffer = Buffer.from(response.data);

		const fileTypeResult = await fileTypeFromBuffer(buffer);
		if (!fileTypeResult) {
			console.error('Could not determine file type.');
			return null;
		}

		const mimeType = fileTypeResult.mime;

		// Only proceed if the mime type is a supported image or video format
		if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) {
			console.error(`Unsupported media type: ${mimeType}`);
			return null;
		}

		const fileName = path.basename(new URL(httpUrl).pathname) + '.' + fileTypeResult.ext;
		let dimensions = null;

		if (mimeType.startsWith('image/')) {
			try {
				const metadata = await sharp(buffer).metadata();
				dimensions = { width: metadata.width, height: metadata.height };
			} catch (sharpError) {
				console.error('Error processing image with sharp:', sharpError);
			}
		} else if (mimeType.startsWith('video/')) {
			dimensions = await getVideoDimensions(buffer);
		}

		return {
			buffer,
			mimeType,
			fileName,
			dimensions
		};
	} catch (error) {
		console.error('Error fetching media:', error);
		return null;
	}
}

async function getVideoDimensions(buffer) {
	const tmpFile = path.join('/tmp', `tmp_video_${Date.now()}.mp4`);
	await fs.writeFile(tmpFile, buffer);

	return new Promise((resolve, reject) => {
		ffmpeg.ffprobe(tmpFile, (err, metadata) => {
			fs.unlink(tmpFile); // Clean up the temp file
			if (err) {
				reject(`Error processing video with ffmpeg: ${err.message}`);
			} else {
				const stream = metadata.streams.find(s => s.width && s.height);
				if (stream) {
					resolve({ width: stream.width, height: stream.height });
				} else {
					resolve(null);
				}
			}
		});
	});
}

export async function handleMediaUpload(mediaUri, artwork) {
	const mediaData = await fetchMedia(mediaUri);
	if (!mediaData) {
		console.error(`Unsupported or unprocessable media at URI: ${mediaUri}`);
		return null;
	}

	let dimensions = mediaData.dimensions;
	if (!dimensions || dimensions.width === 0 || dimensions.height === 0) {
		console.warn(
			'Dimensions are missing or invalid, resizing might not correctly adjust dimensions.'
		);
		dimensions = { width: undefined, height: undefined };
	}

	try {
		const resizeResult = await resizeMedia(mediaData.buffer, mediaData.mimeType, dimensions);

		const resizedBuffer = resizeResult.buffer;
		const resizedDimensions = resizeResult.dimensions || dimensions;

		const uploadResult = await uploadToImageKit(resizedBuffer, artwork, mediaData.mimeType);

		return uploadResult
			? {
				url: uploadResult.url.split('?')[0],
				fileType: mediaData.mimeType,
				dimensions: resizedDimensions
			}
			: null;
	} catch (error) {
		console.error(`Failed to handle media upload for URI: ${mediaUri}`, error);
		return null;
	}
}

export async function resizeMedia(buffer, mimeType, dimensions, maxSizeMB = 25) {
	try {
		let sizeMB = Buffer.byteLength(buffer) / (1024 * 1024);
		let attempt = 0;
		let resizedBuffer = buffer;

		if (mimeType.startsWith('image/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);
				let newWidth = Math.floor(dimensions.width * scaleFactor);
				let newHeight = Math.floor(dimensions.height * scaleFactor);

				let image = sharp(resizedBuffer).resize(newWidth, newHeight, {
					fit: 'inside',
					withoutEnlargement: true
				});

				resizedBuffer = await image.toBuffer();
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
		} else if (mimeType.startsWith('video/')) {
			while (sizeMB > maxSizeMB && attempt < 10) {
				let scaleFactor = attempt === 0 ? 1 : Math.pow(0.9, attempt);
				let newWidth = Math.floor(dimensions.width * scaleFactor);
				let newHeight = Math.floor(dimensions.height * scaleFactor);

				resizedBuffer = await new Promise((resolve, reject) => {
					const tmpFile = path.join('/tmp', `tmp_video_${Date.now()}.mp4`);
					const outputTmpFile = path.join('/tmp', `tmp_video_resized_${Date.now()}.mp4`);

					fs.writeFile(tmpFile, resizedBuffer);

					ffmpeg(tmpFile)
						.size(`${newWidth}x${newHeight}`)
						.outputOptions('-preset', 'fast')
						.outputOptions('-crf', '28') // Adjust the quality here as needed
						.on('end', () => {
							const resized = fs.readFile(outputTmpFile);
							fs.unlink(tmpFile);
							fs.unlink(outputTmpFile);
							resolve(resized);
						})
						.on('error', (err) => {
							reject(`Error resizing video with ffmpeg: ${err.message}`);
						})
						.save(outputTmpFile);
				});
				sizeMB = Buffer.byteLength(resizedBuffer) / (1024 * 1024);
				attempt++;
			}
		}

		if (sizeMB > maxSizeMB) {
			console.warn('Unable to reduce file size below 25MB after several attempts.');
		}

		return { buffer: resizedBuffer, dimensions: { width: dimensions.width, height: dimensions.height } };
	} catch (error) {
		console.error('Error resizing media:', error);
		throw error;
	}
}