import { json } from '@sveltejs/kit';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET() {
	try {
		const imagesDir = join(process.cwd(), 'static', 'images');
		const files = await readdir(imagesDir);

		// Filter only PNG files and create full paths
		const imageFiles = files
			.filter((file) => file.toLowerCase().endsWith('.png'))
			.map((file) => `/images/${file}`);

		return json(imageFiles);
	} catch (error) {
		console.error('Error reading images directory:', error);
		return json([], { status: 500 });
	}
}
