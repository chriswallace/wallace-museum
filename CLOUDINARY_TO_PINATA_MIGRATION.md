# Cloudinary to Pinata Migration Guide

This document outlines the migration from Cloudinary to Pinata for all media file management in the Wallace Collection application.

## Overview

The application has been migrated from using Cloudinary for media storage and transformations to using Pinata for IPFS-based storage. This change provides:

- **Decentralized storage**: Files are stored on IPFS through Pinata
- **Better integration**: Native IPFS support for NFT metadata
- **Cost efficiency**: More predictable pricing model
- **Automatic cleanup**: Files are unpinned when artworks/artists are deleted

## Environment Variables

Update your `.env` file with the following Pinata configuration:

```env
# Pinata Configuration
PINATA_JWT=your_pinata_jwt_token_here
PINATA_GATEWAY=your-custom-gateway-subdomain  # Optional, defaults to gateway.pinata.cloud
PINATA_GROUP=your_pinata_group_id  # Optional, for organizing files

# Remove these Cloudinary variables (no longer needed)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

## Key Changes

### 1. Upload Functions

**Before (Cloudinary):**

```typescript
import { uploadToCloudinary } from '$lib/mediaHelpers';
const result = await uploadToCloudinary(buffer, fileName, mimeType, tags);
```

**After (Pinata):**

```typescript
import { uploadToPinata } from '$lib/pinataHelpers';
const result = await uploadToPinata(buffer, fileName, mimeType, metadata);
```

### 2. Image Transformations

**Before (Cloudinary):**

```typescript
import { getCloudinaryTransformedUrl } from '$lib/cloudinaryUtils';
const transformedUrl = getCloudinaryTransformedUrl(url, { width: 400, height: 400 });
```

**After (Pinata):**

```typescript
import { getPinataTransformedImageUrl, ImagePresets } from '$lib/pinataUtils';
const transformedUrl = getPinataTransformedImageUrl(url, { width: 400, height: 400 });
// Or use presets
const thumbnailUrl = ImagePresets.thumbnail(url);
```

### 3. File Cleanup

The application now automatically unpins files from Pinata when:

- Artworks are deleted
- Artists are deleted (including their avatars and associated artworks)
- Collections are removed

This is handled automatically by the deletion APIs.

## New Features

### 1. Pinata Transformations

If you have a custom Pinata gateway that supports transformations, you can use:

```typescript
import { getPinataTransformedUrl } from '$lib/pinataHelpers';

const optimizedUrl = getPinataTransformedUrl(cid, {
	width: 800,
	height: 600,
	quality: 85,
	format: 'webp',
	fit: 'cover'
});
```

### 2. Image Presets

Common transformation presets are available:

```typescript
import { ImagePresets } from '$lib/pinataUtils';

const thumbnailUrl = ImagePresets.thumbnail(imageUrl);
const mediumUrl = ImagePresets.medium(imageUrl);
const heroUrl = ImagePresets.hero(imageUrl);
```

### 3. Automatic File Management

Files are automatically:

- Uploaded to Pinata when creating artworks/artists
- Pinned with descriptive names for organization
- Unpinned when records are deleted to save storage costs

## Migration Steps

1. **Update Environment Variables**: Add Pinata configuration to your `.env` file
2. **Install Dependencies**: Ensure all Pinata-related dependencies are installed
3. **Test Uploads**: Verify that new uploads work correctly with Pinata
4. **Update Frontend**: Replace any Cloudinary transformation calls with Pinata equivalents
5. **Monitor**: Check that file cleanup works correctly when deleting records

## Backward Compatibility

The migration includes backward compatibility:

- `getCloudinaryTransformedUrl` function is still available but deprecated
- Existing Cloudinary URLs in the database will continue to work
- New uploads will use Pinata

## File Organization

Files in Pinata are organized with descriptive names:

- Artworks: `"Artwork Title - CID"`
- Avatars: `"avatar_timestamp"`
- Collections: Named after the collection

## Troubleshooting

### Common Issues

1. **Upload Failures**: Check that `PINATA_JWT` is correctly set
2. **Transformation Not Working**: Verify you have a custom gateway that supports transformations
3. **Files Not Unpinning**: Check console logs for unpinning errors during deletions

### Environment Setup

Ensure your Pinata account has:

- Valid JWT token with upload and delete permissions
- Sufficient storage quota
- Custom gateway configured (optional, for transformations)

## Performance Considerations

- IPFS files may take longer to load initially (cold start)
- Use transformations to optimize file sizes
- Consider implementing caching for frequently accessed files
- Monitor Pinata usage to stay within quotas

## Security

- Keep your `PINATA_JWT` secure and rotate regularly
- Use environment variables, never commit tokens to code
- Consider using Pinata groups to organize files by environment (dev/staging/prod)
