import fs from 'fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const EVENT_FOLDER_ID = process.env.EVENT_FOLDER_ID ?? '0';
const STAFF_FOLDER_ID = process.env.STAFF_FOLDER_ID ?? '0';
const TARGET_FOLDER = process.env.TARGET_FOLDER ?? './photos';
const BASE_URL = process.env.API_BASE_URL;
const API_TOKEN = process.env.API_TOKEN;
let IGNORE_EXISTING_FOLDERS = true;

const log = (log) => {
    console.log(`-----${'-'.repeat(log.length)}-----`);
    console.log(`-----${log}-----`);
    console.log(`-----${'-'.repeat(log.length)}-----`);
}

(async () => {
    const foldersResponse = await fetch(`${BASE_URL}/folders?limit=-1`,
        {
            headers: {
                Authorization: `Bearer ${API_TOKEN}`
            }
        }
    );

    if (!foldersResponse.ok) {
        throw new Error(`Failed to fetch folders: ${foldersResponse.statusText}`);
    }

    const folders = (await foldersResponse.json()).data;

    // Create a map of folders by their ID
    const folderMap = {};
    folders.forEach(folder => {
        folderMap[folder.id] = { ...folder, children: [] };
    });

    // Build the nested structure
    const nestedFolders = [];
    folders.forEach(folder => {
        if (folder.parent === null) {
            nestedFolders.push(folderMap[folder.id]);
        } else {
            folderMap[folder.parent].children.push(folderMap[folder.id]);
        }
    });

    const findFolder = (folders, id) => {
        for (const folder of folders) {
            if (folder.id === id) {
                return folder;
            }

            if (folder.children) {
                const result = findFolder(folder.children, id);
                if (result) {
                    return result;
                }
            }
        }

        return undefined;
    }

    const download = async (path, folders) => {
        for (const folder of folders) {
            // Check if folder exists
            const newPath = `${path}/${folder.name.replace(/T.{1,2}:.{1,2}:.{1,2}\..{1,3}Z/, '')}`;

            if (!fs.existsSync(newPath)) {
                console.log(`Creating folder ${newPath}`);
                fs.mkdirSync(newPath, { recursive: true });
            } else if (IGNORE_EXISTING_FOLDERS) {
                console.log(`Folder ${newPath} already exists`);

                // Recurse
                if (folder.children) {
                    await download(newPath, folder.children);
                }

                continue;
            }

            // Download photos
            const filesResponse = await fetch(`${BASE_URL}/files?limit=-1&filter[folder]=${folder.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${API_TOKEN}`
                    }
                }
            ).catch((err) => {
                console.error(`[ERROR] Failed to fetch files for ${folder.name}`, err);
            });

            if (!filesResponse.ok) {
                console.error(`[ERROR] Failed to fetch files for ${folder.name}: ${filesResponse.statusText}`);
                return;
            }

            const files = (await filesResponse.json()).data;
            console.log(`Found ${files.length} photos in folder ${folder.name}`);

            let workerIndex = 0;
            async function worker() {
                while (workerIndex < files.length) {
                    const file = files[workerIndex++];
                    const targetPath = `${newPath}/${file.filename_download}`;

                    if (fs.existsSync(targetPath)) {
                        // console.warn(`[WARN] Photo ${targetPath} already exists`);
                        continue;
                    }

                    try {
                        const stream = fs.createWriteStream(targetPath);
                        const response = await fetch(`${BASE_URL}/assets/${file.id}`);
                        await finished(Readable.fromWeb(response.body).pipe(stream));
                        console.log(`Downloaded photo ${targetPath}`);
                    } catch (err) {
                        console.error(`[ERROR] Failed to download ${file.filename_download}:`, err);
                    }
                }
            }

            await Promise.all(Array.from({ length: 4 }, worker));

            // Recurse
            if (folder.children) {
                let folderIndex = 0;
                async function folderWorker() {
                    while (folderIndex < folder.children.length) {
                        const child = folder.children[folderIndex++];
                        await download(newPath, [child]); // still runs image workers inside
                    }
                }

                await Promise.all(
                    Array.from({ length: 6 }, folderWorker)
                );
            }
        }
    }

    // Download all event photos
    log('Downloading Event Photos');
    const eventFolder = findFolder(nestedFolders, EVENT_FOLDER_ID);
    IGNORE_EXISTING_FOLDERS = false;
    await download(TARGET_FOLDER, [{ ...eventFolder, name: '' }]);
    log('Done Downloading Event Photos');

    // Download all staff photos
    log('Downloading Staff Photos');
    const staffFolder = findFolder(nestedFolders, STAFF_FOLDER_ID);
    IGNORE_EXISTING_FOLDERS = false;
    await download(TARGET_FOLDER, [{ ...staffFolder, name: 'staff' }]);
    log('Done Downloading Staff Photos');
})();