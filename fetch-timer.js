
import { fetchImage } from './fetch-asset.js';
import { mkdir, rm } from 'fs/promises';
import { autoCropImage, convertPDFtoImage, downloadSheetAsPDF } from './fetch-sheet.js';
import { resolve } from 'path';

// Extracted values from your URL
const SHEET_ID = process.env.SHEET_ID ?? "";
const SHEET_GID = process.env.SHEET_GID ?? "";
const SHEET_RANGE = process.env.SHEET_RANGE ?? "B2:H45";
const SHEET_MODE = process.env.SHEET_MODE ?? 'fit';

// Google Sheets PDF Export URL
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=pdf&gid=${SHEET_GID}
&size=a3
&range=${SHEET_RANGE}
&portrait=false
&fitw=true
&top_margin=0.1
&bottom_margin=0.1
&left_margin=0.1
&right_margin=0.1
&gridlines=false
&printtitle=false
&sheetnames=false`;

const fetchEventSheet = async () => {
    const sheetFile = 'dist/event_sheet';
    await downloadSheetAsPDF(SHEET_URL, sheetFile);
    await convertPDFtoImage(sheetFile);
    if (SHEET_MODE === 'fill') {
        await autoCropImage(sheetFile, 1152, 2048, SHEET_MODE);
    } else {
        await autoCropImage(sheetFile, 2048, 2048, SHEET_MODE);
    }

    await rm(`${sheetFile}.pdf`);
    await rm(`${sheetFile}_1.png`);
}

const fetchCalendar = async () => {
    // Fetch calendar image
    return await fetchImage(
        '/items/event_schedules',
        'filter%5Beffective_from%5D%5B_lte%5D=%24NOW()&filter%5Bstatus%5D%5B_eq%5D=published&fields=id,status,effective_from,calendar_picture&sort=-effective_from&limit=1',
        'calendar_picture',
        'dist/latest_calendar'
    );
}

const fetchGroupPhoto = async () => {
    // Fetch group photo
    return await fetchImage(
        '/items/Event',
        'filter%5Bstatus%5D%5B_eq%5D=published&filter%5Bstart_date%5D%5B_lte%5D=%24NOW()&filter%5Bgroup_photo%5D%5B_nnull%5D=true&fields%5B%5D=id,start_date,group_photo&sort=-start_date&limit=1',
        'group_photo',
        'dist/latest_group_photo'
    );
}

// Run the function
(async () => {
    console.log('Starting to retrieve event details: ' + process.cwd());
    await mkdir(resolve(process.cwd(), 'dist/'), { recursive: true });
    await Promise.all([
        fetchEventSheet(),
        fetchCalendar(),
        fetchGroupPhoto(),
    ]);
    console.log('Finished retrieving all event details');
})();