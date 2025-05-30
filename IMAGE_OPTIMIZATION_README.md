# Image Optimization Implementation

This document describes the image optimization implementation using the Wallace Museum IPFS reverse proxy with image transformation capabilities.

## Overview

The application now uses optimized image serving through the Wallace Museum IPFS reverse proxy at `https://ipfs.wallacemuseum.com`, which provides advanced image transformation capabilities including:

- **Format conversion** (WebP, AVIF, JPEG, PNG)
- **Responsive sizing** with automatic srcset generation
- **Quality optimization** (1-100 scale)
- **Fit modes** (cover, contain, crop, pad, scale-down)
- **Smart cropping** with gravity options
- **Retina support** (1x, 2x, 3x DPR)
- **Sharpening** and other enhancements

## Key Components

### 1. Image Optimization Utilities (`src/lib/imageOptimization.ts`)

Core functions for building optimized image URLs:

```typescript
import { buildOptimizedImageUrl, ImagePresets } from '$lib/imageOptimization';

// Basic optimization
const optimizedUrl = buildOptimizedImageUrl(imageUrl, {
	width: 400,
	format: 'webp',
	quality: 85,
	fit: 'cover'
});

// Using presets
const avatarUrl = ImagePresets.avatar.medium(imageUrl);
const thumbnailUrl = ImagePresets.thumbnail.large(imageUrl);
```

### 2. OptimizedImage Component (`src/lib/components/OptimizedImage.svelte`)

A drop-in replacement for `<img>` tags with built-in optimization:

```svelte
<OptimizedImage
	src={imageUrl}
	alt="Artwork title"
	width={800}
	responsive={true}
	responsiveSizes={[400, 800, 1200]}
	sizes="(max-width: 768px) 100vw, 80vw"
	fit="contain"
	format="webp"
	quality={90}
/>
```

### 3. Image Helper Utilities (`src/lib/utils/imageHelpers.ts`)

Convenience functions for common use cases:

```typescript
import { getOptimizedAvatarUrl, getOptimizedThumbnailUrl } from '$lib/utils/imageHelpers';

const avatarUrl = getOptimizedAvatarUrl(artist.avatarUrl, 'large');
const thumbnailUrl = getOptimizedThumbnailUrl(artwork.imageUrl, 'medium');
```

## Implementation Details

### Avatar Images

Avatars are optimized for different sizes with square cropping:

- **Small**: 32x32px
- **Medium**: 64x64px
- **Large**: 128x128px

All avatars use:

- WebP format
- 85% quality
- Cover fit mode for square cropping
- Fallback to placeholder on error

### Artwork Images

Artwork images maintain aspect ratio and support responsive loading:

- **Small**: 400px width
- **Medium**: 800px width
- **Large**: 1200px width
- **Fullscreen**: 1920px width

Configuration:

- WebP format
- 90% quality (95% for fullscreen)
- Contain fit mode to preserve aspect ratio
- Responsive srcset with multiple breakpoints

### Thumbnail Images

Grid and preview thumbnails use square cropping:

- **Small**: 200x200px
- **Medium**: 300x300px
- **Large**: 400x400px

Configuration:

- WebP format
- 80% quality
- Cover fit mode for consistent grid appearance

## Updated Components

The following components have been updated to use image optimization:

### Dashboard Components

1. **ArtistEditor** (`src/lib/components/ArtistEditor.svelte`)

   - Optimized avatar display (128x128px)
   - Optimized artwork thumbnails in grid (300x300px)

2. **Import Page** (`src/routes/(dashboard)/admin/import/+page.svelte`)

   - Optimized artwork thumbnails (300x300px)
   - Optimized artist avatars (20x20px)

3. **Artwork Edit Page** (`src/routes/(dashboard)/admin/artworks/edit/[id]/+page.svelte`)
   - Optimized artist avatars (32x32px)

### Frontend Components

1. **ArtworkDisplay** (`src/lib/components/ArtworkDisplay.svelte`)

   - Responsive artwork images with multiple sizes
   - Configurable quality based on display size

2. **Collection Page** (`src/routes/(app)/collection/[collectionSlug]/+page.svelte`)

   - Responsive artwork grid with optimized images
   - Proper srcset and sizes attributes

3. **Artist Page** (`src/routes/(app)/artist/[id]/+page.svelte`)

   - High-quality artwork display (up to 1600px)
   - Responsive sizing for different screen sizes

4. **Main App Page** (`src/routes/(app)/+page.svelte`)
   - Optimized preview images (320x220px)
   - Fast loading for hover interactions

## Performance Benefits

### Before Optimization

- Large IPFS images loaded at full resolution
- No format optimization (often PNG/JPEG)
- No responsive sizing
- Slower loading times
- Higher bandwidth usage

### After Optimization

- **Format Optimization**: WebP format reduces file sizes by 25-35%
- **Responsive Images**: Appropriate sizes for different screen sizes
- **Quality Optimization**: Balanced quality vs. file size
- **Smart Caching**: Optimized images are cached by the reverse proxy
- **Faster Loading**: Smaller file sizes and optimized delivery

## Usage Examples

### Basic Image Optimization

```svelte
<script>
	import OptimizedImage from '$lib/components/OptimizedImage.svelte';
</script>

<OptimizedImage src={artwork.imageUrl} alt={artwork.title} width={400} format="webp" quality={85} />
```

### Responsive Image with Multiple Sizes

```svelte
<OptimizedImage
	src={artwork.imageUrl}
	alt={artwork.title}
	responsive={true}
	responsiveSizes={[400, 800, 1200]}
	sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
	fit="contain"
	format="webp"
	quality={90}
/>
```

### Avatar with Fallback

```svelte
<OptimizedImage
	src={artist.avatarUrl}
	alt={artist.name}
	width={64}
	height={64}
	fit="cover"
	format="webp"
	quality={85}
	fallbackSrc="/images/default-avatar.png"
/>
```

### Using Presets

```svelte
<script>
	import { ImagePresets } from '$lib/imageOptimization';
</script>

<img src={ImagePresets.avatar.large(artist.avatarUrl)} alt={artist.name} />
<img src={ImagePresets.thumbnail.medium(artwork.imageUrl)} alt={artwork.title} />
```

## Configuration

The image optimization system uses the following endpoints:

- **Image API**: `https://ipfs.wallacemuseum.com/api/image`
- **Direct Access**: `https://ipfs.wallacemuseum.com/{cid}`

### Supported Parameters

- `width`, `height`: Dimensions in pixels
- `dpr`: Device pixel ratio (1, 2, 3)
- `fit`: Resize mode (scale-down, contain, cover, crop, pad)
- `gravity`: Focus point (auto, center, top, bottom, left, right)
- `quality`: Image quality (1-100)
- `format`: Output format (auto, webp, avif, jpeg, png)
- `animation`: Preserve animations (true/false)
- `sharpen`: Sharpening strength (0-10)
- `metadata`: Metadata handling (keep, copyright, none)

## Best Practices

1. **Use WebP format** for better compression
2. **Implement responsive images** with appropriate sizes
3. **Optimize quality settings** (60-85 for most use cases)
4. **Use appropriate fit modes** (cover for thumbnails, contain for artwork)
5. **Enable retina support** for high-DPI displays
6. **Provide fallback images** for error handling
7. **Use lazy loading** for images below the fold

## Monitoring and Debugging

The OptimizedImage component includes error handling and retry mechanisms:

- Automatic fallback to original IPFS URLs on optimization failure
- Visual retry buttons for failed images
- Console logging for debugging image loading issues

To debug image optimization:

1. Check browser Network tab for actual URLs being requested
2. Verify CID extraction from IPFS URLs
3. Test different optimization parameters
4. Monitor loading performance with browser dev tools
