import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET() {
	const imagesDir = path.join(process.cwd(), 'static', 'images');

	try {
		const files = fs
			.readdirSync(imagesDir)
			.filter((file) => file.endsWith('.png'))
			.map((file) => `/images/${file}`);

		return json(files);
	} catch (error) {
		return json([]);
	}
}
