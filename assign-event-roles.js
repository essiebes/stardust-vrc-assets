const prompts = require('prompts');

const BASE_URL = 'https://clubs.essiebes.nl/stardust/api';
const API_TOKEN = process.env.API_TOKEN;

const log = (log) => {
    console.log(`-----${'-'.repeat(log.length)}-----`);
    console.log(`-----${log}-----`);
    console.log(`-----${'-'.repeat(log.length)}-----`);
}

const arrayEqual = (a, b) => JSON.stringify(a.sort()) === JSON.stringify(b.sort());

(async () => {
    const staffResponse = await fetch(`${BASE_URL}/items/staff?limit=-1`, {
        headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`
        }
    });
    if (!staffResponse.ok) {
        throw new Error('Staff could not be retrieved')
    }
    const staff = (await staffResponse.json()).data;
    const eventsResponse = await fetch(`${BASE_URL}/items/Event?limit=5&filter[start_date][_gte]=$NOW(-7d)&fields=*&fields=event_staff.*&sort=start_date`, {
        headers: {
            'Accept': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`
        }
    });
    if (!eventsResponse.ok) {
        throw new Error('Event could not be retrieved');
    }
    const events = (await eventsResponse.json()).data;
    log('Done retrieving event and staff details')

    const { eventId } = await prompts({
        type: 'select',
        name: 'eventId',
        message: 'Which event to modify?',
        choices: events.map(e => ({
            title: `${e.title}`,
            description: `${e.start_date}`,
            value: e.id,
        }))
    });
    const event = events.find(e => e.id === eventId);

    let cancel = false;
    const response = await prompts([
        {
            type: 'autocompleteMultiselect',
            name: 'dancer',
            message: 'Which dancers participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('dancer'))
            })),
            hint: '- Space to select. Return to submit',
            min: 1,
            max: 30,
        },
        {
            type: 'autocompleteMultiselect',
            name: 'host',
            message: 'Which Hosts participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('host'))
            })),
            hint: '- Space to select. Return to submit',
            min: 1,
            max: 4,
        },
        {
            type: 'autocompleteMultiselect',
            name: 'security',
            message: 'Which Security participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('security'))
            })),
            hint: '- Space to select. Return to submit',
            min: 1,
            max: 4,
        },
        {
            type: 'autocompleteMultiselect',
            name: 'photographer',
            message: 'Which photographers participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('photographer'))
            })),
            hint: '- Space to select. Return to submit',
            min: 0,
            max: 4,
        },
        {
            type: 'autocompleteMultiselect',
            name: 'dj',
            message: 'Which DJs participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('dj'))
            })),
            hint: '- Space to select. Return to submit',
            min: 0,
            max: 2,
        },
        {
            type: 'autocompleteMultiselect',
            name: 'dance_captain',
            message: 'Which Dance Captain participated in this event?',
            choices: staff.map(s => ({
                title: s.name,
                value: s.id,
                selected: event.event_staff.find(es => es.staff_id === s.id && es.roles.includes('dance_captain'))
            })),
            hint: '- Space to select. Return to submit',
            min: 0,
            max: 2,
        },
    ], {
        onCancel: () => {
            log('Cancelling');
            cancel = true;
        }
    });

    if (cancel === true) {
        return;
    }

    const addToStaff = (list, ids, role) => {
        for (const d of ids) {
            if (list[d] != undefined) {
                list[d].push(role);
                continue;
            }
            list[d] = [role];
        }
    }

    const selectedStaff = {}
    addToStaff(selectedStaff, response.dancer, 'dancer');
    addToStaff(selectedStaff, response.host, 'host');
    addToStaff(selectedStaff, response.security, 'security');
    addToStaff(selectedStaff, response.photographer, 'photographer');
    addToStaff(selectedStaff, response.dj, 'dj');
    addToStaff(selectedStaff, response.dance_captain, 'dance_captain');
    const selectedStaffIds = Object.keys(selectedStaff);

    const toDeleteStaff = event.event_staff.filter(es => !selectedStaffIds.includes(es.staff_id));

    const toCreateStaff = selectedStaffIds
        .filter(staffId => event.event_staff.find(es => es.staff_id === staffId) == undefined)
        .map((staffId) => {
            return {
                event_id: eventId,
                staff_id: { id: staffId },
                roles: selectedStaff[staffId],
            }
        });

    const toUpdateStaff = selectedStaffIds
        .filter(staffId => {
            const eventStaff = event.event_staff.find(es => es.staff_id === staffId);
            if (eventStaff == undefined) return false;
            if (!arrayEqual(selectedStaff[staffId], eventStaff.roles)) return true;
            return false;
        })
        .map((staffId) => {
            return {
                id: event.event_staff.find(es => es.staff_id === staffId).id,
                event_id: eventId,
                staff_id: { id: staffId },
                roles: selectedStaff[staffId],
            }
        });

    const body = {
        event_staff: {
            create: toCreateStaff,
            update: toUpdateStaff,
            delete: toDeleteStaff.map(es => es.id)
        }
    };

    if (body.event_staff.create.length === 0 && body.event_staff.update.length === 0 && body.event_staff.delete.length === 0) {
        log('No changes to event were made');
        return;
    }

    const { confirm } = await prompts({
        type: 'toggle',
        name: 'confirm',
        message: 'Can you confirm?',
        initial: true,
        active: 'yes',
        inactive: 'no'
    });

    if (confirm !== true) {
        log('Stopping');
        return;
    }

    const updateEvent = await fetch(`${BASE_URL}/items/Event/${eventId}`, {
        method: 'PATCH',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_TOKEN}`
        },
        body: JSON.stringify(body)
    });

    if (!updateEvent.ok) {
        throw new Error(`Event could not be updated: ${updateEvent.statusText}`);
    }

    log('Changes to event were sucessfully applied.');
})();