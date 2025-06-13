# Enhanced Video Player

A modern, accessible video player web component for the Wallace Collection app.

## Features

- **Advanced Custom Controls**: Beautiful, responsive controls with smooth animations
- **Accessibility**: Full ARIA support, keyboard navigation, and screen reader compatibility
- **Touch-Friendly**: Automatically adapts to touch devices with appropriate interactions
- **Keyboard Shortcuts**: Space/K (play/pause), M (mute), F (fullscreen), Arrow keys (seek/volume)
- **Customizable**: Theme colors, aspect ratios, and styling
- **Performance**: Intersection observer for auto-pause, efficient event handling
- **Responsive**: Works seamlessly across all device sizes

## Usage

### Basic Usage

```svelte
<script>
	import EnhancedVideoPlayer from '$lib/components/EnhancedVideoPlayer.svelte';
</script>

<EnhancedVideoPlayer
	src="path/to/video.mp4"
	title="Video Title"
	description="Video description"
	aspectRatio="16/9"
	themeColor="#3b82f6"
/>
```

### Props

| Prop          | Type      | Default          | Description                               |
| ------------- | --------- | ---------------- | ----------------------------------------- |
| `src`         | `string`  | **required**     | Video source URL                          |
| `poster`      | `string`  | `''`             | Poster image URL                          |
| `title`       | `string`  | `''`             | Video title (displayed in controls)       |
| `description` | `string`  | `''`             | Video description (displayed in controls) |
| `autoplay`    | `boolean` | `false`          | Auto-play video                           |
| `loop`        | `boolean` | `false`          | Loop video                                |
| `muted`       | `boolean` | `true`           | Start muted                               |
| `width`       | `number`  | `undefined`      | Video width                               |
| `height`      | `number`  | `undefined`      | Video height                              |
| `aspectRatio` | `string`  | `undefined`      | CSS aspect ratio (e.g., "16/9")           |
| `className`   | `string`  | `''`             | Additional CSS classes                    |
| `style`       | `string`  | `''`             | Additional inline styles                  |
| `themeColor`  | `string`  | `'currentColor'` | Theme color for controls                  |

### Events

The component dispatches standard video events:

- `loadeddata`
- `play`
- `pause`
- `ended`
- `error`

```svelte
<EnhancedVideoPlayer
	src="video.mp4"
	on:play={() => console.log('Video started playing')}
	on:pause={() => console.log('Video paused')}
/>
```

### Styling

The video player can be styled using CSS custom properties:

```css
video-player {
	--video-theme-color: #your-color;
	border-radius: 8px;
	overflow: hidden;
}
```

## Keyboard Shortcuts

- **Space** or **K**: Play/Pause
- **M**: Toggle mute
- **F**: Toggle fullscreen
- **Left Arrow**: Seek backward 5 seconds
- **Right Arrow**: Seek forward 5 seconds
- **Up Arrow**: Increase volume
- **Down Arrow**: Decrease volume

## Browser Support

- Modern browsers with Web Components support
- Graceful fallback for older browsers
- Touch device optimization

## Implementation Details

The component consists of:

1. **VideoPlayerWebComponent.js**: The core web component with all video player logic
2. **EnhancedVideoPlayer.svelte**: Svelte wrapper component for easy integration
3. Automatic device detection for touch vs. desktop experiences
4. Shadow DOM encapsulation for style isolation

## Migration from Old VideoPlayer

Replace existing VideoPlayer imports:

```svelte
<!-- Old -->
import VideoPlayer from '$lib/components/VideoPlayer.svelte'; import MobileVideoPlayer from '$lib/components/MobileVideoPlayer.svelte';

<!-- New -->
import EnhancedVideoPlayer from '$lib/components/EnhancedVideoPlayer.svelte';
```

The new component automatically handles mobile/desktop differences, so you no longer need separate components.
