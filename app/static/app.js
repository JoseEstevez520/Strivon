/* Sensei · Frutas e Legumes — staff dashboard (vanilla JS, no build step). */
"use strict";

const LEVEL_PT = { empty: "Vazio", half: "Meio", full: "Cheio" };
const STATUS_PT = { empty: "Vazio", half: "Pouco stock", full: "Cheio", wrong: "Produto errado" };
const FAMILY_PT = {
  banana: "Banana", plantain: "Banana-pão", citrus_orange: "Laranja / citrinos", lemon: "Limão", lime: "Lima",
  watermelon: "Melancia", melon: "Melão / meloa", apple_green: "Maçã verde/amarela", apple_russet: "Maçã reineta",
  apple_red: "Maçã vermelha", pear: "Pera", kiwi: "Kiwi", leafy: "Alface / couve folha", broccoli: "Brócolo",
  red_cabbage: "Couve roxa", cauliflower: "Couve-flor", cabbage: "Couve", avocado: "Abacate",
  pepper_green: "Pimento verde", pepper_red: "Pimento vermelho", eggplant: "Beringela", chayote: "Chuchu",
  green_beans: "Feijão-verde", cucumber: "Pepino / curgete", tomato: "Tomate", strawberry: "Morango",
  mango: "Manga", grape_red: "Uva tinta", grape_white: "Uva branca", cherry: "Cereja", pineapple: "Ananás",
  pitaya: "Pitaya", guava: "Goiaba", passion_fruit: "Maracujá", papaya: "Papaia", stone_fruit: "Pêssego / nectarina",
  sweet_potato: "Batata-doce", potato: "Batata", ginger: "Gengibre", pumpkin: "Abóbora", onion_red: "Cebola roxa",
  onion: "Cebola", garlic: "Alho", other: "Outro",
};

const CASE_PT = {
  "Identification correct": "Produto: certo", "Identification wrong": "Produto: errado",
  "Stock level correct": "Stock: certo", "Stock level below the real stock": "Stock: abaixo do real",
  "Stock level above the real stock": "Stock: acima do real",
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
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => FAMILY_PT[f] || f);
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
  else if (S.tab === "eval") { v.innerHTML = `<div class="empty-state">A calcular…</div>`; renderEval(); }
  document.querySelectorAll(".clock").forEach((el) => (el.style.visibility = S.tab === "annotate" || S.tab === "eval" ? "hidden" : "visible"));
}

function pill(st, label) {
  return `<span class="pill ${st}">${esc(label ?? STATUS_PT[st] ?? st)}</span>`;
}

/* ---------------- Tarefas ---------------- */
function renderTasks() {
  const { empty, wrong, half, rows } = currentTasks();
  const nC = rows.filter((r) => r.o.planogram_compliant).length;
  const comp = rows.length ? Math.round((100 * nC) / rows.length) : 0;
  const fullN = rows.filter((r) => statusOf(r.o) === "full").length;
  const kpis = `
    <section class="kpis">
      <div class="kpi empty"><span class="num">${empty.length}</span><span class="lbl">Repor já</span><span class="hint">áreas vazias</span></div>
      <div class="kpi wrong"><span class="num">${wrong.length}</span><span class="lbl">Produto fora do sítio</span><span class="hint">não cumpre o planograma</span></div>
      <div class="kpi half"><span class="num">${half.length}</span><span class="lbl">Repor em breve</span><span class="hint">áreas a meio</span></div>
      <div class="kpi ok"><span class="num">${comp}%</span><span class="lbl">Planograma cumprido</span><span class="hint">${fullN} de ${rows.length} áreas cheias</span></div>
    </section>`;
  const group = (cls, step, title, sub, items, note) => `
    <section class="task-group ${cls}">
      <header><span class="step">${step}</span><h2>${title}</h2><span class="muted">${sub}</span></header>
      ${items.length ? `<div class="task-list">${items.map(note).join("")}</div>` : `<div class="empty-state">Nada a fazer aqui ✓</div>`}
    </section>`;
  const card = (t, noteHtml) => `
    <article class="task ${t.done ? "done" : ""}" data-open="${t.cam}|${t.img}|${t.a.area_id}">
      <img loading="lazy" src="${cropUrl(t.cam, t.img, t.a.area_id)}" alt="">
      <div>
        <div class="t-title">${esc(t.a.short_name)}</div>
        <div class="t-where">Gôndola ${t.cam} · área ${t.a.index}</div>
        <div class="t-note">${noteHtml}</div>
        <div class="t-actions">
          <button class="ghost small" data-done="${t.cam}/${t.img}/${t.a.area_id}">${t.done ? "Desfazer" : "Feito"}</button>
          <button class="ghost small" data-goto="${t.cam}|${t.a.area_id}">Ver gôndola</button>
        </div>
      </div>
    </article>`;
  const emptyNote = (t) => {
    const s = since(t.cam, t.a.area_id, t.img, (o) => o && o.planogram_compliant && o.stock_level === "empty");
    const prod = t.product.n > 1 ? ` · ${t.product.empty} de ${t.product.n} áreas deste produto vazias` : "";
    return card(t, `${pill("empty")} desde ${hhmm(s)}${prod}`);
  };
  const wrongNote = (t) => card(t, `${pill("wrong", "Parece " + (FAMILY_PT[t.o.observed_family] || t.o.observed_family))} esperado: ${esc(FAMILY_PT[t.a.family] || t.a.family)}`);
  const halfNote = (t) => {
    const s = since(t.cam, t.a.area_id, t.img, (o) => o && o.planogram_compliant && o.stock_level !== "full");
    return card(t, `${pill("half")} desde ${hhmm(s)}`);
  };
  const side = `
    <aside class="side">
      <div class="card">
        <h3>Gôndolas agora</h3>
        <div class="legend" style="margin-top:6px"><span><i class="dot empty"></i>Vazio</span><span><i class="dot half"></i>Meio</span><span><i class="dot full"></i>Cheio</span><span><i class="dot wrong"></i>Errado</span></div>
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
        Modelo: ${esc(S.data.backend)}${S.data.calibrated ? " · calibrado" : " · sem etiquetas"} · gerado ${esc(S.data.generated_at?.replace("T", " "))}
      </div>
    </aside>`;
  return `${kpis}
    <div class="tasks-layout">
      <div>
        ${group("empty", 1, "Repor já", "prateleiras vazias = vendas perdidas", empty, emptyNote)}
        ${group("wrong", 2, "Arrumar produto", "produto diferente do planograma", wrong, wrongNote)}
        ${group("half", 3, "Repor em breve", "a meio — planear reposição", half, halfNote)}
      </div>
      ${side}
    </div>`;
}

/* ---------------- Gôndolas ---------------- */
function stageSvg(cam, img, { sel = null, labels = true, statusFn = null } = {}) {
  const polys = areasOf(cam).map((a) => {
    const st = statusFn ? statusFn(a) : statusOf(obs(cam, img, a.area_id));
    const pts = a.quad.map((p) => p.join(",")).join(" ");
    const cx = a.quad.reduce((s, p) => s + p[0], 0) / 4, cy = a.quad.reduce((s, p) => s + p[1], 0) / 4;
    return `<polygon class="${st} ${sel === a.area_id ? "sel" : ""}" points="${pts}" data-area="${a.area_id}"><title>${a.index} · ${esc(a.short_name)} — ${esc(STATUS_PT[st] || "")}</title></polygon>
      ${labels ? `<text x="${cx}" y="${cy + 9}" text-anchor="middle">${a.index}</text>` : ""}`;
  }).join("");
  return `<div class="stage"><img src="${imgUrl(cam, img)}" alt="Câmara ${cam}"><svg viewBox="0 0 1280 720" preserveAspectRatio="none">${polys}</svg></div>`;
}

function camCounts(cam, img) {
  const c = { empty: 0, half: 0, full: 0, wrong: 0 };
  for (const a of areasOf(cam)) { const st = statusOf(obs(cam, img, a.area_id)); if (st in c) c[st]++; }
  return c;
}

function renderGondolas() {
  return `<div class="toolbar"><h2>Gôndolas</h2><span class="muted">${cams().length} câmaras · clique numa gôndola para ver as áreas</span></div>
  <div class="gondola-grid">${cams().map((cam) => {
    const snap = snapshot(cam);
    const c = camCounts(cam, snap.image);
    return `<article class="gcard" data-gondola="${cam}">
      <div class="g-head"><div><div class="g-title">${esc(gondolaName(cam))}</div><div class="g-sub">Gôndola ${cam} · imagem das ${hhmm(snap.ts)}</div></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${c.empty ? pill("empty", c.empty + " vazio") : ""}${c.wrong ? pill("wrong", c.wrong + " errado") : ""}${c.half ? pill("half", c.half + " meio") : ""}${!c.empty && !c.wrong && !c.half ? pill("full", "Tudo OK") : ""}</div></div>
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
      <span class="idx">${a.index}</span><span class="nm">${esc(a.short_name)}${a.visible_fraction < 0.95 ? ` <span class="muted small">(${Math.round(a.visible_fraction * 100)}% visível)</span>` : ""}</span>${pill(st)}
    </div>`;
  }).join("");
  return `<div class="detail-head">
      <button class="ghost" data-back>← Gôndolas</button>
      <h2>${esc(gondolaName(cam))}</h2><span class="muted">Gôndola ${cam} · imagem das ${hhmm(snap.ts)}</span>
      <span style="flex:1"></span>
      <div class="legend"><span><i class="dot empty"></i>Vazio</span><span><i class="dot half"></i>Meio</span><span><i class="dot full"></i>Cheio</span><span><i class="dot wrong"></i>Produto errado</span></div>
    </div>
    <div class="detail-layout">
      <div>${stageSvg(cam, snap.image, { sel: S.selArea })}
        <p class="muted small">Toque numa área para ver o detalhe e a evolução ao longo do dia. Use o relógio no topo para ver o estado a outras horas.</p></div>
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
  const fam = Object.entries(o.family_probs || {}).map(([f, p]) => `${esc(FAMILY_PT[f] || f)} ${Math.round(p * 100)}%`).join(" · ");
  const p = o.p_stock || [0, 0, 0];
  $("#drawer-body").innerHTML = `
    <div class="small muted">${esc(gondolaName(cam))} · gôndola ${cam} · área ${a.index} · ${hhmm(rec.ts)}</div>
    <h2 style="margin:4px 0 6px">${esc(a.short_name)}</h2>
    ${pill(st)} ${ann ? pill("neutral", "Anotado: " + LEVEL_PT[ann.stock_level] + (ann.planogram_compliant ? "" : " · errado")) : ""}
    <img class="big-crop" src="${cropUrl(cam, img, aid)}" alt="">
    <div class="section-title">Ao longo do dia</div>
    <div class="timeline">${h.map(({ r, o }) => `<div class="seg-cell ${o ? o.stock_level : ""} ${o && !o.planogram_compliant ? "wrong-mark" : ""} ${r.image === img ? "cur" : ""}" title="${hhmm(r.ts)} · ${o ? LEVEL_PT[o.stock_level] : "?"}${o && !o.planogram_compliant ? " · produto errado" : ""}" data-jump="${r.ts}"></div>`).join("")}</div>
    <div class="timeline-labels"><span>${hhmm(h[0]?.r.ts)}</span><span>${hhmm(h[h.length - 1]?.r.ts)}</span></div>
    <div class="section-title">Porquê</div>
    <dl class="kv">
      <dt>Planograma</dt><dd>${esc(a.product_name)}</dd>
      <dt>Stock estimado</dt><dd>
        <div class="probbar"><div style="width:${p[0] * 100}%"></div><div style="width:${p[1] * 100}%"></div><div style="width:${p[2] * 100}%"></div></div>
        <span class="small muted">vazio ${Math.round(p[0] * 100)}% · meio ${Math.round(p[1] * 100)}% · cheio ${Math.round(p[2] * 100)}% — na dúvida o sistema escolhe o nível mais baixo (falhar uma reposição custa mais)</span></dd>
      <dt>Produto visto</dt><dd>${fam || "—"}</dd>
      <dt>Planograma cumprido</dt><dd>${Math.round(o.p_compliant * 100)}% de confiança</dd>
      <dt>Embalado</dt><dd>${a.packaged ? "Sim (unidade = embalagem)" : "Não (a granel)"}</dd>
    </dl>
    <div style="display:flex;gap:8px;margin-top:18px">
      <button class="primary" data-goto="${cam}|${aid}">Ver na gôndola</button>
      <button class="ghost" data-annot="${cam}|${img}|${aid}">Anotar esta imagem</button>
    </div>`;
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); }

/* ---------------- Produtos ---------------- */
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
    .filter((p) => !q || p.full.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (FAMILY_PT[p.family] || "").toLowerCase().includes(q))
    .map((p) => ({ ...p, fill: p.sum / p.areas.length }))
    .sort((a, b) => a.fill - b.fill || b.wrong - a.wrong);
  const color = (f) => (f <= 0.01 ? "var(--empty)" : f < 0.75 ? "var(--half)" : "var(--full)");
  return `<div class="toolbar"><h2>Produtos</h2><input type="search" id="prod-q" placeholder="Procurar produto…" value="${esc(S.productFilter)}"><span class="muted">${list.length} produtos · stock somado por produto (todas as áreas)</span></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Produto</th><th>Stock total</th><th class="num-cell">Áreas</th><th>Estado por área</th><th></th></tr></thead><tbody>
  ${list.map((p) => `<tr data-open="${p.areas[0].cam}|${p.areas[0].img}|${p.areas[0].a.area_id}">
      <td><div style="font-weight:600">${esc(p.name)}</div><div class="muted small">${esc(p.full)} · ${esc(p.id)}</div></td>
      <td><div style="display:flex;align-items:center;gap:8px"><div class="fill"><div style="width:${Math.round(p.fill * 100)}%;background:${color(p.fill)}"></div></div><span class="small">${Math.round(p.fill * 100)}%</span></div></td>
      <td class="num-cell">${p.areas.length}</td>
      <td><div class="area-dots">${p.areas.map((x) => `<i class="dot ${statusOf(x.o)}" title="${x.cam} · área ${x.a.index}"></i>`).join("")}</div></td>
      <td>${p.wrong ? pill("wrong", p.wrong + " fora do sítio") : ""}</td></tr>`).join("")}
  </tbody></table></div>`;
}

/* ---------------- Anotar ---------------- */
function annCount() {
  let n = 0, imgs = 0;
  for (const cam in S.ann) for (const img in S.ann[cam]) { const k = Object.keys(S.ann[cam][img]).length; n += k; if (k) imgs++; }
  return { n, imgs };
}
function ensureAnnSel() {
  if (!S.annCam) S.annCam = store.get("annCam", cams()[0]);
  if (!S.data.images[S.annCam]) S.annCam = cams()[0];
  const list = S.data.images[S.annCam];
  if (!S.annImg || !list.find((r) => r.image === S.annImg)) S.annImg = store.get("annImg", null);
  if (!S.annImg || !list.find((r) => r.image === S.annImg)) S.annImg = list[Math.floor(list.length / 2)].image;
}
function renderAnnotate() {
  ensureAnnSel();
  const cam = S.annCam, img = S.annImg;
  const list = S.data.images[cam];
  const idx = list.findIndex((r) => r.image === img);
  const areas = areasOf(cam);
  const done = areas.filter((a) => S.ann[cam]?.[img]?.[a.area_id]).length;
  const tot = annCount();
  const cards = areas.map((a, i) => {
    const ann = S.ann[cam]?.[img]?.[a.area_id];
    const o = obs(cam, img, a.area_id);
    const lvl = ann?.stock_level;
    const comp = ann ? ann.planogram_compliant : true;
    return `<div class="acard ${i === S.annFocus ? "focus" : ""} ${ann ? "saved" : ""}" data-acard="${i}">
      <img src="${cropUrl(cam, img, a.area_id)}" alt="" loading="lazy">
      <div class="a-name">${a.index}. ${esc(a.short_name)}</div>
      <div class="segs">${["empty", "half", "full"].map((l, k) => `<button class="${l} ${lvl === l ? "on" : ""} ${S.annShowPred && o?.stock_level === l ? "pred" : ""}" data-set="${a.area_id}|${l}" title="tecla ${k + 1}">${LEVEL_PT[l]}</button>`).join("")}</div>
      <button class="comp-toggle ${comp ? "" : "bad"}" data-comp="${a.area_id}" title="tecla X">${comp ? "Produto certo" : "Produto ERRADO"}${S.annShowPred && o && !o.planogram_compliant ? " (modelo: errado)" : ""}</button>
    </div>`;
  }).join("");
  return `<div class="ann-head">
      <h2>Anotar</h2>
      <select id="ann-cam">${cams().map((c) => `<option value="${c}" ${c === cam ? "selected" : ""}>${c} · ${esc(gondolaName(c))}</option>`).join("")}</select>
      <button class="ghost" data-annnav="-1" ${idx <= 0 ? "disabled" : ""}>← Anterior</button>
      <strong>${hhmm(list[idx].ts)}</strong><span class="muted small">${esc(img)} (${idx + 1}/${list.length})</span>
      <button class="ghost" data-annnav="1" ${idx >= list.length - 1 ? "disabled" : ""}>Seguinte →</button>
      <span class="grow"></span>
      <label class="small"><input type="checkbox" id="ann-pred" ${S.annShowPred ? "checked" : ""}> mostrar previsão</label>
      <div title="${tot.n} áreas anotadas em ${tot.imgs} imagens"><div class="small muted">${done}/${areas.length} nesta imagem · ${tot.n} no total</div><div class="progress"><div style="width:${(100 * done) / areas.length}%"></div></div></div>
      <a class="ghost small" href="/api/export/annotations.json">Exportar</a>
    </div>
    <div class="help" style="margin-bottom:10px"><span><span class="kbd">←</span><span class="kbd">→</span> área</span><span><span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> vazio/meio/cheio</span><span><span class="kbd">X</span> produto errado</span><span><span class="kbd">Enter</span> aceitar previsão</span><span><span class="kbd">Del</span> apagar</span><span><span class="kbd">N</span>/<span class="kbd">P</span> imagem seguinte/anterior</span></div>
    <div class="ann-layout">
      <div style="position:sticky;top:78px">${stageSvg(cam, img, { sel: areas[S.annFocus]?.area_id, statusFn: (a) => { const x = S.ann[cam]?.[img]?.[a.area_id]; return x ? (x.planogram_compliant ? x.stock_level : "wrong") : "unknown"; } })}
        <p class="muted small">Critério: <b>Vazio</b> = vê-se o fundo quase todo; <b>Meio</b> = falta claramente produto; <b>Cheio</b> = área coberta. <b>Errado</b> = o produto visível não é o do planograma (área vazia conta como certa).</p></div>
      <div class="ann-grid">${cards}</div>
    </div>`;
}
async function saveAnn(cam, img, aid, level, comp) {
  ((S.ann[cam] ||= {})[img] ||= {})[aid] = { planogram_compliant: comp, stock_level: level, stock_value: { empty: 0, half: 0.5, full: 1 }[level] };
  render();
  try { await api(`/api/annotations/${cam}/${encodeURIComponent(img)}/${aid}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ planogram_compliant: comp, stock_level: level }) }); }
  catch (e) { toast("Erro a gravar: " + e.message); }
}
async function deleteAnn(cam, img, aid) {
  delete S.ann[cam]?.[img]?.[aid];
  render();
  await api(`/api/annotations/${cam}/${encodeURIComponent(img)}/${aid}`, { method: "DELETE" });
}
function annNav(d) {
  const list = S.data.images[S.annCam];
  const i = list.findIndex((r) => r.image === S.annImg);
  const j = Math.max(0, Math.min(list.length - 1, i + d));
  S.annImg = list[j].image; S.annFocus = 0;
  store.set("annImg", S.annImg);
  render();
}

/* ---------------- Avaliação ---------------- */
async function renderEval() {
  let rep, job;
  try { [rep, job] = await Promise.all([api("/api/score"), api("/api/run")]); }
  catch (e) { $("#view").innerHTML = `<div class="empty-state">${esc(e.message)}</div>`; return; }
  if (S.tab !== "eval") return;
  const byCam = {};
  for (const r of rep.rows) { const c = (byCam[r.camera] ||= { n: 0, pts: 0 }); c.n++; c.pts += r.points; }
  const errors = rep.rows.filter((r) => r.points < 2).sort((a, b) => a.points - b.points);
  const cal = rep.calibration;
  const lvl = (v) => (v == null ? "—" : LEVEL_PT[{ 0: "empty", 0.5: "half", 1: "full" }[v]]);
  $("#view").innerHTML = `
    <div class="eval-layout">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card">
          <h3>Pontuação nas áreas anotadas pela equipa</h3>
          <p class="muted small">Mesmas regras do desafio: identificação +1/−2, stock +1/−2 (abaixo)/−3 (acima).</p>
          ${rep.n_areas ? `<div class="score-big">${rep.total} <span class="muted" style="font-size:18px">/ ${rep.maximum}</span></div>
          <table class="tbl" style="box-shadow:none;margin-top:8px"><thead><tr><th>Caso</th><th class="num-cell">Áreas</th><th class="num-cell">Pts</th></tr></thead><tbody>
          ${rep.table.map((r) => `<tr><td>${esc(CASE_PT[r.case] || r.case)}</td><td class="num-cell">${r.areas}</td><td class="num-cell">${r.areas * r.each > 0 ? "+" : ""}${r.areas * r.each}</td></tr>`).join("")}
          </tbody></table>` : `<div class="empty-state">Ainda não há anotações. Use o separador <b>Anotar</b>.</div>`}
        </div>
        <div class="card">
          <h3>Modelo</h3>
          <p class="small">${esc(S.data.backend)} · ${cal ? `calibrado com ${cal.n} áreas (validação cruzada ${cal.cv_score}/${cal.cv_max} vs ${cal.label_free_score} sem calibração)` : "sem calibração (100% sem etiquetas)"}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="primary" data-run="1" ${job.running ? "disabled" : ""}>Calibrar com anotações e prever</button>
            <button class="ghost" data-run="0" ${job.running ? "disabled" : ""}>Só voltar a prever</button>
            <a class="ghost" href="/api/export/submission.json">Exportar submissão</a>
          </div>
          ${job.running || job.log.length || job.error ? `<div class="log" style="margin-top:10px">${esc((job.error ? "ERRO: " + job.error + "\n" : "") + job.log.slice(-40).join("\n"))}</div>` : ""}
        </div>
        ${Object.keys(byCam).length ? `<div class="card"><h3>Por gôndola</h3><table class="tbl" style="box-shadow:none;margin-top:8px"><tbody>
          ${Object.entries(byCam).sort().map(([c, v]) => `<tr><td>${c} · ${esc(gondolaName(c))}</td><td class="num-cell">${v.pts} / ${2 * v.n}</td></tr>`).join("")}</tbody></table></div>` : ""}
      </div>
      <div>
        <div class="toolbar"><h2>Erros</h2><span class="muted">${errors.length} áreas com pelo menos um erro — os piores primeiro</span></div>
        <div class="err-grid">${errors.slice(0, 120).map((r) => `<div class="err" data-open="${r.camera}|${r.image}|${r.area_id}">
          <img loading="lazy" src="${cropUrl(r.camera, r.image, r.area_id)}" alt="">
          <div style="font-weight:600">${esc(S.data.areas[r.area_id]?.short_name || r.area_id)} <span class="muted">${r.points >= 0 ? "+" : ""}${r.points}</span></div>
          <div>Stock: previsto <b>${lvl(r.pred?.stock_value)}</b> · real <b>${lvl(r.gt.stock_value)}</b></div>
          <div>Planograma: previsto <b>${r.pred ? (r.pred.planogram_compliant ? "certo" : "errado") : "—"}</b> · real <b>${r.gt.planogram_compliant ? "certo" : "errado"}</b></div>
        </div>`).join("")}</div>
      </div>
    </div>`;
  if (job.running) setTimeout(() => S.tab === "eval" && renderEval(), 1500);
}

/* ---------------- events ---------------- */
document.addEventListener("click", async (e) => {
  const t = e.target.closest("[data-tab],[data-open],[data-done],[data-goto],[data-gondola],[data-back],[data-jump],[data-annot],[data-set],[data-comp],[data-annnav],[data-acard],[data-run],polygon,.drawer-close,.drawer");
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
  if (k === "x") return saveAnn(S.annCam, S.annImg, a.area_id, cur?.stock_level || o?.stock_level || "full", cur ? !cur.planogram_compliant : false);
  if (k === "enter" && o) { saveAnn(S.annCam, S.annImg, a.area_id, o.stock_level, o.planogram_compliant); next(); return render(); }
  if (k === "delete" || k === "backspace") return deleteAnn(S.annCam, S.annImg, a.area_id);
});

function setTime(ts) {
  S.T = ts;
  const i = S.times.findIndex((t) => t >= ts);
  $("#time").value = i < 0 ? S.times.length - 1 : i;
  render();
}

async function pollJob() {
  const job = await api("/api/run");
  if (job.running) return setTimeout(pollJob, 1500);
  if (!job.error) { await load(); toast("Previsões atualizadas"); }
}

async function load() {
  try {
    S.data = await api("/api/state");
  } catch (e) {
    $("#view").innerHTML = `<div class="empty-state"><h2>Sem previsões</h2><p>${esc(e.message)}</p><button class="primary" data-run="0">Gerar previsões agora</button></div>`;
    return;
  }
  try { S.ann = await api("/api/annotations"); } catch { S.ann = {}; }
  const all = new Set();
  for (const c of cams()) for (const r of S.data.images[c]) if (r.ts != null) all.add(r.ts);
  S.times = [...all].sort((a, b) => a - b);
  $("#time").max = Math.max(0, S.times.length - 1);
  if (S.T == null) S.T = S.times[S.times.length - 1];
  setTime(S.T);
}

document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === (S.tab = store.get("tab", "tasks"))));
load();
