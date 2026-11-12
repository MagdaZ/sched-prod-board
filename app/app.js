import { fetchIncidents, ack } from './api.js';
import { formatLocal } from './time.js';

const REFRESH_MS = 2000; // R4

const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const list = document.querySelector('[data-testid="incident-list"]');
const errorBox = document.querySelector('[data-role="error"]');
const updated = document.querySelector('[data-role="updated"]');

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

/** Puts the list in the API's order (newest first) and reuses rows that are already on screen. */
function render(incidents) {
  const seen = new Set();
  let prev = null;
  for (const i of incidents) {
    seen.add(i.id);
    let li = rows.get(i.id);
    if (!li) {
      li = buildRow(i);
      rows.set(i.id, li);
    } else {
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
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

let loaded = false;
async function tick() {
  try {
    const page = await fetchIncidents();
    render(page.incidents);
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
