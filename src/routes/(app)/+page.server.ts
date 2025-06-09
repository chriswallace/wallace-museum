import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	// Homepage no longer needs to load artists data
	// The artwork feed component handles its own data loading
	return {};
};
