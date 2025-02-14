const fs = require('node:fs');

// Auth token
const token = process.env.TOKEN;
const results = [];

const members = JSON.parse(fs.readFileSync('members.json'));

const findMemberName = (id) => {
    const res = members.members.find(member => Number.parseInt(member.member.user.id) === id);
    if (res) {
        return res.member.user.username;
    } else {
        return null;
    }
}

const arrayOfObjectsToCSV = (dataArray, headers, delimiter = ',') => {
    if (!Array.isArray(dataArray) || dataArray.length === 0 || !Array.isArray(headers) || headers.length === 0) {
        return '';
    }

    // Escape data for CSV (quotes and commas)
    const escapeValue = (value) => {
        if (typeof value === 'string') {
            // Escape double quotes by doubling them
            value = value.replace(/"/g, '""');
            // Wrap in quotes if it contains the delimiter, quotes, or newlines
            if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
                return `"${value}"`;
            }
        }
        return value;
    };

    // Create the CSV header row
    const csvRows = [];
    csvRows.push(headers.join(delimiter));

    // Map each object to a row based on the header order
    dataArray.forEach((obj) => {
        const row = headers.map(header => escapeValue(obj[header] !== undefined ? obj[header] : ''));
        csvRows.push(row.join(delimiter));
    });

    // Join all rows with newlines
    return csvRows.join('\n');
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchLogs = async () => {
    // POST https://api.ticketsbot.net/api/1200006024313192448/transcripts 
    const request = {
        page: 0,
        rating: "0"
    }

    const result = [];
    while (true) {
        console.log(`Fetching tickets page: ${request.page}`);
        const res = await fetch("https://api.ticketsbot.net/api/1200006024313192448/transcripts", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `${token}`,
                'x-tickets': 'true',
                'Host': 'api.ticketsbot.net',
                'Origin': 'https://dashboard.ticketsbot.net',
                'Referer': 'https://dashboard.ticketsbot.net',
                'TE': 'trailers',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.128 Safari/537.3',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            body: JSON.stringify(request)
        });

        if (res.ok) {
            const data = await res.json();
            if (data.length === 0) {
                console.log("No more tickets found.");
                break;
            }
            result.push(...data);
            request.page += 1;
            await sleep(250); // Wait for 500ms before making the next request to avoid hitting rate limits
        } else if (res.status === 429) {
            console.log("Rate limit reached. Waiting for 60 seconds before retrying...");
            await sleep(60000); // Wait for 1 minute before retrying
        } else {
            console.error("Error:", res.statusText);
            break;
        }
    }

    console.log(result.length, "ticket logs fetched");
    console.log(JSON.stringify(result));
    return result;
}

(async () => {
    if (fs.existsSync('ticket_logs.json')) {
        console.log("File already exists. Skipping fetch.");
        results.push(...(JSON.parse(fs.readFileSync('ticket_logs.json'))));
    } else {
        console.log("File does not exist. Fetching logs...");
        results.push(await fetchLogs());
    }


    // Write results to a json file
    fs.writeFileSync('ticket_logs.json', JSON.stringify(results));

    // Write resutls to a csv file
    const csv = results.map(r => ({
        ticket_id: r.ticket_id,
        username: r.username,
        close_reason: r.close_reason,
        closed_by_name: findMemberName(r.closed_by),
        closed_by: r.closed_by,
        rating: r.rating,
        has_transcript: r.has_transcript
    }));

    const headers = Object.keys(csv[0]);
    const csvData = arrayOfObjectsToCSV(csv, headers);
    fs.writeFileSync('ticket_logs.csv', csvData);
})();
