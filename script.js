// Change this if your FastAPI server runs somewhere else
const API_URL = "https://nyc-airbnb-room-type-predictor-af3d.onrender.com";

// Class order assumed to be alphabetical (scikit-learn default).
// Check with: model.classes_  — and reorder here if it differs.
const CLASSES = ["Entire home/apt", "Private room", "Shared room"];
const COLORS = ["#ffb454", "#7b93ff", "#c58bff"];

// Approximate centre points, [lat, lng]
const HOODS = {
  "Manhattan": { "Midtown": [40.7549, -73.9840], "Harlem": [40.8116, -73.9465], "East Village": [40.7265, -73.9815], "Upper West Side": [40.7870, -73.9754], "Chelsea": [40.7465, -74.0014], "Hell's Kitchen": [40.7638, -73.9918], "Lower East Side": [40.7150, -73.9843], "Washington Heights": [40.8417, -73.9393] },
  "Brooklyn": { "Williamsburg": [40.7081, -73.9571], "Bedford-Stuyvesant": [40.6872, -73.9418], "Bushwick": [40.6944, -73.9213], "Greenpoint": [40.7304, -73.9515], "Crown Heights": [40.6694, -73.9422], "Park Slope": [40.6710, -73.9814], "Flatbush": [40.6409, -73.9594] },
  "Queens": { "Astoria": [40.7644, -73.9235], "Long Island City": [40.7447, -73.9485], "Flushing": [40.7675, -73.8330], "Jamaica": [40.7027, -73.7890], "Ridgewood": [40.7043, -73.9018] },
  "Bronx": { "Mott Haven": [40.8089, -73.9229], "Fordham": [40.8610, -73.8901], "Riverdale": [40.8900, -73.9126] },
  "Staten Island": { "St. George": [40.6437, -74.0735], "Tompkinsville": [40.6366, -74.0875], "Stapleton": [40.6270, -74.0775] }
};

const PRESETS = {
  midtown:  { group: "Manhattan", hood: "Midtown", price: 220, minimum_nights: 3, availability_365: 270, number_of_reviews: 48, reviews_per_month: 1.2, calculated_host_listings_count: 4 },
  bushwick: { group: "Brooklyn", hood: "Bushwick", price: 65, minimum_nights: 2, availability_365: 120, number_of_reviews: 31, reviews_per_month: 0.9, calculated_host_listings_count: 1 },
  flushing: { group: "Queens", hood: "Flushing", price: 38, minimum_nights: 1, availability_365: 340, number_of_reviews: 9, reviews_per_month: 0.3, calculated_host_listings_count: 3 }
};

const $ = (s) => document.querySelector(s);
const form = $("#form"), result = $("#result"), btn = $("#submit");
const hoodInput = $("#neighbourhood"), avail = $("#availability_365");

/* ---------- API status ---------- */
(async function ping() {
  const el = $("#status"), txt = $("#statusText");
  try {
    const r = await fetch(API_URL + "/");
    if (!r.ok) throw 0;
    el.className = "status ok"; txt.textContent = "API connected";
  } catch {
    el.className = "status down"; txt.textContent = "API offline — start the server";
  }
})();

/* ---------- Neighbourhood list + coordinates ---------- */
const group = () => form.neighbourhood_group.value;

function loadHoods() {
  $("#hoods").innerHTML = Object.keys(HOODS[group()]).map((h) => `<option value="${h}">`).join("");
  if (!HOODS[group()][hoodInput.value]) hoodInput.value = "";
}

function flash(el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }

function fillCoords() {
  const c = HOODS[group()][hoodInput.value];
  if (!c) return;
  [["latitude", c[0]], ["longitude", c[1]]].forEach(([id, v]) => { const el = $("#" + id); el.value = v; flash(el); });
}

form.querySelectorAll("[name=neighbourhood_group]").forEach((r) => r.addEventListener("change", () => { loadHoods(); }));
hoodInput.addEventListener("input", fillCoords);
loadHoods();

/* ---------- Slider ---------- */
function syncSlider() {
  $("#availOut").textContent = avail.value + " days";
  avail.style.setProperty("--fill", (avail.value / 365 * 100) + "%");
}
avail.addEventListener("input", syncSlider);
syncSlider();

/* ---------- Presets ---------- */
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  const p = PRESETS[b.dataset.preset];
  form.querySelector(`[name=neighbourhood_group][value="${p.group}"]`).checked = true;
  loadHoods();
  hoodInput.value = p.hood; fillCoords();
  ["price", "minimum_nights", "availability_365", "number_of_reviews", "reviews_per_month", "calculated_host_listings_count"]
    .forEach((k) => { const el = $("#" + k); el.value = p[k]; flash(el); });
  syncSlider();
  clearErrors();
}));

/* ---------- Validation (mirrors the Pydantic model) ---------- */
const RULES = {
  latitude: [-90, 90, false], longitude: [-180, 180, false],
  price: [0, Infinity, false, true], minimum_nights: [1, Infinity, true],
  number_of_reviews: [0, Infinity, true], reviews_per_month: [0, Infinity, false],
  calculated_host_listings_count: [0, Infinity, true], availability_365: [0, 365, true]
};

function setError(name, msg) {
  const field = form.elements[name].closest(".field");
  field.classList.add("invalid");
  const e = field.querySelector(".err"); if (e) e.textContent = msg;
}
function clearErrors() {
  form.querySelectorAll(".field").forEach((f) => { f.classList.remove("invalid"); const e = f.querySelector(".err"); if (e) e.textContent = ""; });
}
form.addEventListener("input", (e) => {
  const f = e.target.closest(".field");
  if (f) { f.classList.remove("invalid"); const m = f.querySelector(".err"); if (m) m.textContent = ""; }
});

function collect() {
  clearErrors();
  const data = {}; let ok = true;
  for (const [name, [min, max, int, exclusive]] of Object.entries(RULES)) {
    const raw = form.elements[name].value.trim();
    const v = Number(raw);
    if (raw === "" || Number.isNaN(v)) { setError(name, "Enter a number."); ok = false; continue; }
    if (int && !Number.isInteger(v)) { setError(name, "Use a whole number."); ok = false; continue; }
    if (v < min || v > max || (exclusive && v <= min)) {
      setError(name, exclusive ? "Must be greater than 0." : `Must be between ${min} and ${max === Infinity ? "∞" : max}.`); ok = false; continue;
    }
    data[name] = v;
  }
  data.neighbourhood_group = group();
  data.neighbourhood = hoodInput.value.trim();
  if (!data.neighbourhood) { setError("neighbourhood", "Choose or type a neighbourhood."); ok = false; }
  return ok ? data : null;
}

/* ---------- Predict ---------- */
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 5000);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = collect();
  if (!payload) { toast("Fix the highlighted fields and try again."); return; }

  btn.classList.add("loading"); result.dataset.state = "loading";
  $("#answer").textContent = "Analysing listing…"; $("#sub").textContent = "Asking the model."; $("#pct").textContent = "–";

  try {
    const res = await fetch(API_URL + "/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.status === 422 && Array.isArray(data.detail)) {
      data.detail.forEach((d) => { const n = d.loc[d.loc.length - 1]; if (form.elements[n]) setError(n, d.msg); });
      throw new Error("The server rejected some values.");
    }
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "The server returned an error (" + res.status + ").");
    render(data.Predicted_room_type, data.Probability[0]);
  } catch (err) {
    result.dataset.state = "idle";
    $("#answer").textContent = "No prediction yet"; $("#sub").textContent = "Something went wrong. Review the form and try again.";
    toast(err instanceof TypeError ? `Can’t reach the API at ${API_URL}. Start it with: uvicorn main:app --reload` : err.message);
  } finally {
    btn.classList.remove("loading");
  }
});

/* ---------- Render result ---------- */
function render(label, probs) {
  const top = probs.indexOf(Math.max(...probs));
  const names = CLASSES.includes(label) && probs.length === CLASSES.length
    ? CLASSES : probs.map((_, i) => (i === top ? label : "Class " + (i + 1)));
  const idx = Math.max(0, names.indexOf(label));
  const color = COLORS[idx % COLORS.length];

  result.style.setProperty("--accent", color);
  result.dataset.state = "done";
  $("#answer").textContent = label;
  $("#sub").textContent = "Predicted room type for this listing.";

  $("#bars").innerHTML = names.map((n, i) => `
    <div class="bar ${i === idx ? "top" : ""}" style="--c:${COLORS[i % COLORS.length]}">
      <div class="meta"><span>${n}</span><span>${(probs[i] * 100).toFixed(1)}%</span></div>
      <div class="track"><div class="fill" data-w="${probs[i] * 100}"></div></div>
    </div>`).join("");

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll(".bar .fill").forEach((f) => (f.style.width = f.dataset.w + "%"));
    $("#ringFg").style.strokeDashoffset = 339.3 * (1 - probs[idx]);
  }));
  countUp($("#pct"), probs[idx] * 100);
}

function countUp(el, target) {
  const start = performance.now(), dur = 1200;
  (function tick(now) {
    const p = Math.min((now - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * eased).toFixed(1) + "%";
    if (p < 1) requestAnimationFrame(tick);
  })(start);
}

/* ---------- Ambient city lights ---------- */
(function lights() {
  const c = $("#lights"), ctx = c.getContext("2d");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let w, h, pts;
  function size() {
    w = c.width = innerWidth; h = c.height = innerHeight;
    pts = Array.from({ length: Math.round(w * h / 22000) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + .4, s: Math.random() * .02 + .005, o: Math.random() * 6 }));
  }
  addEventListener("resize", size); size();
  (function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      ctx.globalAlpha = .1 + .35 * (Math.sin(t * p.s * .1 + p.o) * .5 + .5);
      ctx.fillStyle = "#ffb454";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    requestAnimationFrame(frame);
  })(0);
})();
