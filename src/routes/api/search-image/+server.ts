import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const query = url.searchParams.get('q');

	if (!query) {
		return json({ error: 'No query provided' }, { status: 400 });
	}

	try {
		const wikimediaUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&format=json&origin=*`;

		const response = await fetch(wikimediaUrl);
		const data = await response.json();

		if (data.query?.search && data.query.search.length > 0) {
			// Get a random result
			const randomResult =
				data.query.search[Math.floor(Math.random() * Math.min(5, data.query.search.length))];
			const title = randomResult.title.replace('File:', '');

			// Construct Wikimedia image URL
			const imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}?width=800`;

			return json({ imageUrl });
		}

		// Fallback to placeholder with text
		return json({
			imageUrl: `https://placehold.co/800x600/6366f1/white?text=${encodeURIComponent(query)}`
		});
	} catch (error) {
		console.error('Image search error:', error);
		// Fallback
		return json({
			imageUrl: `https://placehold.co/800x600/6366f1/white?text=${encodeURIComponent(query || 'Image')}`
		});
	}
};
