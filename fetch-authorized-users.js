const fs = require('node:fs');
const BASE_URL = 'https://clubs.essiebes.nl/stardust/api';
const API_TOKEN = process.env.API_TOKEN;

(async () => {
    const linksResponse = await fetch(`${BASE_URL}/items/vrchat_links?fields=discord_id,vrchat_name,booster&limit-1&filter[status][_eq]=published`,
        {
            headers: {
                Authorization: `Bearer ${API_TOKEN}`
            }
        }
    );

    if (!linksResponse.ok) {
        throw new Error(`Failed to fetch VRChat links: ${linksResponse.statusText}`);
    }

    const links = await linksResponse.json();

    const discordIds = links.data.map(link => link.discord_id);

    const staffResponse = await fetch(`${BASE_URL}/items/staff?fields=roles,discord_id,name&limit=-1&filter[discord_id][_in]=${encodeURIComponent(discordIds.join(','))}`, {
        headers: {
            Authorization: `Bearer ${API_TOKEN}`
        }
    });

    if (!staffResponse.ok) {
        throw new Error(`Failed to fetch staff: ${staffResponse.statusText}`);
    }

    const staff = await staffResponse.json();

    const authorizedUsers = staff.data.map(user => ({
        discordId: user.discord_id,
        discord_name: user.name,
        vrchat_name: links.data.find(link => link.discord_id === user.discord_id).vrchat_name,
        roles: user.roles
    }));

    console.log(`Found ${authorizedUsers.length} authorized users`);
    console.log(authorizedUsers);

    const authorizedUsersOutputFile = authorizedUsers.map(user => `${user.vrchat_name};${user.roles.join(',')}`).join('\n');
    fs.writeFileSync('authorized-users.txt', `name;roles\n${authorizedUsersOutputFile}`);
    console.log('Wrote authorized users to authorized-users.txt');

    const boosters = links.data
        .filter(link => link.booster === true)
        .map(link => ({
            discordId: link.discord_id,
            discord_name: link.discord_name,
            vrchat_name: link.vrchat_name,
        }));

    console.log(`Found ${boosters.length} boosters`);
    console.log(boosters);

    const boosterOutputFile = boosters.map(user => `${user.vrchat_name}`).join('\n');
    fs.writeFileSync('boosters.txt', `name\n${boosterOutputFile}`);
    console.log('Wrote boosters to boosters.txt');
})();