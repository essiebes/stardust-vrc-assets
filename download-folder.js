const fs = require('node:fs');
const { Readable } = require('stream');
const { finished } = require('stream/promises');
const BASE_URL = 'https://clubs.essiebes.nl/stardust/api';
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
                // Authorization: `Bearer ${API_TOKEN}`
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
                        // Authorization: `Bearer ${API_TOKEN}`
                    }
                }
            );

            if (!filesResponse.ok) {
                throw new Error(`Failed to fetch files for ${folder.name}: ${filesResponse.statusText}`);
            }

            const files = (await filesResponse.json()).data;
            console.log(`Found ${files.length} photos in folder ${folder.name}`);

            for (const file of files) {
                if (fs.existsSync(`${newPath}/${file.filename_download}`)) {
                    console.log(`Photo ${newPath}/${file.filename_download} already exists`);
                    continue;
                }

                // Download photo
                const stream = fs.createWriteStream(`${newPath}/${file.filename_download}`);
                const response = await fetch(`${BASE_URL}/assets/${file.id}`);
                await finished(Readable.fromWeb(response.body).pipe(stream));
                console.log(`Downloaded photo ${newPath}/${file.filename_download}`);
            }

            // Recurse
            if (folder.children) {
                await download(newPath, folder.children);
            }
        }
    }

    // Download all event photos
    log('Downloading Event Photos');
    const eventFolder = findFolder(nestedFolders, '28c7ed52-d051-4c14-98ac-2db22948557c');
    IGNORE_EXISTING_FOLDERS = true;
    await download('./photos', [{ ...eventFolder, name: '' }]);
    log('Done Downloading Event Photos');

    // Download all staff photos
    log('Downloading Staff Photos');
    const staffFolder = findFolder(nestedFolders, 'd7056527-c01e-422b-a6cf-967369d9d76b');
    IGNORE_EXISTING_FOLDERS = false;
    await download('./photos', [{ ...staffFolder, name: 'staff' }]);
    log('Done Downloading Staff Photos');

})();