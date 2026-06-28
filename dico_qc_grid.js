/* ============================================================
   API
   Change this to your Render URL when deployed.
   ============================================================ */
var API = "https://dico-quebecois-api.onrender.com";

/* ============================================================
   DATA
   ============================================================ */
var entries = [];

/* ============================================================
   CATEGORY METADATA
   ============================================================ */
var CATEGORY_META = {
  verb:       { label: 'Verb',       bg: 'rgba(16,185,129,0.15)',  text: '#10B981' },
  noun:       { label: 'Noun',       bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6' },
  adjective:  { label: 'Adjective',  bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6' },
  phrase:     { label: 'Phrase',     bg: 'rgba(245,158,11,0.15)', text: '#F59E0B' },
  slang:      { label: 'Slang',      bg: 'rgba(239,68,68,0.15)',  text: '#EF4444' },
  expression: { label: 'Expression', bg: 'rgba(20,184,166,0.15)', text: '#14B8A6' },
  adverb:     { label: 'Adverb',     bg: 'rgba(99,102,241,0.15)', text: '#6366F1' }
};

/* ============================================================
   STATE
   ============================================================ */
var activeFilter = 'all';
var currentLayout = 'grid';

/* ============================================================
   UTILITIES
   ============================================================ */
function timeAgo(ts) {
  // Accepts either a JS timestamp (number) or an ISO string from the API
  var d = Date.now() - (typeof ts === 'number' ? ts : new Date(ts).getTime());
  if (d < 60000)    return 'just now';
  if (d < 3600000)  return Math.floor(d / 60000) + 'm ago';
  if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
  return Math.floor(d / 86400000) + 'd ago';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ============================================================
   IMAGE — resize via canvas before storing URL isn't possible
   for external links, but we cap display size in CSS and
   validate it loads correctly. For Imgur links we also check
   the URL pattern.
   ============================================================ */
var IMG_MAX_PX = 800; // max width/height we care about (CSS handles display)

function isLikelyImgurLink(url) {
  return /^https?:\/\/(i\.)?imgur\.com\//i.test(url);
}

function validateImageUrl(url, callback) {
  if (!url) { callback(true, null); return; }

  // Soft warning if not an Imgur link (not a hard block)
  var warn = !isLikelyImgurLink(url)
    ? 'Heads up: only Imgur links are recommended. Make sure you have rights to use this image.'
    : null;

  // Actually try to load the image to confirm it works
  var img = new Image();
  img.onload  = function() { callback(true, warn); };
  img.onerror = function() { callback(false, null); };
  img.src = url;
}

/* ============================================================
   FILTER
   ============================================================ */
function setFilter(cat) {
  activeFilter = cat;
  document.querySelectorAll('.filter-pill').forEach(function(p) {
    p.classList.toggle('active', p.dataset.cat === cat);
  });
  renderEntries();
}

function toggleCard(el) {
  el.classList.toggle('expanded');
}

// Called by img onload to rebalance columns after image heights are known
function rebalance(gridId) {
  renderEntries();
}

// Re-render on resize so column count updates
var resizeTimer;
window.addEventListener('resize', function() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderEntries, 150);
});

/* ============================================================
   LAYOUT TOGGLE
   ============================================================ */
/* Layout switcher — commented out for now
function switchLayout(layout) {
  currentLayout = layout;
  document.querySelectorAll('.btn-layout').forEach(function(b) { b.classList.remove('active'); });
  document.getElementById('btn-layout-' + layout).classList.add('active');
  renderEntries();
}
*/

/* ============================================================
   FORM
   ============================================================ */
function toggleForm(id) {
  document.getElementById(id).classList.toggle('open');
}

function previewImg() {
  var url = document.getElementById('e-img').value.trim();
  var p   = document.getElementById('e-preview');
  var warn = document.getElementById('e-img-warn');

  if (!url) {
    p.style.display = 'none';
    warn.textContent = '';
    return;
  }

  validateImageUrl(url, function(ok, warning) {
    if (ok) {
      document.getElementById('e-preview-img').src = url;
      p.style.display = 'block';
      warn.textContent = warning || '';
      warn.style.color = warning ? '#F59E0B' : '';
    } else {
      p.style.display = 'none';
      warn.textContent = "Couldn't load this image. Check the URL.";
      warn.style.color = '#EF4444';
    }
  });
}

/* ============================================================
   PILL COUNTS
   ============================================================ */
function updatePillCounts() {
  document.getElementById('pill-count-all').textContent = entries.length;
  ['verb','noun','adjective','adverb','phrase','expression','slang'].forEach(function(cat) {
    var el = document.getElementById('pill-count-' + cat);
    if (el) el.textContent = entries.filter(function(e) { return e.category === cat; }).length;
  });
}

/* ============================================================
   RENDER
   ============================================================ */
function getColCount() {
  var w = window.innerWidth;
  if (w <= 600)  return 2;
  if (w <= 1024) return 3;
  return 4;
}

function renderEntries() {
  var q = (document.getElementById('entries-search').value || '').trim().toLowerCase();

  var list = entries.filter(function(e) {
    var matchCat = activeFilter === 'all' || e.category === activeFilter;
    var matchQ   = !q
      || e.word.toLowerCase().includes(q)
      || e.en.toLowerCase().includes(q)
      || (e.ex     && e.ex.toLowerCase().includes(q))
      || (e.phon   && e.phon.toLowerCase().includes(q))
      || (e.origin && e.origin.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  updatePillCounts();

  var el = document.getElementById('entries-grid');
  var emptyMsg = document.getElementById('empty-state-msg');

  if (!list.length) {
    el.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  // Build column divs
  var cols = getColCount();
  var colEls = [];
  var colHTML = '';
  var i;
  for (i = 0; i < cols; i++) {
    colHTML += '<div class="grid-col" id="grid-col-' + i + '"></div>';
  }
  el.innerHTML = colHTML;
  for (i = 0; i < cols; i++) {
    colEls.push(document.getElementById('grid-col-' + i));
  }

  // Place cards left-to-right into shortest column
  list.slice().reverse().forEach(function(e, idx) {
    var m = CATEGORY_META[e.category] || { label: e.category, bg: 'rgba(255,255,255,0.08)', text: '#9CA3AF' };
    var card = document.createElement('div');
    card.className = 'ecard-wrap';
    card.innerHTML =
      '<div class="ecard" onclick="toggleCard(this, \'' + el.id + '\')">' +
        (e.img ? '<img class="ecard-img" src="' + escHtml(e.img) + '" alt="' + escHtml(e.word) + '" onload="rebalance(\'' + el.id + '\')">' : '') +
        '<div class="ecard-peek">' +
          '<div class="ecard-peek-left">' +
            '<div class="ecard-word">' + escHtml(e.word) + '</div>' +
            '<div class="ecard-en">' + escHtml(e.en) + '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">' +
            '<span class="ecard-cat" style="background:' + m.bg + ';color:' + m.text + ';">' + m.label + '</span>' +
            '<i class="ti ti-chevron-down ecard-chevron" aria-hidden="true"></i>' +
          '</div>' +
        '</div>' +
        '<div class="ecard-details">' +
          '<div class="ecard-body">' +
            (e.origin ? '<div class="ecard-origin">short for <strong>' + escHtml(e.origin) + '</strong></div>' : '') +
            (e.phon ? '<span class="ecard-phon">' + escHtml(e.phon) + '</span>' : '') +
            (e.ex   ? '<div class="ecard-ex">' + escHtml(e.ex) + '</div>' : '') +
            '<div class="ecard-foot">' +
              '<span class="ecard-by">' + escHtml(e.by) + '</span>' +
              '<span class="ecard-time">' + timeAgo(e.created_at || e.ts) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Find shortest column by scrollHeight
    var shortest = colEls.reduce(function(min, col) {
      return col.scrollHeight < min.scrollHeight ? col : min;
    });
    shortest.appendChild(card);
  });
}

/* ============================================================
   SUBMIT
   ============================================================ */
async function submitEntry() {
  var word     = document.getElementById('e-word').value.trim();
  var en       = document.getElementById('e-en').value.trim();
  var category = document.getElementById('e-cat').value;
  var imgUrl   = document.getElementById('e-img').value.trim();
  var agreed   = document.getElementById('e-copyright').checked;
  var err      = document.getElementById('e-err');

  if (!word || !en || !category) {
    err.textContent = 'Word, English meaning, and category are required.';
    return;
  }

  if (imgUrl && !agreed) {
    err.textContent = 'Please confirm you have the right to use this image.';
    return;
  }

  if (imgUrl) {
    var imgOk = await new Promise(function(resolve) {
      validateImageUrl(imgUrl, function(ok) { resolve(ok); });
    });
    if (!imgOk) {
      err.textContent = "The image URL didn't load. Please check it and try again.";
      return;
    }
  }

  err.textContent = '';

  var btn = document.querySelector('#entry-form .btn-submit');
  btn.textContent = 'Adding…';
  btn.disabled = true;

  try {
    var res = await fetch(API + '/entries/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        word:     word,
        en:       en,
        category: category,
        origin:   document.getElementById('e-origin').value.trim(),
        phon:     document.getElementById('e-phon').value.trim(),
        ex:       document.getElementById('e-ex').value.trim(),
        img:      imgUrl,
        by:       document.getElementById('e-name').value.trim() || 'Anonymous'
      })
    });

    if (!res.ok) {
      var data = await res.json();
      err.textContent = data.detail || 'Something went wrong. Try again.';
      return;
    }

    var newEntry = await res.json();
    entries.unshift(newEntry); // add to front since API returns newest first
    renderEntries();

    ['e-word','e-en','e-origin','e-phon','e-ex','e-img','e-name'].forEach(function(id) {
      document.getElementById(id).value = '';
    });
    document.getElementById('e-cat').value = '';
    document.getElementById('e-cat').classList.add('placeholder');
    document.getElementById('e-copyright').checked = false;
    document.getElementById('e-preview').style.display = 'none';
    document.getElementById('e-img-warn').textContent = '';
    document.getElementById('entry-form').classList.remove('open');

  } catch (e) {
    err.textContent = 'Could not reach the server. Is the backend running?';
  } finally {
    btn.textContent = 'Add entry';
    btn.disabled = false;
  }
}

/* ============================================================
   INIT — load entries from API
   ============================================================ */
async function loadEntries() {
  var grid = document.getElementById('entries-grid');
  var emptyMsg = document.getElementById('empty-state-msg');
  grid.innerHTML = '';
  emptyMsg.innerHTML = '<i class="ti ti-loader" aria-hidden="true"></i><p>Loading…</p>';
  emptyMsg.style.display = 'block';

  try {
    var res = await fetch(API + '/entries/');
    entries = await res.json();
  } catch (e) {
    entries = [];
    emptyMsg.innerHTML = '<i class="ti ti-wifi-off" aria-hidden="true"></i><p>Could not reach the server. Is the backend running?</p>';
    return;
  }

  emptyMsg.innerHTML = '<i class="ti ti-mood-empty" aria-hidden="true"></i><p>No entries found — try a different filter or add one!</p>';
  emptyMsg.style.display = 'none';
  renderEntries();
}

loadEntries();
