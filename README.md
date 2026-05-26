# AB Exterior Solutions Railway Setup

This folder is the clean Railway version of the AB Exterior Solutions site.

## Folder Layout

- `frontend/` is the public customer website.
- `backend/` is the booking API, review API, admin dashboard, SQLite CRM database, and Google Calendar webhook integration.

## What The Backend Does

- Saves every booking to the backend database.
- Blocks Sundays.
- Uses 2-hour appointment windows.
- Allows Monday-Friday appointments from 8 AM to 6 PM.
- Allows Saturday appointments from 8 AM to 4 PM.
- Prevents double-booking pending or confirmed jobs.
- Sends booking details to the Google Apps Script webhook so jobs can land on Google Calendar.
- Gives admins a login dashboard at `/admin.html`.
- Lets admins update booking statuses: Pending, Confirmed, Completed, Canceled.
- Lets admins approve, hide, or delete reviews.

## Railway Services

Create one Railway project with two services from the same GitHub repo:

1. Frontend service
   - Root Directory: `/railway/frontend`
   - Start Command: `python server.py`

2. Backend service
   - Root Directory: `/railway/backend`
   - Start Command: `python server.py`

## Backend Variables

Paste these into the backend service Variables tab:

```env
ADMIN_USER=admin
ADMIN_PASSWORD=change-this-password
SESSION_SECRET=change-this-long-random-session-secret
BOOKING_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_GOOGLE_SCRIPT_DEPLOYMENT_ID/exec
BOOKING_WEBHOOK_SECRET=ABsolutions2026!
BUSINESS_NOTIFICATION_EMAIL=austin@abexteriorsolutions.com
BOOKING_TIMEZONE=America/New_York
DEFAULT_EVENT_DURATION_MINUTES=120
BOOKING_BLOCK_MINUTES=120
DATA_DIR=/app/data
FRONTEND_ORIGIN=https://your-frontend.up.railway.app
```

Create a Railway volume on the backend service and mount it to:

```txt
/app/data
```

That keeps bookings and reviews from disappearing after redeploys.

## Frontend Variables

Paste these into the frontend service Variables tab after the backend has a Railway public URL:

```env
SITE_DOMAIN=https://abexteriorsolutions.com
API_BASE_URL=https://your-backend.up.railway.app
ADMIN_URL=https://your-backend.up.railway.app/admin.html
PHONE_DISPLAY=(856) 418-7233
PHONE_HREF=+18564187233
BUSINESS_EMAIL=austin@abexteriorsolutions.com
SERVICE_AREA=Cherry Hill • Marlton • Voorhees • South Jersey
FACEBOOK_URL=#
INSTAGRAM_URL=#
GOOGLE_BUSINESS_URL=#
NEXTDOOR_URL=#
```

## Testing Before Posting

1. Open the backend health check:
   `https://your-backend.up.railway.app/api/health`

   It should show:

   ```json
   {"ok": true}
   ```

2. Open the frontend public website:
   `https://your-frontend.up.railway.app`

3. Submit a test booking.

4. Open the backend admin dashboard:
   `https://your-backend.up.railway.app/admin.html`

5. Confirm the booking appears in the dashboard and on Google Calendar.

## Editing Later

- Website words, sections, SEO, and layout: edit files in `frontend/public/`.
- Booking form behavior and service cards: edit `frontend/public/app.js`.
- Colors and spacing: edit `frontend/public/styles.css`.
- Backend booking rules, admin, database, calendar sync: edit `backend/server.py`.
- Google Calendar script: edit `backend/integrations/google-booking-webhook.gs`.
