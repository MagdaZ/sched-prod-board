import { fetchIncidents, ack } from './api.js';
import { formatLocal } from './time.js';

const REFRESH_MS = 2000; // R4

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const errorBox = document.querySelector('[data-role="error"]');
const updated = document.querySelector('[data-role="updated"]');
const newBar = document.querySelector('[data-testid="new-bar"]');
const newBarText = newBar.querySelector('span');

/** id -> <li>; rows are kept across refreshes so the acked mark and focus survive (R1, R2). */
const rows = new Map();
const acked = new Set();

function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text; // textContent: API strings never become HTML
  return node;
}

function markAcked(li) {
  const btn = li.querySelector('[data-testid="ack"]');
  if (btn) btn.remove();
  if (!li.querySelector('[data-testid="acked"]')) {
    li.querySelector('.act').append(el('span', { 'data-testid': 'acked', class: 'acked' }, 'Acked'));
  }
  li.classList.add('is-acked');
}

async function onAck(id, li, btn) {
  btn.disabled = true;
  btn.textContent = 'Acking…';
  try {
    await ack(id);
    acked.add(id);
    markAcked(li);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Ack';
    showError(`Ack ${id} failed: ${err.message}`);
  }
}

function buildRow(i) {
  const li = el('li', { 'data-testid': 'incident-row', 'data-id': i.id, class: `row ${i.severity}` });
  li.append(
    el('span', { class: 'id' }, i.id),
    el('span', { class: 'sev' }, i.severity),
    el('span', { class: 'what' }, `${i.service} · ${i.region} · ${i.summary}`),
  );
  const time = el('time', { datetime: i.openedAt, title: i.openedAt }, formatLocal(i.openedAt)); // R5
  const act = el('span', { class: 'act' });
  li.append(time, act);
  if (acked.has(i.id)) {
    markAcked(li);
  } else {
    const btn = el('button', { type: 'button', 'data-testid': 'ack', 'aria-label': `Ack ${i.id}` }, 'Ack');
    btn.addEventListener('click', () => onAck(i.id, li, btn));
    act.append(btn);
  }
  return li;
}

/** Updates a row already on screen in place: text only, so nothing moves. */
function refreshRow(li, i) {
  // keep what is current: the API can move openedAt, severity or summary between refreshes
  li.className = `row ${i.severity}${acked.has(i.id) ? ' is-acked' : ''}`;
  li.querySelector('.sev').textContent = i.severity;
  li.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
  const time = li.querySelector('time');
  if (time.getAttribute('datetime') !== i.openedAt) {
    time.setAttribute('datetime', i.openedAt);
    time.title = i.openedAt;
    time.textContent = formatLocal(i.openedAt);
  }
}

/** Puts the whole list on screen in the API's order (newest first), reusing rows already there. */
function showAll(incidents) {
  const seen = new Set();
  let prev = null;
  for (const i of incidents) {
    seen.add(i.id);
    let li = rows.get(i.id);
    if (!li) {
      li = buildRow(i);
      rows.set(i.id, li);
    } else {
      refreshRow(li, i);
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (want !== li) list.insertBefore(li, want);
    prev = li;
  }
  for (const [id, li] of rows) {
    if (!seen.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }
  const none = incidents.length === 0;
  empty.hidden = !none;
  list.hidden = none;
  setPending(0);
}

// Product's decision (SCHED-4515): the list holds still while it is on screen. A refresh only updates the
// rows already shown; new incidents wait behind the "N new" bar and come in when on-call clicks it.
let latest = [];
function update(incidents) {
  latest = incidents;
  if (rows.size === 0) return showAll(incidents); // nothing on screen yet, so nothing can move
  let pending = 0;
  for (const i of incidents) {
    const li = rows.get(i.id);
    if (li) refreshRow(li, i);
    else pending++;
  }
  setPending(pending);
}

function setPending(n) {
  newBar.dataset.count = String(n);
  newBarText.textContent = n === 1 ? '1 new incident · show' : `${n} new incidents · show`;
  // visibility, not display: the bar keeps its space, so showing it never pushes the rows down
  newBar.classList.toggle('is-on', n > 0);
  newBar.disabled = n === 0;
  newBar.setAttribute('aria-hidden', n > 0 ? 'false' : 'true');
}

newBar.addEventListener('click', () => {
  showAll(latest);
  list.firstElementChild?.querySelector('[data-testid="ack"]')?.focus({ preventScroll: true });
});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

let loaded = false;
async function tick() {
  try {
    const page = await fetchIncidents();
    update(page.incidents);
    errorBox.hidden = true;
    updated.textContent = `· updated ${formatLocal(page.updatedAt, { seconds: true })}`;
    if (!loaded) {
      loaded = true;
      loader.remove(); // R3: gone once incidents load
    }
  } catch (err) {
    showError(`Could not load incidents: ${err.message}`);
  } finally {
    setTimeout(tick, REFRESH_MS); // R4: next refresh starts after this one ends, so calls never overlap
  }
}

tick();
