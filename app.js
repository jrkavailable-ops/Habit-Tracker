/* Streaks — a tiny habit tracker.
   No accounts, no server: everything lives in localStorage on this device. */
(function () {
  'use strict';

  var KEY = 'habitTracker.v1';
  var DAY_LETTERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var COLORS = ['#4f7cff', '#22a06b', '#e0483d', '#f0a020', '#9b5de5', '#12b0c6', '#e5679a', '#7a8699'];
  var EMOJIS = ['✅', '💧', '🏃', '🏋️', '🧘', '📖', '✍️', '🥗', '💊', '🛏️', '🦷', '🧹', '💰', '📵', '🚭', '🎸', '🌿', '☀️', '🐕', '🎯'];
  var SUGGESTIONS = [
    { emoji: '💧', name: 'Drink 2L of water', goal: 7 },
    { emoji: '🏃', name: 'Move for 30 min', goal: 4 },
    { emoji: '📖', name: 'Read 10 pages', goal: 7 },
    { emoji: '🧘', name: 'Meditate', goal: 5 },
    { emoji: '🛏️', name: 'Lights out by 11', goal: 7 }
  ];

  /* ---------------- storage ---------------- */

  function blank() { return { version: 1, habits: [], done: {} }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.habits)) return blank();
      data.done = data.done && typeof data.done === 'object' ? data.done : {};
      return data;
    } catch (e) {
      return blank();
    }
  }

  var state = load();
  var saveFailed = false;

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      if (!saveFailed) {
        saveFailed = true;
        toast('Could not save — storage is full or blocked');
      }
    }
  }

  /* ---------------- dates ---------------- */

  function iso(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function addDays(d, n) { var c = new Date(d.getTime()); c.setDate(c.getDate() + n); c.setHours(0, 0, 0, 0); return c; }
  function startOfWeek(d) { var c = new Date(d.getTime()); c.setHours(0, 0, 0, 0); var wd = (c.getDay() + 6) % 7; return addDays(c, -wd); }
  function sameDay(a, b) { return iso(a) === iso(b); }

  /* ---------------- model helpers ---------------- */

  function isDone(habit, date) {
    var log = state.done[habit.id];
    return !!(log && log[iso(date)]);
  }

  function toggle(habit, date) {
    var k = iso(date);
    var log = state.done[habit.id] || (state.done[habit.id] = {});
    if (log[k]) delete log[k]; else log[k] = 1;
    save();
    return !!log[k];
  }

  function countInWeek(habit, anyDayInWeek) {
    var start = startOfWeek(anyDayInWeek), n = 0;
    for (var i = 0; i < 7; i++) if (isDone(habit, addDays(start, i))) n++;
    return n;
  }

  /* Daily habits streak in days; weekly-target habits streak in weeks hitting the target. */
  function streak(habit) {
    var t = today();
    if (habit.goal >= 7) {
      var cursor = isDone(habit, t) ? t : addDays(t, -1);
      var days = 0;
      while (isDone(habit, cursor) && days < 3650) { days++; cursor = addDays(cursor, -1); }
      return { n: days, unit: 'd' };
    }
    var week = startOfWeek(t);
    if (countInWeek(habit, week) < habit.goal) week = addDays(week, -7);
    var weeks = 0;
    while (countInWeek(habit, week) >= habit.goal && weeks < 520) { weeks++; week = addDays(week, -7); }
    return { n: weeks, unit: 'w' };
  }

  function completionsIn(habit, days) {
    var t = today(), n = 0;
    for (var i = 0; i < days; i++) if (isDone(habit, addDays(t, -i))) n++;
    return n;
  }

  /* Expected check-ins over the window, prorated for habits created recently. */
  function expectedIn(habit, days) {
    var created = habit.createdAt ? new Date(habit.createdAt) : today();
    created.setHours(0, 0, 0, 0);
    var age = Math.floor((today() - created) / 86400000) + 1;
    var window = Math.max(1, Math.min(days, age));
    return Math.max(1, Math.round(window * habit.goal / 7));
  }

  function rate(habit, days) {
    return Math.min(100, Math.round(100 * completionsIn(habit, days) / expectedIn(habit, days)));
  }

  function totalCheckins() {
    var n = 0;
    for (var id in state.done) if (Object.prototype.hasOwnProperty.call(state.done, id)) {
      n += Object.keys(state.done[id]).length;
    }
    return n;
  }

  /* ---------------- tiny DOM helpers ---------------- */

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var toastTimer;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }
  function buzz() { if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} } }

  /* ---------------- view state ---------------- */

  var view = 'today';
  var selectedDay = today();
  var weekOffset = 0;

  function go(name) {
    view = name;
    ['today', 'week', 'stats'].forEach(function (v) {
      $('view-' + v).hidden = v !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.dataset.goto === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (name === 'week') weekOffset = 0;
    window.scrollTo(0, 0);
    render();
  }

  /* ---------------- render: today ---------------- */

  function renderDayBar() {
    var bar = $('dayBar'), t = today(), html = '';
    for (var i = 6; i >= 0; i--) {
      var d = addDays(t, -i);
      var cls = 'day' + (sameDay(d, selectedDay) ? ' is-selected' : '') + (sameDay(d, t) ? ' is-today' : '');
      html += '<button class="' + cls + '" data-day="' + iso(d) + '">' +
        '<span>' + DAY_LETTERS[(d.getDay() + 6) % 7].charAt(0) + '</span><b>' + d.getDate() + '</b></button>';
    }
    bar.innerHTML = html;
  }

  function renderToday() {
    var t = today();
    if (selectedDay > t) selectedDay = t;

    $('todayDate').textContent = selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    var diff = Math.round((t - selectedDay) / 86400000);
    $('todayTitle').textContent = diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : selectedDay.toLocaleDateString(undefined, { weekday: 'long' });

    renderDayBar();

    var habits = state.habits;
    $('todayEmpty').hidden = habits.length > 0;
    $('dayBar').hidden = habits.length === 0;
    $('ring').hidden = habits.length === 0;

    var doneCount = habits.filter(function (h) { return isDone(h, selectedDay); }).length;
    var pct = habits.length ? doneCount / habits.length : 0;
    $('ringFg').style.strokeDashoffset = String(119.4 * (1 - pct));
    $('ringLabel').textContent = doneCount + '/' + habits.length;

    var html = habits.map(function (h) {
      var done = isDone(h, selectedDay);
      var s = streak(h);
      var wk = countInWeek(h, selectedDay);
      var sub = [];
      sub.push('<span class="pill">' + (h.goal >= 7 ? wk + '/7 this week' : wk + '/' + h.goal + ' this week') + '</span>');
      if (s.n > 0) sub.push('<span>🔥 ' + s.n + (s.unit === 'w' ? ' week' + (s.n > 1 ? 's' : '') : ' day' + (s.n > 1 ? 's' : '')) + '</span>');
      return '' +
        '<div class="card habit' + (done ? ' is-done' : '') + '" style="--c:' + esc(h.color) + '" data-id="' + esc(h.id) + '">' +
          '<div class="habit-ico">' + esc(h.emoji) + '</div>' +
          '<button class="habit-main" data-edit="' + esc(h.id) + '" aria-label="Edit ' + esc(h.name) + '">' +
            '<div class="habit-name">' + esc(h.name) + '</div>' +
            '<div class="habit-sub">' + sub.join('') + '</div>' +
          '</button>' +
          '<button class="check" data-toggle="' + esc(h.id) + '" role="checkbox" aria-checked="' + done + '" ' +
            'aria-label="Mark ' + esc(h.name) + ' done">✓</button>' +
        '</div>';
    }).join('');
    $('todayList').innerHTML = html;
  }

  /* ---------------- render: week ---------------- */

  function renderWeek() {
    var start = addDays(startOfWeek(today()), weekOffset * 7);
    var end = addDays(start, 6);
    var fmt = { month: 'short', day: 'numeric' };
    $('weekRange').textContent = start.toLocaleDateString(undefined, fmt) + ' – ' + end.toLocaleDateString(undefined, fmt);
    $('weekNext').disabled = weekOffset >= 0;
    $('weekNext').style.opacity = weekOffset >= 0 ? '.4' : '1';

    if (!state.habits.length) {
      $('weekGrid').innerHTML = '';
      $('weekHint').textContent = 'Add a habit first — it will show up here.';
      return;
    }
    $('weekHint').textContent = 'Tap any square to fill in a day you forgot to log.';

    var t = today();
    var head = '<tr><th class="name-col">Habit</th>';
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      head += '<th>' + DAY_LETTERS[i].charAt(0) + '<br>' + d.getDate() + '</th>';
    }
    head += '</tr>';

    var rows = state.habits.map(function (h) {
      var cells = '';
      for (var i = 0; i < 7; i++) {
        var d = addDays(start, i);
        var future = d > t;
        var on = isDone(h, d);
        cells += '<td><button class="dot' + (on ? ' on' : '') + (future ? ' future' : '') + (sameDay(d, t) ? ' today' : '') + '"' +
          ' data-cell="' + esc(h.id) + '|' + iso(d) + '"' + (future ? ' disabled' : '') +
          ' aria-label="' + esc(h.name) + ' on ' + iso(d) + '">✓</button></td>';
      }
      return '<tr style="--c:' + esc(h.color) + '"><td class="name-col"><div class="cell-name">' +
        '<span aria-hidden="true">' + esc(h.emoji) + '</span><span>' + esc(h.name) + '</span></div></td>' + cells + '</tr>';
    }).join('');

    $('weekGrid').innerHTML = '<thead>' + head + '</thead><tbody>' + rows + '</tbody>';
  }

  /* ---------------- render: stats ---------------- */

  function renderStats() {
    var habits = state.habits;
    var best = 0;
    habits.forEach(function (h) { var s = streak(h); if (s.n > best) best = s.n; });

    var overall = 0;
    if (habits.length) {
      var sum = 0;
      habits.forEach(function (h) { sum += rate(h, 30); });
      overall = Math.round(sum / habits.length);
    }

    $('statTiles').innerHTML =
      '<div class="tile"><b>' + overall + '%</b><span>consistency</span></div>' +
      '<div class="tile"><b>' + best + '</b><span>best streak</span></div>' +
      '<div class="tile"><b>' + totalCheckins() + '</b><span>check-ins</span></div>';

    if (!habits.length) {
      $('statList').innerHTML = '<div class="card stat-row"><p class="muted">No habits yet. Add one and your progress shows up here.</p></div>';
      return;
    }

    $('statList').innerHTML = habits.map(function (h) {
      var r = rate(h, 30);
      var s = streak(h);
      return '<div class="card stat-row" style="--c:' + esc(h.color) + '">' +
        '<div class="stat-head"><b>' + esc(h.emoji) + ' ' + esc(h.name) + '</b>' +
        '<em>' + completionsIn(h, 30) + '/' + expectedIn(h, 30) + (s.n ? ' · 🔥' + s.n + s.unit : '') + '</em></div>' +
        '<div class="bar"><i style="width:' + r + '%"></i></div></div>';
    }).join('');
  }

  function render() {
    if (view === 'today') renderToday();
    else if (view === 'week') renderWeek();
    else renderStats();
  }

  /* ---------------- editor sheet ---------------- */

  var editingId = null;
  var draft = { emoji: EMOJIS[0], color: COLORS[0], goal: 7 };

  function paintSheetPickers() {
    $('emojiRow').innerHTML = EMOJIS.map(function (e) {
      return '<button type="button" class="emo' + (e === draft.emoji ? ' on' : '') + '" data-emoji="' + e + '">' + e + '</button>';
    }).join('');
    $('swatchRow').innerHTML = COLORS.map(function (c) {
      return '<button type="button" class="sw' + (c === draft.color ? ' on' : '') + '" style="--c:' + c + '" data-color="' + c + '" aria-label="colour ' + c + '"></button>';
    }).join('');
    var chips = '';
    for (var n = 1; n <= 7; n++) {
      chips += '<button type="button" class="chip' + (n === draft.goal ? ' on' : '') + '" data-goal="' + n + '">' + n + '</button>';
    }
    $('goalRow').innerHTML = chips;
    $('goalHint').textContent = draft.goal >= 7 ? 'every day' : draft.goal + '× per week';
  }

  function openSheet(habit, prefill) {
    editingId = habit ? habit.id : null;
    draft = habit
      ? { emoji: habit.emoji, color: habit.color, goal: habit.goal }
      : { emoji: (prefill && prefill.emoji) || EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
          color: COLORS[state.habits.length % COLORS.length],
          goal: (prefill && prefill.goal) || 7 };
    $('fName').value = habit ? habit.name : (prefill && prefill.name) || '';
    $('sheetTitle').textContent = habit ? 'Edit habit' : 'New habit';
    $('saveBtn').textContent = habit ? 'Save changes' : 'Add habit';
    $('deleteBtn').hidden = !habit;
    paintSheetPickers();
    $('scrim').hidden = false;
    $('sheet').hidden = false;
    if (!habit) setTimeout(function () { $('fName').focus(); }, 250);
  }

  function closeSheet() {
    $('scrim').hidden = true;
    $('sheet').hidden = true;
    editingId = null;
  }

  /* ---------------- events ---------------- */

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-goto],[data-day],[data-toggle],[data-edit],[data-cell],[data-emoji],[data-color],[data-goal],[data-sugg]') : null;
    if (!el) return;
    var d = el.dataset;

    if (d.goto) { go(d.goto); return; }

    if (d.day) {
      var parts = d.day.split('-');
      selectedDay = new Date(+parts[0], +parts[1] - 1, +parts[2]);
      renderToday();
      return;
    }

    if (d.toggle) {
      var h = state.habits.filter(function (x) { return x.id === d.toggle; })[0];
      if (!h) return;
      var nowDone = toggle(h, selectedDay);
      buzz();
      renderToday();
      if (nowDone) {
        var btn = document.querySelector('[data-toggle="' + d.toggle + '"]');
        if (btn) { btn.classList.add('pop'); setTimeout(function () { btn.classList.remove('pop'); }, 320); }
      }
      return;
    }

    if (d.edit) {
      var he = state.habits.filter(function (x) { return x.id === d.edit; })[0];
      if (he) openSheet(he);
      return;
    }

    if (d.cell) {
      var bits = d.cell.split('|');
      var hc = state.habits.filter(function (x) { return x.id === bits[0]; })[0];
      if (!hc) return;
      var p = bits[1].split('-');
      toggle(hc, new Date(+p[0], +p[1] - 1, +p[2]));
      buzz();
      renderWeek();
      return;
    }

    if (d.sugg) { openSheet(null, SUGGESTIONS[+d.sugg]); return; }

    if (d.emoji) { draft.emoji = d.emoji; paintSheetPickers(); return; }
    if (d.color) { draft.color = d.color; paintSheetPickers(); return; }
    if (d.goal) { draft.goal = +d.goal; paintSheetPickers(); return; }
  });

  $('addBtn').addEventListener('click', function () { openSheet(null); });
  $('closeSheet').addEventListener('click', closeSheet);
  $('scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

  $('weekPrev').addEventListener('click', function () { weekOffset--; renderWeek(); });
  $('weekNext').addEventListener('click', function () { if (weekOffset < 0) { weekOffset++; renderWeek(); } });

  $('habitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('fName').value.trim();
    if (!name) return;
    if (editingId) {
      state.habits.forEach(function (h) {
        if (h.id === editingId) { h.name = name; h.emoji = draft.emoji; h.color = draft.color; h.goal = draft.goal; }
      });
      toast('Saved');
    } else {
      state.habits.push({
        id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: name, emoji: draft.emoji, color: draft.color, goal: draft.goal,
        createdAt: iso(today())
      });
      toast('Habit added');
    }
    save();
    closeSheet();
    render();
  });

  $('deleteBtn').addEventListener('click', function () {
    if (!editingId) return;
    var h = state.habits.filter(function (x) { return x.id === editingId; })[0];
    if (!h) return;
    if (!confirm('Delete "' + h.name + '" and its history? This cannot be undone.')) return;
    state.habits = state.habits.filter(function (x) { return x.id !== editingId; });
    delete state.done[editingId];
    save();
    closeSheet();
    render();
    toast('Habit deleted');
  });

  /* ---------------- data: export / import / reset ---------------- */

  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'habits-' + iso(today()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });

  $('importFile').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.habits)) throw new Error('bad file');
        if (!confirm('Replace everything currently on this device with the backup?')) return;
        state = { version: 1, habits: data.habits, done: data.done || {} };
        save();
        render();
        toast('Backup restored');
      } catch (err) {
        toast('That file is not a valid backup');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('Erase all habits and history on this device?')) return;
    state = blank();
    save();
    render();
    toast('All data erased');
  });

  /* ---------------- boot ---------------- */

  $('suggestions').innerHTML = SUGGESTIONS.map(function (s, i) {
    return '<button class="sugg" data-sugg="' + i + '">' + s.emoji + ' ' + esc(s.name) + '</button>';
  }).join('');

  // Roll the calendar over if the app is left open past midnight.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (selectedDay < today()) selectedDay = today();
      render();
    }
  });

  go('today');

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
