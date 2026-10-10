/* Strivon — staff dashboard and labelling tool (vanilla JS, no build step). */
"use strict";

const LEVEL_LABEL = { empty: "Empty", half: "Half", full: "Full" };
const STATUS_LABEL = { empty: "Empty", half: "Low", full: "Full", wrong: "Wrong product" };
const FAMILY_LABEL = {
  banana: "Banana", plantain: "Plantain", citrus_orange: "Orange / citrus", lemon: "Lemon", lime: "Lime",
  watermelon: "Watermelon", melon: "Melon", apple_green: "Green/yellow apple", apple_russet: "Russet apple",
  apple_red: "Red apple", pear: "Pear", kiwi: "Kiwi", leafy: "Lettuce / greens", broccoli: "Broccoli",
  red_cabbage: "Red cabbage", cauliflower: "Cauliflower", cabbage: "Cabbage", avocado: "Avocado",
  pepper_green: "Green pepper", pepper_red: "Red pepper", eggplant: "Eggplant", chayote: "Chayote",
  green_beans: "Green beans", cucumber: "Cucumber / zucchini", tomato: "Tomato", strawberry: "Strawberry",
  mango: "Mango", grape_red: "Red grapes", grape_white: "White grapes", cherry: "Cherry", pineapple: "Pineapple",
  pitaya: "Pitaya", guava: "Guava", passion_fruit: "Passion fruit", papaya: "Papaya", stone_fruit: "Peach / nectarine",
  sweet_potato: "Sweet potato", potato: "Potato", ginger: "Ginger", pumpkin: "Pumpkin", onion_red: "Red onion",
  onion: "Onion", garlic: "Garlic", other: "Other",
};

const CASE_LABEL = {
  "Identification correct": "Product: right", "Identification wrong": "Product: wrong",
  "Stock level correct": "Stock: right", "Stock level below the real stock": "Stock: below real",
  "Stock level above the real stock": "Stock: above real",
};

const S = {
  data: null,
  tab: "tasks",
  T: null,          // selected time (unix seconds)
  times: [],        // all capture times
  gondola: null,    // camera open in detail view
  selArea: null,
  ann: {},
  annCam: null,
  annImg: null,
  annFocus: 0,
  annShowPred: true,
  annTest: false,
  annName: "",
  trainPerCamera: 8,
  liveVersion: null, activity: [], people: {}, notes: {}, suspects: [], suspIdx: 0,
  productFilter: "",
};

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.headers.get("content-type")?.includes("json") ? r.json() : r.text();
};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1800);
}

function hhmm(ts) {
  if (ts == null) return "--:--";
  const d = new Date((ts + 3600) * 1000); // dataset day: Portugal summer time (UTC+1)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/* ---------------- data helpers ---------------- */
const cams = () => Object.keys(S.data.images).sort();
const areasOf = (cam) => Object.values(S.data.areas).filter((a) => a.camera === cam).sort((a, b) => a.index - b.index);
const obs = (cam, img, aid) => S.data.observations[cam]?.[img]?.[aid];
const statusOf = (o) => (!o ? "unknown" : !o.planogram_compliant ? "wrong" : o.stock_level);
const cropUrl = (cam, img, aid) => `/api/crop/${cam}/${encodeURIComponent(img)}/${aid}`;
const imgUrl = (cam, img, w = 0) => `/api/image/${cam}/${encodeURIComponent(img)}${w ? `?w=${w}` : ""}`;

function snapshot(cam) {
  const list = S.data.images[cam] || [];
  let pick = list[0];
  for (const r of list) if (r.ts != null && r.ts <= S.T) pick = r;
  return pick;
}

function gondolaName(cam) {
  const counts = {};
  for (const a of areasOf(cam)) counts[a.family] = (counts[a.family] || 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => FAMILY_LABEL[f] || f);
  return top.join(" · ");
}

function history(cam, aid) {
  return (S.data.images[cam] || []).map((r) => ({ r, o: obs(cam, r.image, aid) }));
}

function since(cam, aid, img, pred) {
  const h = history(cam, aid);
  let i = h.findIndex((x) => x.r.image === img);
  let start = h[i];
  while (i >= 0 && pred(h[i].o)) { start = h[i]; i--; }
  return start ? start.r.ts : null;
}

/* ---------------- task model ---------------- */
function currentTasks() {
  const empty = [], wrong = [], half = [];
  const productState = {}; // product_id -> {n, empty}
  const rows = [];
  for (const cam of cams()) {
    const snap = snapshot(cam);
    if (!snap) continue;
    for (const a of areasOf(cam)) {
      const o = obs(cam, snap.image, a.area_id);
      if (!o) continue;
      rows.push({ cam, img: snap.image, ts: snap.ts, a, o });
      const ps = (productState[a.product_id] ||= { n: 0, empty: 0, half: 0, name: a.short_name });
      ps.n++;
      if (o.planogram_compliant && o.stock_level === "empty") ps.empty++;
      if (o.planogram_compliant && o.stock_level === "half") ps.half++;
    }
  }
  for (const t of rows) {
    t.product = productState[t.a.product_id];
    t.done = !!store.get(`done:${t.cam}/${t.img}/${t.a.area_id}`, false);
    const st = statusOf(t.o);
    if (st === "wrong") wrong.push(t);
    else if (st === "empty") empty.push(t);
    else if (st === "half") half.push(t);
  }
  const crit = (t) => (t.product.empty + 0.5 * t.product.half) / t.product.n;
  const byCrit = (a, b) => (a.done - b.done) || (crit(b) - crit(a)) || a.cam.localeCompare(b.cam) || a.a.index - b.a.index;
  empty.sort(byCrit); half.sort(byCrit);
  wrong.sort((a, b) => (a.done - b.done) || (a.o.p_compliant - b.o.p_compliant));
  return { empty, wrong, half, rows };
}

/* ---------------- rendering: shell ---------------- */
function setTab(tab) {
  S.tab = tab;
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  store.set("tab", tab);
  render();
}

function render() {
  if (!S.data) return;
  $("#time-label").textContent = hhmm(S.T);
  const { empty, wrong } = currentTasks();
  const open = empty.filter((t) => !t.done).length + wrong.filter((t) => !t.done).length;
  $("#badge-tasks").textContent = open || "";
  const v = $("#view");
  if (S.tab === "tasks") v.innerHTML = renderTasks();
  else if (S.tab === "gondolas") v.innerHTML = S.gondola ? renderGondola(S.gondola) : renderGondolas();
  else if (S.tab === "products") v.innerHTML = renderProducts();
  else if (S.tab === "annotate") v.innerHTML = renderAnnotate();
  else if (S.tab === "eval") { v.innerHTML = `<div class="empty-state">Scoring…</div>`; renderEval(); }
  document.querySelectorAll(".clock").forEach((el) => (el.style.visibility = S.tab === "annotate" || S.tab === "eval" ? "hidden" : "visible"));
}

function pill(st, label) {
  return `<span class="pill ${st}">${esc(label ?? STATUS_LABEL[st] ?? st)}</span>`;
}

/* ---------------- Tasks ---------------- */
function renderTasks() {
  const { empty, wrong, half, rows } = currentTasks();
  const nC = rows.filter((r) => r.o.planogram_compliant).length;
  const comp = rows.length ? Math.round((100 * nC) / rows.length) : 0;
  const fullN = rows.filter((r) => statusOf(r.o) === "full").length;
  const kpis = `
    <section class="kpis">
      <div class="kpi empty"><span class="num">${empty.length}</span><span class="lbl">Restock now</span><span class="hint">empty areas</span></div>
      <div class="kpi wrong"><span class="num">${wrong.length}</span><span class="lbl">Move back</span><span class="hint">wrong product for the planogram</span></div>
      <div class="kpi half"><span class="num">${half.length}</span><span class="lbl">Later</span><span class="hint">half-full areas</span></div>
      <div class="kpi ok"><span class="num">${comp}%</span><span class="lbl">Planogram followed</span><span class="hint">${fullN} of ${rows.length} areas full</span></div>
    </section>`;
  const group = (cls, step, title, sub, items, note) => `
    <section class="task-group ${cls}">
      <header><span class="step">${step}</span><h2>${title}</h2><span class="muted">${sub}</span></header>
      ${items.length ? `<div class="task-list">${items.map(note).join("")}</div>` : `<div class="empty-state">Nothing to do here ✓</div>`}
    </section>`;
  const card = (t, noteHtml) => `
    <article class="task ${t.done ? "done" : ""}" data-open="${t.cam}|${t.img}|${t.a.area_id}">
      <img loading="lazy" src="${cropUrl(t.cam, t.img, t.a.area_id)}" alt="">
      <div>
        <div class="t-title">${esc(t.a.short_name)}</div>
        <div class="t-where">Camera ${t.cam} · area ${t.a.index} · photo ${hhmm(t.ts)}</div>
        <div class="t-note">${noteHtml}</div>
        <div class="t-actions">
          <button class="ghost small" data-done="${t.cam}/${t.img}/${t.a.area_id}">${t.done ? "Undo" : "Done"}</button>
          <button class="ghost small" data-goto="${t.cam}|${t.a.area_id}">Show on gondola</button>
        </div>
      </div>
    </article>`;
  const emptyNote = (t) => {
    const s = since(t.cam, t.a.area_id, t.img, (o) => o && o.planogram_compliant && o.stock_level === "empty");
    const prod = t.product.n > 1 ? ` · ${t.product.empty} of ${t.product.n} areas of this product empty` : "";
    return card(t, `${pill("empty")} since ${hhmm(s)}${prod}`);
  };
  const wrongNote = (t) => card(t, `${pill("wrong", "Looks like " + (FAMILY_LABEL[t.o.observed_family] || t.o.observed_family))} expected: ${esc(FAMILY_LABEL[t.a.family] || t.a.family)}`);
  const halfNote = (t) => {
    const s = since(t.cam, t.a.area_id, t.img, (o) => o && o.planogram_compliant && o.stock_level !== "full");
    return card(t, `${pill("half")} since ${hhmm(s)}`);
  };
  const side = `
    <aside class="side">
      <div class="card">
        <h3>Gondolas now</h3>
        <div class="legend" style="margin-top:6px"><span><i class="dot empty"></i>Empty</span><span><i class="dot half"></i>Half</span><span><i class="dot full"></i>Full</span><span><i class="dot wrong"></i>Wrong</span></div>
        <div class="mini-grid">${cams().map((cam) => {
          const snap = snapshot(cam);
          return `<div class="mini" data-gondola="${cam}" title="${esc(gondolaName(cam))}">
            <img loading="lazy" src="${imgUrl(cam, snap.image, 320)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover">
            <span class="cam">${cam}</span>
            <div class="dots">${areasOf(cam).map((a) => `<i class="dot ${statusOf(obs(cam, snap.image, a.area_id))}" title="${a.index}: ${esc(a.short_name)}"></i>`).join("")}</div>
          </div>`;
        }).join("")}</div>
      </div>
      <div class="card small muted">
        Model: ${esc(S.data.backend)}${S.data.calibrated ? " · calibrated" : " · label-free"} · generated ${esc(S.data.generated_at?.replace("T", " "))}
      </div>
    </aside>`;
  return `${kpis}
    <div class="tasks-layout">
      <div>
        ${group("empty", 1, "Restock", "empty shelves = lost sales", empty, emptyNote)}
        ${group("wrong", 2, "Move back", "product differs from the planogram", wrong, wrongNote)}
        ${group("half", 3, "Later", "half full — plan the restock", half, halfNote)}
      </div>
      ${side}
    </div>`;
}

/* ---------------- Gondolas ---------------- */
function stageSvg(cam, img, { sel = null, labels = true, statusFn = null } = {}) {
  const polys = areasOf(cam).map((a) => {
    const st = statusFn ? statusFn(a) : statusOf(obs(cam, img, a.area_id));
    const pts = a.quad.map((p) => p.join(",")).join(" ");
    const cx = a.quad.reduce((s, p) => s + p[0], 0) / 4, cy = a.quad.reduce((s, p) => s + p[1], 0) / 4;
    return `<polygon class="${st} ${sel === a.area_id ? "sel" : ""}" points="${pts}" data-area="${a.area_id}"><title>${a.index} · ${esc(a.short_name)} — ${esc(STATUS_LABEL[st] || "")}</title></polygon>
      ${labels ? `<text x="${cx}" y="${cy + 9}" text-anchor="middle">${a.index}</text>` : ""}`;
  }).join("");
  return `<div class="stage"><img src="${imgUrl(cam, img)}" alt="Camera ${cam}"><svg viewBox="0 0 1280 720" preserveAspectRatio="none">${polys}</svg></div>`;
}

function camCounts(cam, img) {
  const c = { empty: 0, half: 0, full: 0, wrong: 0 };
  for (const a of areasOf(cam)) { const st = statusOf(obs(cam, img, a.area_id)); if (st in c) c[st]++; }
  return c;
}

function renderGondolas() {
  return `<div class="toolbar"><h2>Gondolas</h2><span class="muted">${cams().length} cameras · click one to see its areas</span></div>
  <div class="gondola-grid">${cams().map((cam) => {
    const snap = snapshot(cam);
    const c = camCounts(cam, snap.image);
    return `<article class="gcard" data-gondola="${cam}">
      <div class="g-head"><div><div class="g-title">${esc(gondolaName(cam))}</div><div class="g-sub">Camera ${cam} · photo from ${hhmm(snap.ts)}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${c.empty ? pill("empty", c.empty + " empty") : ""}${c.wrong ? pill("wrong", c.wrong + " wrong") : ""}${c.half ? pill("half", c.half + " half") : ""}${!c.empty && !c.wrong && !c.half ? pill("full", "All good") : ""}</div></div>
      ${stageSvg(cam, snap.image, { labels: false })}
    </article>`;
  }).join("")}</div>`;
}

function renderGondola(cam) {
  const snap = snapshot(cam);
  const list = areasOf(cam).map((a) => {
    const o = obs(cam, snap.image, a.area_id);
    const st = statusOf(o);
    return `<div class="area-row ${S.selArea === a.area_id ? "sel" : ""}" data-open="${cam}|${snap.image}|${a.area_id}">
      <span class="idx">${a.index}</span><span class="nm">${esc(a.short_name)}${a.visible_fraction < 0.95 ? ` <span class="muted small">(${Math.round(a.visible_fraction * 100)}% visible)</span>` : ""}</span>${pill(st)}
    </div>`;
  }).join("");
  return `<div class="detail-head">
      <button class="ghost" data-back>← Gondolas</button>
      <h2>${esc(gondolaName(cam))}</h2><span class="muted">Camera ${cam} · photo from ${hhmm(snap.ts)}</span>
      <span style="flex:1"></span>
      <div class="legend"><span><i class="dot empty"></i>Empty</span><span><i class="dot half"></i>Half</span><span><i class="dot full"></i>Full</span><span><i class="dot wrong"></i>Wrong product</span></div>
    </div>
    <div class="detail-layout">
      <div>${stageSvg(cam, snap.image, { sel: S.selArea })}
        <p class="muted small">Tap an area to see its detail and how it changed through the day. Use the time bar at the top to see other times.</p></div>
      <div class="area-list">${list}</div>
    </div>`;
}

/* ---------------- Drawer: area detail ---------------- */
function openArea(cam, img, aid) {
  const a = S.data.areas[aid];
  const o = obs(cam, img, aid);
  const rec = S.data.images[cam].find((r) => r.image === img);
  const st = statusOf(o);
  const h = history(cam, aid);
  const ann = S.ann[cam]?.[img]?.[aid];
  const fam = Object.entries(o.family_probs || {}).map(([f, p]) => `${esc(FAMILY_LABEL[f] || f)} ${Math.round(p * 100)}%`).join(" · ");
  const p = o.p_stock || [0, 0, 0];
  $("#drawer-body").innerHTML = `
    <div class="small muted">${esc(gondolaName(cam))} · camera ${cam} · area ${a.index} · ${hhmm(rec.ts)}</div>
    <h2 style="margin:4px 0 6px">${esc(a.short_name)}</h2>
    ${pill(st)} ${ann ? pill("neutral", "Labelled: " + LEVEL_LABEL[ann.stock_level] + (ann.planogram_compliant ? "" : " · wrong")) : ""}
    <img class="big-crop" src="${cropUrl(cam, img, aid)}" alt="">
    <div class="section-title">Through the day</div>
    <div class="timeline">${h.map(({ r, o }) => `<div class="seg-cell ${o ? o.stock_level : ""} ${o && !o.planogram_compliant ? "wrong-mark" : ""} ${r.image === img ? "cur" : ""}" title="${hhmm(r.ts)} · ${o ? LEVEL_LABEL[o.stock_level] : "?"}${o && !o.planogram_compliant ? " · wrong product" : ""}" data-jump="${r.ts}"></div>`).join("")}</div>
    <div class="timeline-labels"><span>${hhmm(h[0]?.r.ts)}</span><span>${hhmm(h[h.length - 1]?.r.ts)}</span></div>
    <div class="section-title">Why</div>
    <dl class="kv">
      <dt>Planogram</dt><dd>${esc(a.product_name)}</dd>
      <dt>Estimated stock</dt><dd>
        <div class="probbar"><div style="width:${p[0] * 100}%"></div><div style="width:${p[1] * 100}%"></div><div style="width:${p[2] * 100}%"></div></div>
        <span class="small muted">empty ${Math.round(p[0] * 100)}% · half ${Math.round(p[1] * 100)}% · full ${Math.round(p[2] * 100)}% — when unsure it picks the lower level (a missed restock costs more)</span></dd>
      <dt>Product seen</dt><dd>${fam || "—"}</dd>
      <dt>Right product</dt><dd>${Math.round(o.p_compliant * 100)}% confidence</dd>
      <dt>Packaged</dt><dd>${a.packaged ? "Yes (unit = package)" : "No (loose)"}</dd>
    </dl>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="primary" data-goto="${cam}|${aid}">Show on gondola</button>
      <button class="ghost" data-annot="${cam}|${img}|${aid}">Label this photo</button>
    </div>`;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }

/* ---------------- Products ---------------- */
function renderProducts() {
  const prods = {};
  for (const cam of cams()) {
    const snap = snapshot(cam);
    for (const a of areasOf(cam)) {
      const o = obs(cam, snap.image, a.area_id);
      const p = (prods[a.product_id] ||= { id: a.product_id, name: a.short_name, full: a.product_name, family: a.family, areas: [], sum: 0, wrong: 0 });
      p.areas.push({ cam, img: snap.image, a, o });
      p.sum += o ? (o.planogram_compliant ? o.stock_value : 0) : 0;
      if (o && !o.planogram_compliant) p.wrong++;
    }
  }
  const q = S.productFilter.trim().toLowerCase();
  const list = Object.values(prods)
    .filter((p) => !q || p.full.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (FAMILY_LABEL[p.family] || "").toLowerCase().includes(q))
    .map((p) => ({ ...p, fill: p.sum / p.areas.length }))
    .sort((a, b) => a.fill - b.fill || b.wrong - a.wrong);
  const color = (f) => (f <= 0.01 ? "var(--empty)" : f < 0.75 ? "var(--half)" : "var(--full)");
  return `<div class="toolbar"><h2>Products</h2><input type="search" id="prod-q" placeholder="Search product…" value="${esc(S.productFilter)}"><span class="muted">${list.length} products · stock added up over all areas of each product</span></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th><th>Total stock</th><th class="num-cell">Areas</th><th>Each area</th><th></th></tr></thead><tbody>
  ${list.map((p) => `<tr data-open="${p.areas[0].cam}|${p.areas[0].img}|${p.areas[0].a.area_id}">
      <td><div style="font-weight:600">${esc(p.name)}</div><div class="muted small">${esc(p.full)} · ${esc(p.id)}</div></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="fill"><div style="width:${Math.round(p.fill * 100)}%;background:${color(p.fill)}"></div></div><span class="small">${Math.round(p.fill * 100)}%</span></div></td>
      <td class="num-cell">${p.areas.length}</td>
      <td><div class="area-dots">${p.areas.map((x) => `<i class="dot ${statusOf(x.o)}" title="${x.cam} · area ${x.a.index}"></i>`).join("")}</div></td>
      <td>${p.wrong ? pill("wrong", p.wrong + " misplaced") : ""}</td></tr>`).join("")}
  </tbody></table></div>`;
}

/* ---------------- Label ---------------- */
function annCount() {
  let n = 0, imgs = 0;
  for (const cam in S.ann) for (const img in S.ann[cam]) { const k = Object.keys(S.ann[cam][img]).length; n += k; if (k) imgs++; }
  return { n, imgs };
}
const TRAIN = () => S.trainPerCamera || 8;
const isTest = (cam, img) => (S.data.images[cam] || []).findIndex((r) => r.image === img) >= TRAIN();
function ensureAnnSel() {
  if (!S.annCam) S.annCam = store.get("annCam", cams()[0]);
  if (!S.data.images[S.annCam]) S.annCam = cams()[0];
  const list = S.data.images[S.annCam];
  const ok = (img) => list.find((r) => r.image === img) && (S.annTest || !isTest(S.annCam, img));
  if (!S.annImg || !ok(S.annImg)) S.annImg = store.get("annImg", null);
  if (!S.annImg || !ok(S.annImg)) {
    // first train photo that is not fully labelled yet
    const n = areasOf(S.annCam).length;
    const next = list.slice(0, TRAIN()).find((r) => Object.keys(S.ann[S.annCam]?.[r.image] || {}).length < n);
    S.annImg = (next || list[0]).image;
  }
}
function trainProgress(cam) {
  const n = areasOf(cam).length;
  const train = (S.data.images[cam] || []).slice(0, TRAIN());
  const done = train.reduce((s, r) => s + Object.keys(S.ann[cam]?.[r.image] || {}).length, 0);
  return { done, total: n * train.length };
}
function ago(t) {
  const s = Math.max(0, Math.round(Date.now() / 1000 - t));
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}
function renderLive() {
  const people = Object.entries(S.people || {}).sort((a, b) => b[1] - a[1]);
  const all = cams().map((c) => ({ c, ...trainProgress(c) }));
  const sum = all.reduce((s, x) => ({ done: s.done + x.done, total: s.total + x.total }), { done: 0, total: 0 });
  const pct = (d, t) => (t ? (100 * d) / t : 0);
  const feed = (S.activity || []).slice(0, 14).map((e) => {
    const a = S.data.areas[e.area_id];
    const idx = (S.data.images[e.camera] || []).findIndex((r) => r.image === e.image) + 1;
    const what = e.action === "note" ? (e.text ? `note: "${esc(e.text.slice(0, 60))}"` : "note removed") : e.action === "delete" ? "removed" : `${LEVEL_LABEL[e.stock_level]}${e.planogram_compliant ? "" : " · wrong product"}`;
    return `<div class="feed-row" data-annjump="${e.camera}|${e.image}|${e.area_id}"><b>${esc(e.by || "unnamed")}</b> ${e.camera} photo ${idx} · ${a ? a.index + ". " + esc(a.short_name) : esc(e.area_id)} → ${what} <span class="muted">${ago(e.t)}</span></div>`;
  }).join("");
  return `<div class="card live">
      <div style="display:flex;align-items:center;gap:8px"><span class="live-dot"></span><h3>Live</h3><span class="muted small">everyone sees new labels within 3 s</span></div>
      <div class="small" style="margin:8px 0 4px"><b>${sum.done}</b> of ${sum.total} areas labelled (${Math.round(pct(sum.done, sum.total))}%)</div>
      <div class="progress" style="width:100%"><div style="width:${pct(sum.done, sum.total)}%"></div></div>
      <div class="section-title">Per camera</div>
      <div class="cam-progress">${all.map((x) => `<div class="cp ${x.c === S.annCam ? "cur" : ""}" data-anncam="${x.c}" title="${esc(gondolaName(x.c))}"><span>${x.c}</span><div class="progress"><div style="width:${pct(x.done, x.total)}%"></div></div><span class="muted">${x.done}/${x.total}</span></div>`).join("")}</div>
      ${people.length ? `<div class="section-title">Who labelled</div><div class="people">${people.map(([n, k]) => `<span class="pill neutral">${esc(n === "?" || !n ? "unnamed" : n)} · ${k}</span>`).join("")}</div>` : ""}
      <div class="section-title">Latest</div>
      <div class="feed">${feed || `<div class="muted small">Nothing yet.</div>`}</div>
    </div>`;
}
function renderAnnotate() {
  ensureAnnSel();
  const cam = S.annCam, img = S.annImg;
  const list = S.data.images[cam];
  const idx = list.findIndex((r) => r.image === img);
  const areas = areasOf(cam);
  const testPhoto = isTest(cam, img);
  const cards = areas.map((a, i) => {
    const ann = S.ann[cam]?.[img]?.[a.area_id];
    const o = obs(cam, img, a.area_id);
    const lvl = ann?.stock_level;
    const comp = ann ? ann.planogram_compliant : true;
    const note = S.notes?.[cam]?.[img]?.[a.area_id];
    const sus = (S.suspects || []).find((x) => x.key === `${cam}|${img}|${a.area_id}`);
    return `<div class="acard ${i === S.annFocus ? "focus" : ""} ${ann ? "saved" : ""}" data-acard="${i}">
      <img src="${cropUrl(cam, img, a.area_id)}" alt="" loading="lazy">
      <div class="a-name">${a.index}. ${esc(a.short_name)}</div>
      ${sus ? `<div class="suspect">Check: model thinks ${LEVEL_LABEL[sus.model]}${sus.labelled_compliant && sus.p_compliant < 0.1 ? " · wrong product" : ""}${!sus.labelled_compliant && sus.p_compliant > 0.9 ? " · right product" : ""}</div>` : ""}
      <div class="segs">${["empty", "half", "full"].map((l, k) => `<button class="${l} ${lvl === l ? "on" : ""} ${S.annShowPred && o?.stock_level === l ? "pred" : ""}" data-set="${a.area_id}|${l}" title="key ${k + 1}">${LEVEL_LABEL[l]}</button>`).join("")}</div>
      <div class="card-row">
        <button class="comp-toggle ${comp ? "" : "bad"}" data-comp="${a.area_id}" title="key X">${comp ? "Right product" : "WRONG product"}${S.annShowPred && o && !o.planogram_compliant ? " (model: wrong)" : ""}</button>
        <button class="note-btn ${note ? "has" : ""}" data-note="${a.area_id}" title="Add a note (key M)">&#128221;${note ? "" : " Note"}</button>
      </div>
      ${note ? `<div class="note" data-note="${a.area_id}" title="Click to edit">${esc(note.text)} <span class="muted">— ${esc(note.by || "unnamed")}</span></div>` : ""}
    </div>`;
  }).join("");
  const chips = list.map((r, i) => {
    const n = Object.keys(S.ann[cam]?.[r.image] || {}).length;
    const test = i >= TRAIN();
    const locked = test && !S.annTest;
    const state = n === 0 ? "" : n >= areas.length ? "full-done" : "part-done";
    return `<button class="chip ${r.image === img ? "cur" : ""} ${state} ${test ? "test" : ""}" ${locked ? "disabled" : ""} data-annimg="${r.image}" title="${hhmm(r.ts)} · ${n}/${areas.length} labelled${test ? " · held out for testing" : ""}">${test ? "&#128274;" : ""}${i + 1}<small>${hhmm(r.ts)}</small></button>`;
  }).join("");
  return `<div class="ann-head">
      <h2>Label</h2>
      <select id="ann-cam">${cams().map((c) => `<option value="${c}" ${c === cam ? "selected" : ""}>${c} · ${esc(gondolaName(c))}</option>`).join("")}</select>
      <label class="small ${S.annName ? "" : "need"}">Your name <input id="ann-name" value="${esc(S.annName || "")}" placeholder="e.g. Leonor" size="10"></label>
      ${S.suspects?.length ? `<button class="ghost small review-btn" data-review="1" title="Labels the model strongly disagrees with. Check each one with the same rule and fix it if needed.">Review suspects ${Math.min(S.suspIdx + 1, S.suspects.length)}/${S.suspects.length} →</button>` : ""}
      <span class="grow"></span>
      <label class="small"><input type="checkbox" id="ann-pred" ${S.annShowPred ? "checked" : ""}> show prediction</label>
      ${list.length > TRAIN() ? "" : "<!--"}<label class="small" title="Photos ${TRAIN() + 1}-${list.length} are kept to check the model. Only open them when it is time to test."><input type="checkbox" id="ann-test" ${S.annTest ? "checked" : ""}> unlock test photos</label>${list.length > TRAIN() ? "" : "-->"}
      <a class="ghost small" href="/api/export/labels.json">Export</a>
    </div>
    <div class="chips">${chips}</div>
    ${testPhoto ? `<div class="warn">Test photo (${idx + 1} of ${list.length}). Labels here only check the model; they are never used to calibrate it.</div>` : ""}
    <div class="help" style="margin:8px 0 10px"><span><span class="kbd">←</span><span class="kbd">→</span> area</span><span><span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> empty/half/full</span><span><span class="kbd">X</span> wrong product</span><span><span class="kbd">M</span> note</span><span><span class="kbd">Enter</span> accept prediction</span><span><span class="kbd">Del</span> delete</span><span><span class="kbd">N</span>/<span class="kbd">P</span> next/previous photo</span></div>
    <div class="ann-layout">
      <div class="ann-left">${stageSvg(cam, img, { sel: areas[S.annFocus]?.area_id, statusFn: (a) => { const x = S.ann[cam]?.[img]?.[a.area_id]; return x ? (x.planogram_compliant ? x.stock_level : "wrong") : "unknown"; } })}
        <p class="muted small">Sensei's rule: <b>round down</b>. <b>Empty</b> = needs restocking now (nothing, or one or two units left). <b>Full</b> = completely full; one unit missing is already <b>Half</b>. <b>Wrong</b> = the product shown is not the planogram one (an empty area counts as right).</p>
</div>
      <div class="ann-grid">${cards}</div>
    </div>
    <div style="margin-top:16px">${renderLive()}</div>`;
}
async function saveAnn(cam, img, aid, level, comp) {
  if (!S.annName) { toast("Write your name first (top of the page)"); $("#ann-name")?.focus(); return; }
  ((S.ann[cam] ||= {})[img] ||= {})[aid] = { planogram_compliant: comp, stock_level: level, stock_value: { empty: 0, half: 0.5, full: 1 }[level] };
  render();
  try {
    await api(`/api/annotations/${cam}/${encodeURIComponent(img)}/${aid}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ planogram_compliant: comp, stock_level: level, by: S.annName, allow_test: !!S.annTest }) });
    pollLive();
  } catch (e) { toast("Could not save: " + e.message); }
}
async function deleteAnn(cam, img, aid) {
  delete S.ann[cam]?.[img]?.[aid];
  render();
  await api(`/api/annotations/${cam}/${encodeURIComponent(img)}/${aid}?by=${encodeURIComponent(S.annName || "")}`, { method: "DELETE" });
  pollLive();
}
function annNav(d) {
  const list = S.data.images[S.annCam];
  const max = S.annTest ? list.length - 1 : Math.min(list.length, TRAIN()) - 1;
  const i = list.findIndex((r) => r.image === S.annImg);
  const j = Math.max(0, Math.min(max, i + d));
  S.annImg = list[j].image; S.annFocus = 0;
  store.set("annImg", S.annImg);
  render();
}

async function editNote(aid) {
  if (!S.annName) { toast("Write your name first (top of the page)"); $("#ann-name")?.focus(); return; }
  const cam = S.annCam, img = S.annImg;
  const cur = S.notes?.[cam]?.[img]?.[aid]?.text || "";
  const a = S.data.areas[aid];
  const text = prompt(`Note for area ${a.index} (${a.short_name}) — e.g. hand in the way, blurry, unsure. Leave empty to delete.`, cur);
  if (text === null) return;
  (((S.notes ||= {})[cam] ||= {})[img] ||= {});
  if (text.trim()) S.notes[cam][img][aid] = { text: text.trim(), by: S.annName }; else delete S.notes[cam][img][aid];
  render();
  try {
    await api(`/api/notes/${cam}/${encodeURIComponent(img)}/${aid}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, by: S.annName }) });
    pollLive();
  } catch (e) { toast("Could not save the note: " + e.message); }
}

/* Live sync: every open page polls the server, so everyone sees new labels within seconds. */
async function pollLive() {
  clearTimeout(pollLive._t);
  try {
    const r = await api(`/api/live?since=${S.liveVersion ?? -1}`);
    if (r.changed) {
      S.liveVersion = r.version;
      S.ann = r.labels; S.activity = r.activity; S.people = r.people; S.notes = r.notes || {};
      const typing = document.activeElement && document.activeElement.matches("input[type=search],#ann-name");
      if (!typing && (S.tab === "annotate" || S.tab === "eval")) render();
    }
  } catch { /* server restarting: try again */ }
  pollLive._t = setTimeout(pollLive, 3000);
}

/* ---------------- Score ---------------- */
async function renderEval() {
  let rep, job;
  try { [rep, job] = await Promise.all([api("/api/score"), api("/api/run")]); }
  catch (e) { $("#view").innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; return; }
  if (S.tab !== "eval") return;
  const byCam = {};
  for (const r of rep.rows) { const c = (byCam[r.camera] ||= { n: 0, pts: 0 }); c.n++; c.pts += r.points; }
  const errors = rep.rows.filter((r) => r.points < 2).sort((a, b) => a.points - b.points);
  const cal = rep.calibration;
  const lvl = (v) => (v == null ? "—" : LEVEL_LABEL[{ 0: "empty", 0.5: "half", 1: "full" }[v]]);
  $("#view").innerHTML = `
    <div class="eval-layout">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <h3>Score on our labelled areas</h3>
          <p class="muted small">Same rules as the challenge: product +1/−2, stock +1/−2 (below)/−3 (above).</p>
          ${rep.n_areas ? `<div class="score-big">${rep.total} <span class="muted" style="font-size:18px">/ ${rep.maximum}</span></div>
          ${rep.splits ? `<div class="split-row">
            <div><div class="small muted">Photos 1-${TRAIN()} (labelled, used to calibrate)</div><b>${rep.splits.train.total}</b> <span class="muted">/ ${rep.splits.train.maximum}</span></div>
            <div><div class="small muted">Test photos (held out)</div><b>${rep.splits.test.n_areas ? rep.splits.test.total : "—"}</b> <span class="muted">${rep.splits.test.n_areas ? "/ " + rep.splits.test.maximum : "not labelled yet"}</span></div>
          </div>` : ""}
          <table class="tbl" style="box-shadow:none;margin-top:8px"><thead><tr><th>Case</th><th class="num-cell">Areas</th><th class="num-cell">Pts</th></tr></thead><tbody>
          ${rep.table.map((r) => `<tr><td>${esc(CASE_LABEL[r.case] || r.case)}</td><td class="num-cell">${r.areas}</td><td class="num-cell">${r.areas * r.each > 0 ? "+" : ""}${r.areas * r.each}</td></tr>`).join("")}
          </tbody></table>` : `<div class="empty-state">No labels yet. Use the <b>Label</b> tab.</div>`}
        </div>
        <div class="card">
          <h3>Model</h3>
          <p class="small">${esc(S.data.backend)} · ${cal ? `calibrated on ${cal.n} areas (cross-validation ${cal.cv_score}/${cal.cv_max} vs ${cal.label_free_score} label-free)` : "not calibrated (fully label-free)"}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="primary" data-run="1" ${job.running ? "disabled" : ""}>Calibrate on labels and predict</button>
            <button class="ghost" data-run="0" ${job.running ? "disabled" : ""}>Predict again</button>
            <a class="ghost" href="/api/export/predictions.json">Export predictions</a>
          </div>
          ${job.running || job.log.length || job.error ? `<div class="log" style="margin-top:10px">${esc((job.error ? "ERROR: " + job.error + "\n" : "") + job.log.slice(-40).join("\n"))}</div>` : ""}
        </div>
        ${Object.keys(byCam).length ? `<div class="card"><h3>Per camera</h3><table class="tbl" style="box-shadow:none;margin-top:8px"><tbody>
          ${Object.entries(byCam).sort().map(([c, v]) => `<tr><td>${c} · ${esc(gondolaName(c))}</td><td class="num-cell">${v.pts} / ${2 * v.n}</td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>
      <div>
        <div class="toolbar"><h2>Errors</h2><span class="muted">${errors.length} areas with at least one error — worst first</span></div>
        <div class="err-grid">${errors.slice(0, 120).map((r) => `<div class="err" data-open="${r.camera}|${r.image}|${r.area_id}">
          <img loading="lazy" src="${cropUrl(r.camera, r.image, r.area_id)}" alt="">
          <div style="font-weight:600">${esc(S.data.areas[r.area_id]?.short_name || r.area_id)} <span class="muted">${r.points >= 0 ? "+" : ""}${r.points} · ${r.split === "test" ? "test" : "train"}</span></div>
          <div>Stock: predicted <b>${lvl(r.pred?.stock_value)}</b> · real <b>${lvl(r.gt.stock_value)}</b></div>
          <div>Product: predicted <b>${r.pred ? (r.pred.planogram_compliant ? "right" : "wrong") : "—"}</b> · real <b>${r.gt.planogram_compliant ? "right" : "wrong"}</b></div>
        </div>`).join("")}</div>
      </div>
    </div>`;
  if (job.running) setTimeout(() => S.tab === "eval" && renderEval(), 1500);
}

/* ---------------- events ---------------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-open],[data-done],[data-goto],[data-gondola],[data-back],[data-jump],[data-annot],[data-set],[data-comp],[data-annnav],[data-review],[data-note],[data-annimg],[data-anncam],[data-annjump],[data-acard],[data-run],polygon,.drawer-close,.drawer");
  if (!t) return;
  if (t.matches(".drawer") && e.target === t) return closeDrawer();
  if (t.matches(".drawer-close")) return closeDrawer();
  if (t.dataset.tab) return setTab(t.dataset.tab);
  if (t.dataset.done) {
    e.stopPropagation();
    const k = `done:${t.dataset.done}`;
    store.set(k, !store.get(k, false));
    return render();
  }
  if (t.dataset.goto) {
    e.stopPropagation();
    const [cam, aid] = t.dataset.goto.split("|");
    closeDrawer(); S.gondola = cam; S.selArea = aid; return setTab("gondolas");
  }
  if (t.dataset.annot) {
    const [cam, img, aid] = t.dataset.annot.split("|");
    closeDrawer(); S.annCam = cam; S.annImg = img; S.annFocus = areasOf(cam).findIndex((a) => a.area_id === aid); return setTab("annotate");
  }
  if (t.dataset.open) { const [cam, img, aid] = t.dataset.open.split("|"); S.selArea = aid; return openArea(cam, img, aid); }
  if (t.dataset.gondola) { S.gondola = t.dataset.gondola; S.selArea = null; return setTab("gondolas"); }
  if (t.dataset.back !== undefined) { S.gondola = null; return render(); }
  if (t.dataset.jump) { setTime(+t.dataset.jump); const [cam, aid] = [S.gondola || S.data.areas[S.selArea]?.camera, S.selArea]; if (cam && aid) openArea(cam, snapshot(cam).image, aid); return; }
  if (t.dataset.set) {
    const [aid, lvl] = t.dataset.set.split("|");
    const cur = S.ann[S.annCam]?.[S.annImg]?.[aid];
    S.annFocus = areasOf(S.annCam).findIndex((a) => a.area_id === aid);
    return saveAnn(S.annCam, S.annImg, aid, lvl, cur ? cur.planogram_compliant : true);
  }
  if (t.dataset.comp) {
    const aid = t.dataset.comp;
    const cur = S.ann[S.annCam]?.[S.annImg]?.[aid];
    const o = obs(S.annCam, S.annImg, aid);
    S.annFocus = areasOf(S.annCam).findIndex((a) => a.area_id === aid);
    return saveAnn(S.annCam, S.annImg, aid, cur?.stock_level || o?.stock_level || "full", cur ? !cur.planogram_compliant : false);
  }
  if (t.dataset.annnav) return annNav(+t.dataset.annnav);
  if (t.dataset.review) {
    const x = S.suspects[S.suspIdx % S.suspects.length];
    S.suspIdx = (S.suspIdx + 1) % S.suspects.length;
    const [c, i, aid] = x.key.split("|");
    S.annCam = c; S.annImg = i; S.annFocus = areasOf(c).findIndex((q) => q.area_id === aid);
    render();
    document.querySelector(".acard.focus")?.scrollIntoView({ block: "center" });
    return;
  }
  if (t.dataset.note) { S.annFocus = areasOf(S.annCam).findIndex((x) => x.area_id === t.dataset.note); return editNote(t.dataset.note); }
  if (t.dataset.annimg) { S.annImg = t.dataset.annimg; S.annFocus = 0; store.set("annImg", S.annImg); return render(); }
  if (t.dataset.anncam) { S.annCam = t.dataset.anncam; S.annImg = null; S.annFocus = 0; store.set("annCam", S.annCam); return render(); }
  if (t.dataset.annjump) {
    const [c, i, aid] = t.dataset.annjump.split("|");
    if (isTest(c, i) && !S.annTest) return toast("That is a test photo (locked)");
    S.annCam = c; S.annImg = i; S.annFocus = areasOf(c).findIndex((x) => x.area_id === aid); return render();
  }
  if (t.dataset.acard && !e.target.closest("button")) { S.annFocus = +t.dataset.acard; return render(); }
  if (t.dataset.run !== undefined) {
    try { await api("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ calibrate: t.dataset.run === "1" }) }); }
    catch (err) { toast(err.message); }
    renderEval(); pollJob(); return;
  }
  if (t.matches("polygon")) {
    const aid = t.dataset.area;
    const cam = S.data.areas[aid].camera;
    if (S.tab === "annotate") { S.annFocus = areasOf(cam).findIndex((a) => a.area_id === aid); return render(); }
    if (S.tab === "gondolas" && !S.gondola) { S.gondola = cam; S.selArea = aid; return render(); }
    S.selArea = aid; render(); return openArea(cam, snapshot(cam).image, aid);
  }
});

document.addEventListener("input", (e) => {
  if (e.target.id === "time") { setTime(S.times[+e.target.value]); }
  if (e.target.id === "prod-q") { S.productFilter = e.target.value; const pos = e.target.selectionStart; render(); const q = $("#prod-q"); q.focus(); q.setSelectionRange(pos, pos); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "ann-cam") { S.annCam = e.target.value; S.annImg = null; S.annFocus = 0; store.set("annCam", S.annCam); render(); }
  if (e.target.id === "ann-pred") { S.annShowPred = e.target.checked; render(); }
  if (e.target.id === "ann-test") {
    if (e.target.checked && !confirm("Test photos are kept to check the model. Unlock them only when it is time to test. Unlock?")) { e.target.checked = false; return; }
    S.annTest = e.target.checked; S.annImg = null; render();
  }
  if (e.target.id === "ann-name") { S.annName = e.target.value.trim(); store.set("annName", S.annName); render(); }
});
$("#now").addEventListener("click", () => setTime(S.times[S.times.length - 1]));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") return closeDrawer();
  if (S.tab !== "annotate" || e.target.matches("input,select,textarea")) return;
  const areas = areasOf(S.annCam);
  const a = areas[S.annFocus];
  const cur = a && S.ann[S.annCam]?.[S.annImg]?.[a.area_id];
  const o = a && obs(S.annCam, S.annImg, a.area_id);
  const next = () => { S.annFocus = Math.min(areas.length - 1, S.annFocus + 1); };
  const k = e.key.toLowerCase();
  if (k === "arrowright" || k === "tab") { e.preventDefault(); next(); return render(); }
  if (k === "arrowleft") { e.preventDefault(); S.annFocus = Math.max(0, S.annFocus - 1); return render(); }
  if (k === "n" || k === "pagedown") return annNav(1);
  if (k === "p" || k === "pageup") return annNav(-1);
  if (!a) return;
  if (k === "1" || k === "2" || k === "3") {
    const lvl = ["empty", "half", "full"][+k - 1];
    saveAnn(S.annCam, S.annImg, a.area_id, lvl, cur ? cur.planogram_compliant : true); next(); return render();
  }
  if (k === "m") { e.preventDefault(); return editNote(a.area_id); }
  if (k === "x") return saveAnn(S.annCam, S.annImg, a.area_id, cur?.stock_level || o?.stock_level || "full", cur ? !cur.planogram_compliant : false);
  if (k === "enter" && o) { saveAnn(S.annCam, S.annImg, a.area_id, o.stock_level, o.planogram_compliant); next(); return render(); }
  if (k === "delete" || k === "backspace") return deleteAnn(S.annCam, S.annImg, a.area_id);
});

function syncTopbarHeight() {
  const h = document.querySelector(".topbar")?.offsetHeight || 57;
  document.documentElement.style.setProperty("--topbar-h", h + "px");
}
window.addEventListener("resize", syncTopbarHeight);
syncTopbarHeight();

function setTime(ts) {
  S.T = ts;
  const i = S.times.findIndex((t) => t >= ts);
  $("#time").value = i < 0 ? S.times.length - 1 : i;
  render();
}

async function pollJob() {
  const job = await api("/api/run");
  if (job.running) return setTimeout(pollJob, 1500);
  if (!job.error) { await load(); toast("Predictions updated"); }
}

async function load() {
  try {
    S.data = await api("/api/state");
  } catch (e) {
    $("#view").innerHTML = `<div class="empty-state"><h2>No predictions</h2><p>${esc(e.message)}</p><button class="primary" data-run="0">Generate predictions now</button></div>`;
    return;
  }
  try { S.ann = await api("/api/annotations"); } catch { S.ann = {}; }
  try { S.trainPerCamera = (await api("/api/split")).train_per_camera; } catch { /* default 8 */ }
  S.annName = store.get("annName", "");
  try { S.suspects = await api("/api/suspects"); } catch { S.suspects = []; }
  pollLive();
  const all = new Set();
  for (const c of cams()) for (const r of S.data.images[c]) if (r.ts != null) all.add(r.ts);
  S.times = [...all].sort((a, b) => a - b);
  $("#time").max = Math.max(0, S.times.length - 1);
  if (S.T == null) S.T = S.times[S.times.length - 1];
  setTime(S.T);
}

document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === (S.tab = store.get("tab", "tasks"))));
load();
