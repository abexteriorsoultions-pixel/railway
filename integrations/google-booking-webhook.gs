/*
  AB Exterior Solutions booking automation.

  Paste this whole file into Google Apps Script.
  Then change only the SETTINGS values below.
*/

const SETTINGS = {
  SHARED_SECRET: "ABsolutions2026!",
  CALENDAR_ID: "primary",
  OWNER_EMAIL: "austin@abexteriorsolutions.com",
  COMPANY_NAME: "AB Exterior Solutions",
  TIMEZONE: "America/New_York",
  DEFAULT_START_HOUR: 9,
  DEFAULT_EVENT_MINUTES: 120,
  BOOKING_BLOCK_MINUTES: 120,
  ALLOWED_START_TIMES: ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"],
};

function doGet() {
  return jsonResponse({
    ok: true,
    message: "AB Exterior Solutions booking webhook is live.",
  });
}

function doPost(event) {
  const data = JSON.parse(event.postData.contents || "{}");
  if (SETTINGS.SHARED_SECRET && data.secret !== SETTINGS.SHARED_SECRET) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  const missing = ["name", "phone", "email", "address", "service", "preferred_time"].filter((key) => !String(data[key] || "").trim());
  if (missing.length) {
    return jsonResponse({ ok: false, error: "Missing required booking information", missing }, 400);
  }

  const start = parsePreferredTime(data.preferred_time, data.timezone || SETTINGS.TIMEZONE);
  if (!start) {
    return jsonResponse({ ok: false, error: "Invalid appointment time" }, 400);
  }
  if (start.getTime() < new Date().getTime()) {
    return jsonResponse({ ok: false, error: "Appointment time is in the past" }, 400);
  }
  if (start.getDay() === 0) {
    return jsonResponse({ ok: false, error: "Sunday appointments are not available online" }, 400);
  }
  if (start.getDay() === 6 && Utilities.formatDate(start, data.timezone || SETTINGS.TIMEZONE, "h:mm a") === "4:00 PM") {
    return jsonResponse({ ok: false, error: "Saturday appointments are available from 8:00 AM to 4:00 PM" }, 400);
  }

  const durationMinutes = Number(data.duration_minutes || SETTINGS.DEFAULT_EVENT_MINUTES);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const calendar = CalendarApp.getCalendarById(SETTINGS.CALENDAR_ID);
  const existingEvents = calendar.getEvents(start, end);
  if (existingEvents.length) {
    return jsonResponse({ ok: false, error: "Calendar slot unavailable" }, 409);
  }

  const title = `PENDING - AB Exterior: ${data.service} - ${data.name}`;
  const description = [
    `Booking #${data.booking_id}`,
    `Status: Pending confirmation`,
    `Customer: ${data.name}`,
    `Phone: ${data.phone}`,
    `Email: ${data.email}`,
    `Address: ${data.address}`,
    `Service: ${data.service}`,
    `Preferred time: ${data.preferred_time}`,
    `Calendar block: ${durationMinutes} minutes`,
    "",
    `Notes: ${data.message || "None"}`,
    "",
    "Sophia/Admin: confirm availability, then update the booking status in the AB Exterior dashboard.",
  ].join("\n");

  const createdEvent = calendar.createEvent(title, start, end, {
    description,
    location: data.address,
    guests: data.email,
    sendInvites: true,
  });

  const ownerEmail = data.business_email || SETTINGS.OWNER_EMAIL;
  MailApp.sendEmail({
    to: ownerEmail,
    subject: `New AB Exterior booking #${data.booking_id}`,
    body: description,
  });

  MailApp.sendEmail({
    to: data.email,
    subject: `${SETTINGS.COMPANY_NAME} appointment request received`,
    body: `Hi ${data.name},\n\nThanks for booking with ${SETTINGS.COMPANY_NAME}. We received your request for ${data.service} at ${data.preferred_time}.\n\nThis appointment has been placed on our calendar as pending. Our team will confirm the job details soon.\n\nIf anything needs to change, text us at (856) 418-7233.\n\n${SETTINGS.COMPANY_NAME}`,
  });

  return jsonResponse({ ok: true, eventId: createdEvent.getId() }, 200);
}

function parsePreferredTime(value, timeZone) {
  const text = String(value || "").trim();
  const dateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) return null;
  const datePart = dateMatch[1];
  const timeText = text.replace(datePart, "").trim();
  if (!SETTINGS.ALLOWED_START_TIMES.includes(timeText)) return null;
  const timeMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  let hour = SETTINGS.DEFAULT_START_HOUR;
  let minute = 0;

  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] || 0);
    const meridiem = String(timeMatch[3] || "").toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  }

  return new Date(`${datePart}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

function jsonResponse(payload, statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify({ statusCode, ...payload }))
    .setMimeType(ContentService.MimeType.JSON);
}
