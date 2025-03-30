import { createWriteStream } from 'fs';
import { resolve } from 'path';
import { Readable } from 'stream';
import { finished } from 'stream/promises';

const API_TOKEN = process.env.API_TOKEN;
const BASE_URL = process.env.API_BASE_URL;

export async function fetchImage(endpoint, params, imageKey, outputPrefix) {
    const url = `${BASE_URL}${endpoint}?${params}`;
    console.log(`Fetching image data from: ${url}`);

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${API_TOKEN}` }
    });
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        console.error('No data found');
        return;
    }

    const imageId = data.data[0][imageKey];
    console.log(`${imageKey} ID: ${imageId}`);

    const photoUrl1024 = `${BASE_URL}/assets/${imageId}?key=vrchat-1024-16x9`;
    const photoUrl2048 = `${BASE_URL}/assets/${imageId}?key=vrchat-2048-16x9`;

    console.log(`${imageKey} URL (1024x1024): ${photoUrl1024}`);
    console.log(`${imageKey} URL (2048x2048): ${photoUrl2048}`);

    await downloadImage(photoUrl1024, `${outputPrefix}_x1024.webp`);
    await downloadImage(photoUrl2048, `${outputPrefix}_x2048.webp`);
    console.log(`Downloaded the latest ${imageKey} as ${outputPrefix}_x1024 and ${outputPrefix}_x2048`);
}

export async function downloadImage(url, fileName) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

    const fileStream = createWriteStream(resolve(process.cwd(), fileName), { flags: 'w' });
    await finished(Readable.fromWeb(response.body).pipe(fileStream));
}