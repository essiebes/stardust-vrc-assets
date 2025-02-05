#!/bin/bash

# Call the first URL and get the JSON response
base_url="https://api.clubstardustvr.com"
params="filter%5Beffective_from%5D%5B_lte%5D=\$NOW()&filter%5Bstatus%5D%5B_eq%5D=published&fields=id,status,effective_from,calendar_picture&sort=-effective_from&limit=1"
url="$base_url/items/event_schedules?$params"
echo "URL: $url"
response=$(curl -H "Authorization: Bearer $API_TOKEN" -s $url)

# Extract the calendar picture ID using jq
calendar_picture_id=$(echo $response | jq -r '.data[0].calendar_picture')
echo "Calendar picture ID: $calendar_picture_id"

# Construct the URL for the calendar picture
photo_url_1024="$base_url/assets/$calendar_picture_id?key=vrchat-1024-16x9"
photo_url_2048="$base_url/assets/$calendar_picture_id?key=vrchat-2048-16x9"

echo "Calendar picture URL (1024x1024): $photo_url_1024"
echo "Calendar picture URL (2048x2048): $photo_url_2048"

# Download the calendar picture and save it as latest_calendar.png
curl -s $photo_url_1024 -o latest_calendar_x1024.webp
curl -s $photo_url_2048 -o latest_calendar_x2048.webp

echo "Downloaded the latest calendar picture as latest_calendar_x1024 and latest_calendar_x2048"
