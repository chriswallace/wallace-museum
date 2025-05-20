import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

// Re-using the Artwork interface, assuming it might be defined in a shared types file in a real app
// For now, let's define it here for simplicity, or ensure it can be imported if it lives elsewhere (e.g., from the page.ts)
interface Artwork {
	id: string;
	title: string;
	imageUrl: string;
	description?: string; // Added for potential use in details
	year?: number;
	artistId: string; // To associate artwork with an artist
	// Add other relevant artwork properties here
}

// Mock database of all artworks
const allArtworks: Artwork[] = [
	// Leonardo da Vinci
	{
		id: 'art1-1',
		artistId: '1',
		title: 'Mona Lisa',
		imageUrl: 'https://via.placeholder.com/800x600/09f/fff?text=Mona+Lisa',
		description: 'A famous portrait.',
		year: 1503
	},
	{
		id: 'art1-2',
		artistId: '1',
		title: 'The Last Supper',
		imageUrl: 'https://via.placeholder.com/800x600/09f/fff?text=Last+Supper',
		description: 'A mural painting.',
		year: 1498
	},
	{
		id: 'art1-3',
		artistId: '1',
		title: 'Vitruvian Man',
		imageUrl: 'https://via.placeholder.com/800x600/09f/fff?text=Vitruvian+Man',
		description: 'A drawing with notes.',
		year: 1490
	},
	// Vincent van Gogh
	{
		id: 'art2-1',
		artistId: '2',
		title: 'Starry Night',
		imageUrl: 'https://via.placeholder.com/800x600/f60/fff?text=Starry+Night',
		description: 'An oil on canvas painting.',
		year: 1889
	},
	{
		id: 'art2-2',
		artistId: '2',
		title: 'Sunflowers',
		imageUrl: 'https://via.placeholder.com/800x600/f60/fff?text=Sunflowers',
		description: 'Series of still life paintings.',
		year: 1888
	},
	{
		id: 'art2-3',
		artistId: '2',
		title: 'The Potato Eaters',
		imageUrl: 'https://via.placeholder.com/800x600/f60/fff?text=Potato+Eaters',
		description: 'An oil painting.',
		year: 1885
	},
	// Claude Monet
	{
		id: 'art3-1',
		artistId: '3',
		title: 'Impression, soleil levant',
		imageUrl: 'https://via.placeholder.com/800x600/0c0/fff?text=Impression',
		description: 'Painting that named Impressionism.',
		year: 1872
	},
	{
		id: 'art3-2',
		artistId: '3',
		title: 'Water Lilies series',
		imageUrl: 'https://via.placeholder.com/800x600/0c0/fff?text=Water+Lilies',
		description: 'Series of approximately 250 oil paintings.',
		year: 1926
	},
	{
		id: 'art3-3',
		artistId: '3',
		title: 'Rouen Cathedral series',
		imageUrl: 'https://via.placeholder.com/800x600/0c0/fff?text=Rouen+Cathedral',
		description: 'Painted at different times of day.',
		year: 1894
	}
	// Johannes Vermeer (no artworks in this mock data, to test empty state)
];

export const GET: RequestHandler = async ({ params }) => {
	const artistId = params.artistId;

	// In a real application, you would query your database for artworks by artistId
	const artworksForArtist = allArtworks.filter((artwork) => artwork.artistId === artistId);

	return json(artworksForArtist);
};
