# Skeleton Loading with Proper Dimensions

This document describes the enhanced skeleton loading implementation that displays skeleton loaders with the exact same dimensions as the images that will eventually replace them.

## Overview

The skeleton loading system has been enhanced to provide a seamless loading experience by:

- **Matching exact dimensions**: Skeleton loaders use the same width, height, and aspect ratio as the final images
- **Preserving layout**: No layout shifts when images load
- **Responsive design**: Skeleton loaders adapt to different screen sizes just like the images
- **Smooth transitions**: Images fade in seamlessly when loaded

## Components

### 1. Enhanced OptimizedImage Component

The `OptimizedImage` component now includes built-in skeleton loading functionality.

#### Basic Usage

```svelte
<OptimizedImage
	src={imageUrl}
	alt="Artwork title"
	width={400}
	height={300}
	aspectRatio="4/3"
	showSkeleton={true}
	skeletonBorderRadius="8px"
/>
```

#### New Props

- `showSkeleton: boolean = true` - Whether to show skeleton loader while loading
- `skeletonBorderRadius: string = '4px'` - Border radius for the skeleton loader
- `aspectRatio: string | undefined` - Explicit aspect ratio (e.g., "16/9", "1/1")

#### Automatic Dimension Calculation

The component automatically calculates skeleton dimensions:

```svelte
<!-- Using width and height -->
<OptimizedImage src={imageUrl} width={400} height={300} showSkeleton={true} />

<!-- Using aspect ratio -->
<OptimizedImage src={imageUrl} width={400} aspectRatio="3/2" showSkeleton={true} />

<!-- Using artwork dimensions -->
<OptimizedImage
	src={artwork.imageUrl}
	width={400}
	aspectRatio={artwork.dimensions
		? `${artwork.dimensions.width}/${artwork.dimensions.height}`
		: '1/1'}
	showSkeleton={true}
/>
```

### 2. ArtworkGrid Component

A grid component that displays artworks with skeleton loading.

```svelte
<script>
	import ArtworkGrid from '$lib/components/ArtworkGrid.svelte';

	let artworks = []; // Will be populated when data loads
</script>

<ArtworkGrid
	{artworks}
	columns={3}
	gap="1.5rem"
	imageSize="medium"
	showSkeletonCount={12}
	onArtworkClick={handleClick}
/>
```

#### Props

- `artworks: Artwork[]` - Array of artwork objects
- `columns: number = 3` - Number of grid columns
- `gap: string = '1rem'` - Gap between grid items
- `imageSize: 'small' | 'medium' | 'large' = 'medium'` - Image size preset
- `showSkeletonCount: number = 12` - Number of skeleton items when loading
- `onArtworkClick: (artwork) => void` - Click handler

### 3. ArtworkMasonryGrid Component

A masonry grid that preserves original artwork aspect ratios.

```svelte
<script>
	import ArtworkMasonryGrid from '$lib/components/ArtworkMasonryGrid.svelte';
</script>

<ArtworkMasonryGrid
	{artworks}
	columns={3}
	gap={24}
	imageWidth={300}
	showSkeletonCount={12}
	onArtworkClick={handleClick}
/>
```

#### Props

- `artworks: Artwork[]` - Array of artwork objects
- `columns: number = 3` - Number of columns
- `gap: number = 16` - Gap in pixels
- `imageWidth: number = 300` - Fixed width for all images
- `showSkeletonCount: number = 12` - Number of skeleton items
- `onArtworkClick: (artwork) => void` - Click handler

## Usage Examples

### 1. Basic Image with Skeleton

```svelte
<OptimizedImage
	src={artwork.imageUrl}
	alt={artwork.title}
	width={400}
	height={300}
	showSkeleton={true}
	skeletonBorderRadius="8px"
/>
```

### 2. Responsive Image with Aspect Ratio

```svelte
<OptimizedImage
	src={artwork.imageUrl}
	alt={artwork.title}
	width={800}
	aspectRatio={artwork.dimensions
		? `${artwork.dimensions.width}/${artwork.dimensions.height}`
		: '16/9'}
	responsive={true}
	responsiveSizes={[400, 800, 1200]}
	sizes="(max-width: 768px) 100vw, 50vw"
	showSkeleton={true}
	skeletonBorderRadius="12px"
/>
```

### 3. Avatar with Circular Skeleton

```svelte
<OptimizedImage
	src={artist.avatarUrl}
	alt={artist.name}
	width={64}
	height={64}
	fit="cover"
	aspectRatio="1/1"
	showSkeleton={true}
	skeletonBorderRadius="50%"
	className="rounded-full"
/>
```

### 4. Grid with Loading State

```svelte
<script>
	import { onMount } from 'svelte';
	import ArtworkGrid from '$lib/components/ArtworkGrid.svelte';

	let artworks = [];
	let loading = true;

	onMount(async () => {
		const response = await fetch('/api/artworks');
		artworks = await response.json();
		loading = false;
	});
</script>

<ArtworkGrid
	artworks={loading ? [] : artworks}
	columns={3}
	imageSize="medium"
	showSkeletonCount={9}
/>
```

### 5. Masonry Grid with Varied Dimensions

```svelte
<script>
	// Artworks with different dimensions
	const artworks = [
		{
			id: 1,
			title: 'Portrait',
			imageUrl: '...',
			dimensions: { width: 400, height: 600 } // 2:3 ratio
		},
		{
			id: 2,
			title: 'Landscape',
			imageUrl: '...',
			dimensions: { width: 800, height: 400 } // 2:1 ratio
		},
		{
			id: 3,
			title: 'Square',
			imageUrl: '...',
			dimensions: { width: 500, height: 500 } // 1:1 ratio
		}
	];
</script>

<ArtworkMasonryGrid {artworks} columns={3} imageWidth={300} showSkeletonCount={6} />
```

## Advanced Features

### 1. Custom Skeleton Shapes

```svelte
<!-- Rounded rectangle -->
<OptimizedImage src={imageUrl} skeletonBorderRadius="12px" showSkeleton={true} />

<!-- Circle -->
<OptimizedImage src={avatarUrl} skeletonBorderRadius="50%" showSkeleton={true} />

<!-- Sharp corners -->
<OptimizedImage src={imageUrl} skeletonBorderRadius="0" showSkeleton={true} />
```

### 2. Conditional Skeleton Loading

```svelte
<script>
	let imageLoaded = false;
	let showSkeleton = true;

	function handleImageLoad() {
		imageLoaded = true;
		showSkeleton = false;
	}
</script>

<OptimizedImage src={imageUrl} {showSkeleton} on:load={handleImageLoad} />
```

### 3. Integration with Existing Components

Update existing `ArtworkDisplay` components:

```svelte
<!-- Before -->
<ArtworkDisplay {artwork} showLoader={true} />

<!-- After - now uses built-in skeleton loading -->
<ArtworkDisplay {artwork} showLoader={true} />
```

## Best Practices

### 1. Always Provide Aspect Ratios

```svelte
<!-- Good: Explicit aspect ratio -->
<OptimizedImage
	src={artwork.imageUrl}
	aspectRatio={artwork.dimensions
		? `${artwork.dimensions.width}/${artwork.dimensions.height}`
		: '1/1'}
	showSkeleton={true}
/>

<!-- Avoid: No aspect ratio information -->
<OptimizedImage src={artwork.imageUrl} showSkeleton={true} />
```

### 2. Use Appropriate Skeleton Counts

```svelte
<!-- For mobile: fewer skeletons -->
<ArtworkGrid showSkeletonCount={6} columns={2} />

<!-- For desktop: more skeletons -->
<ArtworkGrid showSkeletonCount={12} columns={4} />
```

### 3. Match Border Radius to Design

```svelte
<!-- Card with rounded corners -->
<div class="rounded-lg overflow-hidden">
	<OptimizedImage src={imageUrl} skeletonBorderRadius="8px" showSkeleton={true} />
</div>

<!-- Circular avatar -->
<OptimizedImage
	src={avatarUrl}
	skeletonBorderRadius="50%"
	className="rounded-full"
	showSkeleton={true}
/>
```

### 4. Handle Different Loading States

```svelte
<script>
	let artworks = [];
	let loading = true;
	let error = null;

	onMount(async () => {
		try {
			const response = await fetch('/api/artworks');
			if (!response.ok) throw new Error('Failed to load');
			artworks = await response.json();
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

{#if error}
	<div class="error">Failed to load artworks: {error}</div>
{:else}
	<ArtworkGrid artworks={loading ? [] : artworks} showSkeletonCount={loading ? 12 : 0} />
{/if}
```

## Performance Considerations

1. **Skeleton Count**: Don't show too many skeleton items on mobile devices
2. **Animation**: The shimmer animation is optimized for performance
3. **Memory**: Skeleton loaders are lightweight and don't load actual images
4. **Responsive**: Skeleton loaders adapt to screen size changes

## Browser Support

- **Modern browsers**: Full support with CSS aspect-ratio
- **Older browsers**: Graceful fallback using padding-based aspect ratios
- **Mobile**: Optimized for touch devices and smaller screens

## Demo

Visit `/skeleton-demo` to see the skeleton loading functionality in action with:

- Different image dimensions and aspect ratios
- Grid and masonry layouts
- Interactive controls to toggle between skeleton and loaded states
- Responsive behavior across different screen sizes

## Migration Guide

### From LoaderWrapper to OptimizedImage

```svelte
<!-- Before -->
{#if loading}
	<LoaderWrapper width="100%" height="100%" aspectRatio="16/9" />
{/if}
<img src={imageUrl} alt="..." class:hidden={loading} />

<!-- After -->
<OptimizedImage src={loading ? '' : imageUrl} alt="..." aspectRatio="16/9" showSkeleton={true} />
```

### From Manual Skeleton to ArtworkGrid

```svelte
<!-- Before -->
{#if loading}
	{#each Array(12) as _}
		<div class="skeleton-item">
			<SkeletonLoader />
		</div>
	{/each}
{:else}
	{#each artworks as artwork}
		<div class="artwork-item">
			<img src={artwork.imageUrl} alt={artwork.title} />
		</div>
	{/each}
{/if}

<!-- After -->
<ArtworkGrid artworks={loading ? [] : artworks} showSkeletonCount={12} />
```

This enhanced skeleton loading system provides a much better user experience by eliminating layout shifts and providing visual feedback that matches the final content dimensions.

# Skeleton Loading Implementation

This document describes the skeleton loading implementation for the Wallace Museum application, providing smooth loading experiences across all image components.

## Overview

The application uses skeleton loaders to prevent layout shifts and provide visual feedback while images are loading. The skeleton loaders are implemented using the `OptimizedImage` component and `SkeletonLoader` component.

## Key Features

### Artwork Dimensions Support

**NEW**: Skeleton loaders now use actual artwork dimensions from the database to display accurate aspect ratios before images load. This prevents layout shifts and provides a more realistic preview of the final image.

- **Data Source**: Artwork dimensions are stored in the `dimensions` field as JSON: `{ width: number, height: number }`
- **Automatic Calculation**: The `aspectRatio` prop is automatically calculated from artwork dimensions
- **Fallback**: If dimensions are not available, defaults to `1/1` (square) aspect ratio
- **Real-time**: Skeleton loaders appear instantly with correct proportions during hydration

#### Implementation Example

```svelte
<OptimizedImage
	src={artwork.image_url}
	alt={artwork.title}
	aspectRatio={artwork.dimensions
		? `${artwork.dimensions.width}/${artwork.dimensions.height}`
		: '1/1'}
	showSkeleton={true}
	responsive={true}
	responsiveSizes={[400, 800, 1200]}
	fit="contain"
	format="webp"
	quality={90}
/>
```

### Components with Dimensions Support

1. **Collection Page** (`src/routes/(app)/collection/[collectionSlug]/+page.svelte`)

   - Uses actual artwork dimensions for skeleton loaders
   - Maintains aspect ratio during loading

2. **Artist Page** (`src/routes/(app)/artist/[id]/+page.svelte`)

   - High-quality artwork display with proper dimensions
   - Skeleton loaders match final image proportions

3. **ArtworkDisplay Component** (`src/lib/components/ArtworkDisplay.svelte`)

   - Supports all artwork types (images, videos, iframes)
   - Calculates aspect ratio from dimensions

4. **ArtworkGrid Component** (`src/lib/components/ArtworkGrid.svelte`)

   - Grid layout with proper aspect ratios
   - Skeleton items use varied realistic proportions

5. **ArtworkMasonryGrid Component** (`src/lib/components/ArtworkMasonryGrid.svelte`)

   - Masonry layout preserving artwork proportions
   - Pre-calculated heights based on dimensions

6. **Import Page** (`src/routes/(dashboard)/admin/import/+page.svelte`)
   - Thumbnail previews with correct aspect ratios
   - Both grid and table views supported

## Core Components

### OptimizedImage Component

The `OptimizedImage` component (`src/lib/components/OptimizedImage.svelte`) is the foundation of the skeleton loading system:

**Key Props:**

- `src`: Image source URL
- `aspectRatio`: CSS aspect ratio (e.g., "16/9", "4/3", "1/1")
- `showSkeleton`: Enable/disable skeleton loader (default: true)
- `skeletonBorderRadius`: Border radius for skeleton (default: "4px")
- `width`, `height`: Optional explicit dimensions
- `responsive`: Enable responsive image loading
- `quality`, `format`, `fit`: Image optimization options

**Skeleton Logic:**

```javascript
// Show skeleton when:
// 1. showSkeleton is enabled AND
// 2. Either no image source OR image hasn't loaded yet
$: shouldShowSkeleton = showSkeleton && (!shouldShowImage || !isLoaded);
```

### SkeletonLoader Component

The `SkeletonLoader` component (`src/lib/components/SkeletonLoader.svelte`) provides the animated skeleton effect:

**Features:**

- Smooth shimmer animation
- Configurable dimensions and border radius
- Accessible (respects `prefers-reduced-motion`)
- Lightweight CSS-only implementation

## Usage Patterns

### Basic Image with Skeleton

```svelte
<OptimizedImage src={imageUrl} alt="Description" width={400} height={300} showSkeleton={true} />
```

### Responsive Image with Artwork Dimensions

```svelte
<OptimizedImage
	src={artwork.imageUrl}
	alt={artwork.title}
	aspectRatio={artwork.dimensions
		? `${artwork.dimensions.width}/${artwork.dimensions.height}`
		: '1/1'}
	responsive={true}
	responsiveSizes={[400, 800, 1200]}
	sizes="(max-width: 768px) 100vw, 50vw"
	showSkeleton={true}
/>
```

### Grid Layout with Varied Skeletons

```svelte
{#each artworks as artwork}
	<div style="aspect-ratio: {getAspectRatio(artwork)};">
		<OptimizedImage
			src={artwork.imageUrl}
			alt={artwork.title}
			aspectRatio={getAspectRatio(artwork)}
			showSkeleton={true}
		/>
	</div>
{/each}
```

## Performance Benefits

### Before Implementation

- Layout shifts when images loaded
- Empty spaces during loading
- Inconsistent loading experience
- No visual feedback for slow connections

### After Implementation

- **Zero layout shift**: Skeleton maintains exact final dimensions
- **Instant feedback**: Skeleton appears immediately
- **Realistic preview**: Actual artwork proportions shown
- **Smooth transitions**: Fade from skeleton to image
- **Improved UX**: Users see content structure immediately

## Accessibility

The skeleton loading system is designed with accessibility in mind:

- **Reduced Motion**: Respects `prefers-reduced-motion` setting
- **Screen Readers**: Skeleton elements are properly hidden from assistive technology
- **Focus Management**: Maintains proper focus states during loading
- **Color Contrast**: Skeleton colors meet accessibility standards

## Browser Support

- **Modern Browsers**: Full support with CSS aspect-ratio
- **Legacy Browsers**: Graceful fallback using padding-based aspect ratios
- **Mobile**: Optimized for touch devices and varying screen sizes

## Demo and Testing

Visit `/skeleton-demo` to see the skeleton loading system in action:

- Toggle skeleton visibility
- Test different aspect ratios
- Compare grid vs masonry layouts
- Simulate slow loading conditions

## Technical Implementation

### Data Flow

1. **Server**: Artwork dimensions loaded from database
2. **Hydration**: Dimensions available immediately on client
3. **Skeleton**: Displays with correct aspect ratio instantly
4. **Image Load**: Skeleton fades out when image is ready
5. **Transition**: Smooth fade from skeleton to final image

### CSS Aspect Ratio

```css
.skeleton-wrapper {
	aspect-ratio: var(--aspect-ratio);
	position: relative;
	width: 100%;
}
```

### Responsive Behavior

The skeleton loaders work seamlessly with responsive images:

- Maintain aspect ratio at all screen sizes
- Support multiple breakpoints
- Optimize for different device pixel ratios
- Handle orientation changes gracefully

## Future Enhancements

- **Blur Hash**: Add blur hash support for even better previews
- **Progressive Loading**: Implement progressive JPEG support
- **Smart Preloading**: Preload images based on viewport proximity
- **Performance Metrics**: Add loading performance tracking
