// src/routes/index/+server.js
import { redirect } from '@sveltejs/kit';
import prisma from '$lib/prisma'; // Assuming you have a Prisma client set up

export async function load() {
	// Fetch collections from the database
	const collections = await prisma.collection.findMany({
		where: {
			enabled: true
		}
	});

	if (collections.length > 0) {
		// Select a random collection
		const randomCollection = collections[Math.floor(Math.random() * collections.length)];

		// Redirect to the random collection
		throw redirect(302, `/collection/${randomCollection.slug}`);
	} else {
		// Handle error or no collections case
		throw redirect(302, `/no-collections`);
	}
}
