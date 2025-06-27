import { goto } from '$app/navigation';

// Track navigation state to prevent race conditions
let isNavigating = false;
let navigationTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Navigate to a URL with debouncing to prevent rapid navigation clicks
 * @param url - The URL to navigate to
 * @param debounceMs - Debounce time in milliseconds (default: 300ms)
 * @returns Promise that resolves when navigation is complete
 */
export async function navigateWithDebounce(url: string, debounceMs: number = 300): Promise<void> {
	// If already navigating, ignore this request
	if (isNavigating) {
		console.log(`[NavigationHelper] Ignoring navigation to ${url} - already navigating`);
		return;
	}

	// Clear any existing timeout
	if (navigationTimeout) {
		clearTimeout(navigationTimeout);
	}

	// Set navigation state
	isNavigating = true;

	try {
		// Navigate immediately
		await goto(url);
		
		// Set a timeout to reset navigation state
		navigationTimeout = setTimeout(() => {
			isNavigating = false;
			navigationTimeout = null;
		}, debounceMs);
		
	} catch (error) {
		console.error(`[NavigationHelper] Navigation failed:`, error);
		isNavigating = false;
		if (navigationTimeout) {
			clearTimeout(navigationTimeout);
			navigationTimeout = null;
		}
		throw error;
	}
}

/**
 * Reset navigation state (useful for cleanup)
 */
export function resetNavigationState(): void {
	isNavigating = false;
	if (navigationTimeout) {
		clearTimeout(navigationTimeout);
		navigationTimeout = null;
	}
}

/**
 * Check if currently navigating
 */
export function getNavigationState(): boolean {
	return isNavigating;
} 