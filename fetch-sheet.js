import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { pdf } from 'pdf-to-img';
import sharp from 'sharp';
import { resolve } from 'path';

export async function downloadSheetAsPDF(url, fileName) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.status}`); 6

    try {
        const fileStream = createWriteStream(resolve(process.cwd(), `${fileName}.pdf`), { flags: 'w' });
        await finished(Readable.fromWeb(response.body).pipe(fileStream));
        console.log(`Saved sheet as ${fileName}.pdf`);
    } catch (error) {
        throw new Error(`Failed writing pdf to disk (${response.status}): ${error.message}`);
    }
}

export async function convertPDFtoImage(fileName) {
    let counter = 1;
    const document = await pdf(resolve(process.cwd(), `${fileName}.pdf`), { scale: 3 });
    for await (const image of document) {
        await fs.writeFile(`${fileName}_${counter}.png`, image);
        counter++;
    }
}

// mode: fit (scales down the image to the desired sizes as upper bounds, retains aspect ratio)
// mode: fill (scales down the image to the desired sizes as upper bounds, making sure the output resolution always matches the desired by adding black borders)
export async function autoCropImage(fileName, desiredHeight, desiredWidth, mode) {
    const imgFile = resolve(process.cwd(), `${fileName}_1.png`);

    let img = sharp(imgFile).trim({ threshold: 40 });

    if (mode === 'fit') {
        img = img.resize({
            width: desiredWidth,
            height: desiredHeight,
            fit: 'inside' // Ensures the image fits within the dimensions while keeping aspect ratio
        });
    } else if (mode === 'fill') {
        img = img.resize({
            width: desiredWidth,
            height: desiredHeight,
            fit: 'contain', // Ensures the image fits within the dimensions and adds black borders
            background: { r: 0, g: 0, b: 0 }
        });
    } else {
        throw new Error("Invalid mode. Use 'fit' or 'fill'.");
    }

    await img.jpeg().toFile(`${fileName}.jpg`);

    console.log(`Cropped image saved as ${fileName}.jpg`);
}
