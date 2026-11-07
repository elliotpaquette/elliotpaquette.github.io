import {config} from './config.js';
import {dayLabel, rangeLabel, sameTime, calendarFile} from './booking-core.mjs';

const el = id => document.getElementById(id);
const state = {token: null, email: '', expiresAt: 0, selected: null, mine: null, open: false, slots: [], busy: false};
const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl) && Boolean(config.publishableKey);
const base = config.supabaseUrl.replace(/\/$/, '');
function message(text, error = false) {
  el('booking-status').textContent = text;
  el('booking-status').classList.toggle('text-danger', error);
}
function signedIn() { return Boolean(state.token && Date.now() < state.expiresAt); }
async function request(path, body, authenticated = false) {
  if (authenticated && !signedIn()) {
    state.token = null;
    render();
    throw new Error('Your verification session expired. Verify your email again; your booking is saved.');
  }
  const headers = {'Content-Type': 'application/json', apikey: config.publishableKey};
  if (authenticated) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${base}${path}`, {method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) { state.token = null; render(); }
    throw new Error(data.msg || data.message || data.error_description || 'The request failed. Please try again.');
  }
  return data;
}
const rpc = (name, args = {}, auth = false) => request(`/rest/v1/rpc/${name}`, args, auth);
async function refresh() {
  const availability = await rpc('exam_availability');
  state.open = availability.open === true;
  state.slots = availability.slots;
  if (signedIn()) state.mine = await rpc('exam_my_booking', {}, true);
  if (state.selected && !state.slots.some(s => sameTime(s.starts_at, state.selected) && s.available)) state.selected = null;
  render();
}
function render() {
  el('email-form').hidden = signedIn() || !state.open;
  el('identity').hidden = !signedIn();
  el('identity-email').textContent = state.email;
  el('verify-form').hidden = signedIn() || !state.email || !state.open;
  el('reserve-form').hidden = !state.open;
  el('full-name').disabled = !signedIn();
  el('confirm-booking').disabled = state.busy || !signedIn() || !state.selected;
  el('confirm-booking').textContent = state.mine ? 'Move my appointment' : 'Book this appointment';
  el('current-booking').hidden = !state.mine;
  el('current-time').textContent = state.mine ? `${dayLabel(state.mine.starts_at)}, ${rangeLabel(state.mine)}` : '';
  el('selected-time').textContent = state.selected ? `Selected: ${dayLabel(state.selected)}, ${rangeLabel(state.slots.find(s => sameTime(s.starts_at, state.selected)))}` : 'Select an available time below.';
  const grid = el('slot-grid');
  grid.replaceChildren();
  if (state.slots.length === 0) {
    const p = document.createElement('p');
    p.textContent = 'Booking is not open yet. Available appointment times will be announced here.';
    grid.append(p);
    return;
  }
  const groups = new Map();
  for (const slot of state.slots) {
    const day = dayLabel(slot.starts_at);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(slot);
  }
  for (const [day, slots] of groups) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = day; section.append(heading);
    const list = document.createElement('div'); list.className = 'exam-slots';
    for (const slot of slots) {
      const mine = sameTime(state.mine?.starts_at, slot.starts_at);
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'exam-slot';
      button.disabled = !state.open || state.busy || !slot.available || mine;
      button.setAttribute('aria-pressed', String(sameTime(state.selected, slot.starts_at)));
      const label = document.createElement('span'); label.textContent = rangeLabel(slot); button.append(label);
      const status = document.createElement('small');
      status.textContent = !state.open ? (slot.priority ? 'Not open yet · Class-time priority' : 'Not open yet') : mine ? 'Your appointment' : slot.blocked ? 'Unavailable' : !slot.available ? 'Booked' : slot.priority ? 'Class-time priority' : 'Available';
      button.append(status);
      if (slot.priority) button.classList.add('exam-priority');
      if (mine) button.classList.add('exam-mine');
      button.addEventListener('click', () => {
        state.selected = slot.starts_at; render();
        message(signedIn() ? 'Enter your full name and confirm your appointment.' : 'Verify your email to book the selected time. It is not reserved yet.');
      });
      list.append(button);
    }
    section.append(list); grid.append(section);
  }
}
async function action(fn) {
  if (state.busy) return;
  state.busy = true;
  document.querySelectorAll('#booking-app form button').forEach(b => { b.disabled = true; });
  try { await fn(); } catch (error) { message(error.message, true); }
  finally {
    state.busy = false;
    document.querySelectorAll('#booking-app form button').forEach(b => { b.disabled = false; });
    render();
  }
}
el('email-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => {
    const email = el('email-address').value.trim().toLowerCase();
    await request('/auth/v1/otp', {email, create_user: true});
    state.email = email;
    el('email-code').value = '';
    message('Check your email for a verification code, then enter it below. No time has been reserved yet.');
    render(); el('email-code').focus();
  });
});
el('verify-form').addEventListener('submit', event => {
  event.preventDefault();
  action(async () => {
    const session = await request('/auth/v1/verify', {email: state.email, token: el('email-code').value.trim(), type: 'email'});
    state.token = session.access_token;
    state.expiresAt = Date.now() + session.expires_in * 1000;
    await refresh();
    if (state.mine) el('full-name').value = state.mine.full_name;
    message(state.mine ? 'Your current appointment is shown below. Select another time to move it.' : 'Email verified. Select a time and confirm your booking.');
  });
});
el('reserve-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.selected) return;
  action(async () => {
    try {
      await rpc('exam_book', {p_start: state.selected, p_full_name: el('full-name').value.trim()}, true);
    } catch (error) {
      try { await refresh(); } catch { /* Keep the booking error visible. */ }
      throw error;
    }
    state.selected = null;
    // Once the write succeeds, do not describe a later read failure as a failed booking.
    try {
      await refresh();
      message('Appointment confirmed. Arrive at the start of your slot in Burnside 925.');
    } catch {
      message('Your appointment was saved, but availability could not refresh. Use Refresh availability to check it.');
    }
  });
});
el('refresh-booking').addEventListener('click', () => action(async () => { await refresh(); message('Availability refreshed.'); }));
el('sign-out').addEventListener('click', () => {
  state.token = null; state.email = ''; state.mine = null; state.selected = null; state.expiresAt = 0;
  el('email-address').value = ''; el('email-code').value = ''; el('full-name').value = '';
  render(); message('Signed out on this page. Your appointment is saved.');
});
el('download-calendar').addEventListener('click', () => {
  if (!state.mine) return;
  const url = URL.createObjectURL(new Blob([calendarFile(state.mine)], {type: 'text/calendar;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = 'final-exam-appointment.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
if (configured) {
  action(async () => { await refresh(); message(state.open ? 'Select a time and verify your email to book or move an appointment.' : 'Booking is not open yet.'); });
  setInterval(() => { if (!document.hidden && !state.busy) action(async () => { await refresh(); }); }, 60000);
} else {
  el('refresh-booking').hidden = true;
  fetch('../booking/published-slots.json').then(response => {
    if (!response.ok) throw new Error('Schedule unavailable');
    return response.json();
  }).then(slots => { state.slots = slots; render(); }).catch(() => render());
  message('These are the planned appointments. Booking is not open yet.');
}
