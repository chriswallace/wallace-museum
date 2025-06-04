// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

declare namespace App {
	interface Locals {
		user: {
			id: string;
			username: string;
			email: string;
			createdAt: Date;
			updatedAt: Date;
		} | null;
	}

	// interface PageData {}

	// interface Platform {}
}

export {};
