const DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'], SH = ['Пн','Вт','Ср','Чт','Пт','Сб'];
const BELLS = [['14:10','14:50'],['14:55','15:35'],['15:45','16:25'],['16:30','17:10'],['17:20','18:00'],['18:05','18:45'],['18:50','19:30']]; // 2 смена
const KEY = 'zvonok.lessons.v1';
const $ = q => document.querySelector(q);
const el = (t, a = {}, ...c) => { const e = document.createElement(t); for (const [k, v] of Object.entries(a)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : k === 'class' ? e.className = v : e[k] = v; e.append(...c.flat().filter(x => x != null && x !== false)); return e; };
const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; } };
let lessons = load(), tab = 'today', note = '';
const save = () => localStorage.setItem(KEY, JSON.stringify(lessons));
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short' });
const now = () => { const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value])); return { dow: { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday], sec: +p.hour * 3600 + +p.minute * 60 + +p.second }; };
const sec = t => +t.slice(0, 2) * 3600 + +t.slice(3) * 60;
let selDay = Math.min(now().dow, 6);
const byTime = (a, b) => a.day - b.day || a.start.localeCompare(b.start);

function timerInfo() {
  const n = now(), cur = lessons.find(l => l.day === n.dow && sec(l.start) <= n.sec && n.sec < sec(l.end));
  if (cur) return { k: 'cur', l: cur, t: sec(cur.end) - n.sec };
  let best = null;
  for (const l of lessons) { let t = ((l.day - n.dow + 7) % 7) * 86400 + sec(l.start) - n.sec; if (t <= 0) t += 604800; if (!best || t < best.t) best = { k: 'next', l, t }; }
  return best;
}
const p2 = n => String(n).padStart(2, '0');
const dur = s => (s >= 86400 ? Math.floor(s / 86400) + ' д ' : '') + `${p2(Math.floor(s % 86400 / 3600))}:${p2(Math.floor(s % 3600 / 60))}:${p2(s % 60)}`;
const where = l => [l.room && 'каб. ' + l.room, l.teacher].filter(Boolean).join(' · ');
let tm = null;
function tick() {
  if (!tm || !tm.card.isConnected) return;
  const i = timerInfo();
  tm.card.className = 'timer glass ' + (i?.k || '');
  if (!i) { tm.lb.textContent = 'Расписание пусто'; tm.big.textContent = '—:—'; tm.wh.textContent = 'Добавьте уроки во вкладке «Расписание»'; return; }
  tm.lb.textContent = i.k === 'cur' ? 'Идёт урок, до конца' : 'До следующего урока';
  tm.big.textContent = dur(i.t);
  tm.wh.textContent = `${i.l.subject}${i.k === 'next' ? ` · ${SH[i.l.day - 1]} ${i.l.start}` : ''}${where(i.l) ? ' · ' + where(i.l) : ''}`;
}
const row = l => el('div', { class: 'row', onclick: () => edit(l) }, el('div', { class: 'time' }, l.start, el('small', {}, l.end)), el('div', { class: 'info' }, el('b', {}, l.subject), el('span', {}, where(l) || 'без деталей')));

function viewToday() {
  const n = now(), L = lessons.filter(l => l.day === n.dow).sort(byTime), cur = L.find(l => sec(l.start) <= n.sec && n.sec < sec(l.end)), nxt = L.find(l => sec(l.start) > n.sec);
  tm = { card: el('div'), lb: el('div', { class: 'lb' }), big: el('div', { class: 'big' }), wh: el('div', { class: 'wh' }) };
  tm.card.append(tm.lb, tm.big, tm.wh);
  const v = el('div', {}, el('h1', {}, 'Сегодня'), el('p', { class: 'sub' }, n.dow > 6 ? 'Воскресенье' : DAYS[n.dow - 1]), tm.card);
  if (!L.length) v.append(el('div', { class: 'glass empty' }, n.dow > 6 ? 'Сегодня уроков нет.' : 'На сегодня уроков нет. Добавьте их во вкладке «Расписание».'));
  L.forEach(l => { const r = row(l); if (l === cur) r.classList.add('now'); else if (l === nxt) r.classList.add('next'); v.append(r); });
  setTimeout(tick);
  return v;
}
function viewFull() {
  const v = el('div', {}, el('h1', {}, 'Расписание'), el('p', { class: 'sub' }, DAYS[selDay - 1]));
  v.append(el('div', { class: 'seg glass' }, SH.map((s, i) => el('button', { class: i + 1 === selDay ? 'on' : '', onclick: () => { selDay = i + 1; render(); } }, s))));
  const L = lessons.filter(l => l.day === selDay).sort(byTime);
  if (!L.length) v.append(el('div', { class: 'glass empty' }, 'В этот день уроков нет.'));
  L.forEach(l => v.append(row(l)));
  v.append(el('button', { class: 'btn', onclick: () => edit({ day: selDay }) }, 'Добавить урок'));
  return v;
}
function edit(l) {
  const s = $('#sheet'), f = {}, isNew = !l.id, err = el('div', { class: 'err' });
  const inp = (k, lab, type = 'text') => [el('label', {}, lab), f[k] = el('input', { type, value: l[k] || '' })];
  const preset = el('select', { onchange: e => { const b = BELLS[e.target.value]; if (b) { f.start.value = b[0]; f.end.value = b[1]; } } }, el('option', { value: '' }, 'Подставить время по звонку (2 смена)…'), BELLS.map((b, i) => el('option', { value: i }, `${i + 1} урок ${b[0]}–${b[1]}`)));
  f.day = el('select', {}, DAYS.map((d, i) => el('option', { value: i + 1, selected: i + 1 === l.day }, d)));
  s.replaceChildren(el('h1', {}, isNew ? 'Новый урок' : 'Урок'), el('label', {}, 'День'), f.day, ...inp('subject', 'Название'), ...inp('teacher', 'Учитель'), ...inp('room', 'Кабинет'),
    el('label', {}, 'Время'), preset, el('div', { class: 'two' }, el('div', {}, ...inp('start', 'Начало', 'time')), el('div', {}, ...inp('end', 'Конец', 'time'))), err,
    el('button', { class: 'btn', onclick: () => {
      const b = Object.fromEntries(Object.entries(f).map(([k, e]) => [k, e.value.trim()]));
      if (!b.subject) return err.textContent = 'Введите название урока';
      if (!b.start || !b.end || b.start >= b.end) return err.textContent = 'Укажите время: конец должен быть позже начала';
      b.day = +b.day;
      if (isNew) lessons.push({ id: Date.now() + Math.random(), ...b }); else Object.assign(l, b);
      save(); selDay = b.day; s.close(); render();
    } }, 'Сохранить'),
    !isNew && el('button', { class: 'btn del', onclick: () => { if (confirm('Удалить урок?')) { lessons = lessons.filter(x => x !== l); save(); s.close(); render(); } } }, 'Удалить'),
    el('button', { class: 'btn alt', onclick: () => s.close() }, 'Отмена'));
  s.showModal();
}
function viewSet() {
  const flash = t => { note = t; render(); };
  return el('div', {}, el('h1', {}, 'Настройки'), el('p', { class: 'sub' }, 'Расписание хранится только на этом устройстве'),
    el('p', { class: 'note' }, 'Приложение с главного экрана хранит данные отдельно от Safari. Вводите расписание уже в установленном приложении.'),
    el('button', { class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(JSON.stringify(lessons)); flash('Расписание скопировано. Вставьте его в заметку как резервную копию.'); } catch { prompt('Скопируйте текст вручную:', JSON.stringify(lessons)); } } }, 'Скопировать расписание'),
    el('button', { class: 'btn alt', onclick: () => {
      const t = prompt('Вставьте скопированное расписание:'); if (!t) return;
      try { const v = JSON.parse(t); if (!Array.isArray(v) || v.some(x => !x.subject || !(x.day >= 1 && x.day <= 6) || !x.start || !x.end)) throw 0; lessons = v.map(x => ({ id: Date.now() + Math.random(), day: +x.day, subject: String(x.subject), teacher: String(x.teacher || ''), room: String(x.room || ''), start: x.start, end: x.end })); save(); flash('Расписание загружено');
      } catch { flash('Не удалось прочитать текст. Скопируйте его целиком.'); }
    } }, 'Вставить расписание'),
    el('button', { class: 'btn del', onclick: () => { if (confirm('Удалить всё расписание?')) { lessons = []; save(); flash('Расписание удалено'); } } }, 'Удалить всё расписание'),
    el('p', { class: 'note' }, note),
    el('p', { class: 'note' }, 'Уведомлений нет: сайт без сервера не может присылать их, когда закрыт. Таймер работает, пока приложение открыто.'));
}
function render() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  $('#view').replaceChildren({ today: viewToday, full: viewFull, set: viewSet }[tab]());
}
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; note = ''; render(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
navigator.storage?.persist?.();
render();
setInterval(tick, 1000);
setInterval(() => tab === 'today' && !$('#sheet').open && render(), 30000);
