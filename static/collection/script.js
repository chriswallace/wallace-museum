import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

async function readJSONFile(filePath) {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
}

async function generateUIDsForArtworks() {
    let allArtworks = [];

    // Assuming you have 10 JSON files named chunk0.json, chunk1.json, ..., chunk9.json
    for (let i = 0; i < 8; i++) {
        const filePath = `chunk${i}.json`; // Update the path as per your directory structure
        const artworks = await readJSONFile(filePath);

        artworks.forEach(artwork => {
            artwork.uid = uuidv4(); // Assign a unique ID
            allArtworks.push(artwork);
        });
    }

    // Save the combined data to a new file
    await fs.writeFile('combined_artworks.json', JSON.stringify(allArtworks, null, 2));
}

generateUIDsForArtworks().catch(console.error);