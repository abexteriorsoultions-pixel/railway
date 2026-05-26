const siteConfig = window.SITE_CONFIG || {};
const apiBaseUrl = String(siteConfig.apiBaseUrl || "").replace(/\/$/, "");

function apiUrl(path) {
  if (!apiBaseUrl) return path;
  try {
    return new URL(path, `${apiBaseUrl}/`).toString();
  } catch {
    return path;
  }
}

const services = [
  {
    title: "Trash Bin Cleaning",
    icon: "bin",
    image: "/assets/gallery-trash-after.jpg",
    desc: "Deep clean and sanitize your bins — eliminates odors, bacteria, and grime with eco-friendly solutions.",
    prices: [
      ["1 Can", "$20"],
      ["2 Cans", "$35"],
      ["3 Cans", "$45"],
      ["4 Cans", "$60"],
      ["Extra Can", "+$10"],
    ],
  },
  {
    title: "Door Cleaning",
    icon: "door",
    image: "/assets/service-door-clean.jpg",
    desc: "Restore curb appeal with a professional soft wash — front, side, screen, or garage doors.",
    prices: [
      ["Front Door", "$20"],
      ["Side Door", "$15"],
      ["Screen Door", "$10"],
      ["Garage Door Single", "$25"],
      ["Garage Door Double", "$35"],
    ],
  },
  {
    title: "Driveway Cleaning",
    icon: "home",
    image: "/assets/service-driveway-clean.jpg",
    desc: "High-pressure wash removes oil stains, mold, and buildup. Leave your driveway looking brand new.",
    prices: [
      ["Small (1-2 cars)", "$60"],
      ["Medium (2-3 cars)", "$85"],
      ["Large (4+ cars)", "$120"],
    ],
  },
  {
    title: "Patio Cleaning",
    icon: "leaf",
    image: "/assets/gallery-patio-after.jpg",
    desc: "Power wash your patio clear of algae, stains, and grime. Perfect for BBQ season and hosting guests.",
    prices: [
      ["Small", "$50"],
      ["Medium", "$80"],
      ["Large", "$120"],
    ],
  },
  {
    title: "Sidewalk Cleaning",
    icon: "walk",
    image: "/assets/service-sidewalk-clean.jpg",
    desc: "Remove dirt, gum, algae, and staining from walkways. Clean, safe paths every time.",
    prices: [
      ["Per Section", "$10"],
      ["Full Sidewalk", "$60"],
    ],
  },
  {
    title: "Exterior Refresh",
    icon: "shine",
    image: "/assets/service-house-exterior.jpg",
    desc: "A comprehensive exterior cleaning covering every visible surface. Maximum curb appeal in one visit.",
    prices: [
      ["Custom quote", "Contact"],
      ["See our packages", "below"],
    ],
  },
];

const packages = [
  { title: "Basic Clean", price: "$50", tag: "", items: ["2 Trash Cans", "Front Door"] },
  { title: "Curb Appeal", price: "$95", tag: "Most Popular", items: ["2 Trash Cans", "Small Driveway", "Front Door"] },
  { title: "Full Exterior", price: "$150", tag: "", items: ["3 Trash Cans", "Medium Driveway", "Full Sidewalk", "Front Door"] },
  { title: "Premium Property", price: "$240", tag: "", items: ["4 Trash Cans", "Large Driveway", "Patio Cleaning", "Garage Door", "Sidewalk"] },
];

const defaultReviews = [
  {
    name: "Maria T.",
    rating: 5,
    review: "Absolutely amazing service! My driveway looks brand new and the trash cans smell great. Will definitely be booking again.",
    service: "Curb Appeal Package",
  },
  {
    name: "James R.",
    rating: 5,
    review: "Best money I've spent on my home this year. The team was professional, fast, and thorough. My whole property looks incredible.",
    service: "Premium Property Package",
  },
  {
    name: "Sandra L.",
    rating: 4,
    review: "Great service and very affordable. The bins were spotless when they were done. Highly recommend to anyone in the area.",
    service: "Trash Bin Cleaning",
  },
];

const serviceGrid = document.querySelector("#serviceGrid");
const packageGrid = document.querySelector("#packageGrid");
const serviceSelect = document.querySelector("#serviceSelect");
const reviewServiceSelect = document.querySelector("#reviewServiceSelect");

function renderServices() {
  services.forEach((service) => {
    const article = document.createElement("article");
    article.className = "service-card";
    article.innerHTML = `
      <div class="service-photo">
        <img src="${service.image}" alt="${service.title} service example" />
      </div>
      <div>
        <span class="service-icon">${service.icon}</span>
        <h3>${service.title}</h3>
        <p>${service.desc}</p>
      </div>
      <div class="price-box">
        ${service.prices.map(([label, price]) => `<div><span>${label}</span><strong>${price}</strong></div>`).join("")}
      </div>
      <a class="btn btn-primary full" href="#booking" data-service="${service.title}">Book Now</a>
    `;
    serviceGrid.append(article);
  });
}

function renderPackages() {
  packages.forEach((pack) => {
    const article = document.createElement("article");
    article.className = `package-card${pack.tag ? " featured" : ""}`;
    article.innerHTML = `
      ${pack.tag ? `<span class="popular">${pack.tag}</span>` : ""}
      <h3>${pack.title}</h3>
      <div class="package-price"><strong>${pack.price}</strong><span>/ visit</span></div>
      <ul>${pack.items.map((item) => `<li>${item}</li>`).join("")}</ul>
      <a class="btn btn-primary full" href="#booking" data-service="${pack.title} Package">Book This Package</a>
    `;
    packageGrid.append(article);
  });
}

function populateSelects() {
  const options = [
    "Select a service...",
    ...services.map((service) => service.title),
    ...packages.map((pack) => `${pack.title} Package`),
    "Summer Refresh Package",
    "Waste Removal",
  ];

  options.forEach((label, index) => {
    const bookingOption = document.createElement("option");
    bookingOption.value = index === 0 ? "" : label;
    bookingOption.textContent = label;
    serviceSelect.append(bookingOption);

    const reviewOption = document.createElement("option");
    reviewOption.value = index === 0 ? "" : label;
    reviewOption.textContent = label;
    reviewServiceSelect.append(reviewOption);
  });
}

function applyConfig() {
  const phoneDisplay = document.querySelector("#phoneDisplay");
  const emailDisplay = document.querySelector("#emailDisplay");
  const areaDisplay = document.querySelector("#areaDisplay");
  const domainDisplay = document.querySelector("#domainDisplay");
  const adminLink = document.querySelector("#adminLink");

  if (phoneDisplay && siteConfig.phoneDisplay) {
    phoneDisplay.textContent = siteConfig.phoneDisplay;
    phoneDisplay.href = `tel:${siteConfig.phoneHref || siteConfig.phoneDisplay}`;
  }
  if (emailDisplay && siteConfig.email) {
    emailDisplay.textContent = siteConfig.email;
    emailDisplay.href = `mailto:${siteConfig.email}`;
  }
  if (areaDisplay && siteConfig.serviceArea) areaDisplay.textContent = siteConfig.serviceArea;
  if (domainDisplay && siteConfig.domain) domainDisplay.textContent = `Domain: ${siteConfig.domain}`;
  if (adminLink && siteConfig.adminUrl) adminLink.href = siteConfig.adminUrl;
}

function formData(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  if (data.preferred_date) {
    data.preferred_time = `${data.preferred_date} ${data.preferred_time_text || ""}`.trim();
  }
  return data;
}

async function submitJson(url, data) {
  let response;
  try {
    response = await fetch(apiUrl(url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Booking is not connected to the live server yet. Please text us at (856) 418-7233 while we finish setup.");
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

function wireMenu() {
  const menuToggle = document.querySelector("#menuToggle");
  const nav = document.querySelector("#siteNav");
  menuToggle.addEventListener("click", () => nav.classList.toggle("open"));
  nav.addEventListener("click", () => nav.classList.remove("open"));
}

function wireBooking() {
  const dateInput = document.querySelector('input[name="preferred_date"]');
  const timeSlotSelect = document.querySelector("#timeSlotSelect");
  if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);
  function selectedWeekday(value) {
    const parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  }
  function updateTimeSlots() {
    if (!dateInput || !timeSlotSelect) return;
    const weekday = selectedWeekday(dateInput.value);
    [...timeSlotSelect.options].forEach((option) => {
      if (!option.value) return;
      option.disabled = weekday === 0 || (weekday === 6 && option.value === "4:00 PM");
    });
    if (timeSlotSelect.selectedOptions[0]?.disabled) timeSlotSelect.value = "";
  }
  dateInput?.addEventListener("change", updateTimeSlots);
  updateTimeSlots();

  document.body.addEventListener("click", (event) => {
    const link = event.target.closest("[data-service]");
    if (!link) return;
    serviceSelect.value = link.dataset.service;
  });

  document.querySelector("#bookingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = document.querySelector("#bookingNote");
    note.textContent = "Checking the schedule and saving your booking request...";
    try {
      const data = await submitJson("/api/bookings", formData(event.currentTarget));
      note.textContent = `${data.message} Booking #${data.booking_id}.`;
      event.currentTarget.reset();
    } catch (error) {
      note.textContent = error.message;
    }
  });
}

function wireReviews() {
  document.querySelector("#reviewForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = document.querySelector("#reviewNote");
    note.textContent = "Saving your review...";
    try {
      const data = await submitJson("/api/reviews", formData(event.currentTarget));
      note.textContent = data.message;
      event.currentTarget.reset();
    } catch (error) {
      note.textContent = error.message;
    }
  });
}

function reviewCard(review) {
  const rating = Number(review.rating || 5);
  return `
    <article class="review-card">
      <div class="stars">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
      <p>"${review.review}"</p>
      <strong>${review.name}</strong>
      <span>${review.service || "AB Exterior Solutions customer"}</span>
    </article>
  `;
}

async function loadReviews() {
  const grid = document.querySelector("#reviewsGrid");
  try {
    const response = await fetch(apiUrl("/api/reviews"));
    const data = await response.json();
    const approved = data.reviews || [];
    grid.innerHTML = (approved.length ? approved : defaultReviews).map(reviewCard).join("");
  } catch {
    grid.innerHTML = defaultReviews.map(reviewCard).join("");
  }
}

renderServices();
renderPackages();
populateSelects();
applyConfig();
wireMenu();
wireBooking();
wireReviews();
loadReviews();
document.querySelector("#year").textContent = new Date().getFullYear();
