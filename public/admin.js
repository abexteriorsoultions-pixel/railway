const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const bookingsTable = document.querySelector("#bookingsTable");
const reviewsTable = document.querySelector("#reviewsTable");
const adminConfig = window.ADMIN_CONFIG || {};
const viewSiteLink = document.querySelector("#viewSiteLink");

if (viewSiteLink && adminConfig.frontendUrl) {
  viewSiteLink.href = adminConfig.frontendUrl;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function statusSelect(value, type, id) {
  const statuses = type === "booking" ? ["Pending", "Confirmed", "Completed", "Canceled"] : ["Pending", "Approved", "Hidden"];
  return `
    <select data-type="${type}" data-id="${id}" class="status-select">
      ${statuses.map((status) => `<option value="${status}" ${status === value ? "selected" : ""}>${status}</option>`).join("")}
    </select>
  `;
}

async function loadDashboard() {
  const [bookings, reviews] = await Promise.all([api("/api/admin/bookings"), api("/api/admin/reviews")]);
  bookingsTable.innerHTML =
    bookings.bookings
      .map(
        (booking) => `
        <tr>
          <td>${escapeHtml(booking.name)}</td>
          <td><a href="tel:${escapeHtml(booking.phone)}">${escapeHtml(booking.phone)}</a></td>
          <td><a href="mailto:${escapeHtml(booking.email)}">${escapeHtml(booking.email)}</a></td>
          <td>${escapeHtml(booking.address)}</td>
          <td>${escapeHtml(booking.service)}</td>
          <td>${escapeHtml(booking.preferred_time)}</td>
          <td>${escapeHtml(booking.message)}</td>
          <td>${statusSelect(booking.status, "booking", booking.id)}</td>
        </tr>
      `
      )
      .join("") || `<tr><td colspan="8">No bookings yet.</td></tr>`;

  reviewsTable.innerHTML =
    reviews.reviews
      .map(
        (review) => `
        <tr>
          <td>${escapeHtml(review.name)}</td>
          <td>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</td>
          <td>${escapeHtml(review.service)}</td>
          <td>${escapeHtml(review.review)}</td>
          <td>${statusSelect(review.status, "review", review.id)}</td>
          <td><button class="delete-btn" data-delete-review="${review.id}">Delete</button></td>
        </tr>
      `
      )
      .join("") || `<tr><td colspan="6">No reviews yet.</td></tr>`;
}

async function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
  await loadDashboard();
}

async function checkSession() {
  const session = await api("/api/admin/session");
  if (session.authenticated) showDashboard();
}

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = document.querySelector("#loginNote");
  note.textContent = "Checking credentials...";
  try {
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    await api("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    note.textContent = "";
    await showDashboard();
  } catch (error) {
    note.textContent = error.message;
  }
});

document.querySelector("#logoutBtn").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  dashboard.classList.add("hidden");
  loginPanel.classList.remove("hidden");
});

document.body.addEventListener("change", async (event) => {
  const select = event.target.closest(".status-select");
  if (!select) return;
  const base = select.dataset.type === "booking" ? "/api/admin/bookings" : "/api/admin/reviews";
  await api(`${base}/${select.dataset.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: select.value }),
  });
});

document.body.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-review]");
  if (!button) return;
  await api(`/api/admin/reviews/${button.dataset.deleteReview}`, { method: "DELETE" });
  await loadDashboard();
});

checkSession();
