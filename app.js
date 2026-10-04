// app.js - agent registry frontend.
//
// Plain ES2019, no framework, no bundler. It talks to the Lambda Function URL
// directly and carries no secret of its own: the session lives in an HttpOnly
// cookie on the backend, so the worst a script injection here could steal is
// nothing - it cannot read the cookie, only ask the API to act as the user.
//
// Every mutating call sends the CSRF token that /api/users/me hands back, which
// is what stops another *.babeh.com subdomain from riding the cookie.

(function () {
  'use strict';

  //var API = 'https://agent-registry.babeh.com';
  var API = 'https://62ssyzz6wp56vf6c243656cdt40zdljj.lambda-url.ap-southeast-3.on.aws';
  var me = null;          // { authenticated, user, csrf_token }

  var $ = function (id) { return document.getElementById(id); };
  var text = function (s) { return String(s == null ? '' : s); };

  // --- api -------------------------------------------------------------

  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    if (me && me.csrf_token) headers['X-CSRF-Token'] = me.csrf_token;
    var res = await fetch(API + path, {
      method: opts.method || 'GET',
      headers: headers,
      // The session cookie belongs to the API origin, so it must be sent
      // explicitly; this is the whole reason the split-origin design works.
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty body is fine */ }
    if (!res.ok) {
      var err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // --- session ---------------------------------------------------------

  async function loadSession() {
    try {
      me = await api('/api/users/me');
    } catch (e) {
      me = { authenticated: false };
    }
    var who = $('who'), login = $('login'), logout = $('logout');
    if (me.authenticated) {
      var u = me.user || {};
      who.innerHTML = '';
      if (u.avatar_url) {
        var img = document.createElement('img');
        img.src = u.avatar_url;
        img.alt = '';
        who.appendChild(img);
      }
      var name = document.createElement('span');
      name.textContent = '@' + text(u.login);
      who.appendChild(name);
      login.hidden = true;
      logout.hidden = false;
      $('share-sec').hidden = false;
    } else {
      who.textContent = '';
      login.hidden = false;
      logout.hidden = true;
      $('share-sec').hidden = true;
    }
  }

  // --- rendering --------------------------------------------------------

  function esc(s) { return text(s); }

  function statusChip(a) {
    if (a.status === 'approved') return '<span class="chip ok">published</span>';
    if (a.status === 'rejected') return '<span class="chip">rejected</span>';
    return '<span class="chip pending">pending review</span>';
  }

  function renderList(agents) {
    var list = $('list');
    list.innerHTML = '';
    $('empty').hidden = agents.length > 0;
    agents.forEach(function (a) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML =
        '<a class="id" href="#/agent/' + encodeURIComponent(a.id) + '">' + esc(a.id) + '</a>' +
        '<p>' + esc(a.description) + '</p>' +
        '<div class="meta">' +
          statusChip(a) +
          '<span class="chip star">&#9733; ' + a.stars + '</span>' +
          '<span class="chip">' + a.installs + ' install' + (a.installs === 1 ? '' : 's') + '</span>' +
          (a.author_login ? '<span class="chip">@' + esc(a.author_login) + '</span>' : '') +
          '<span class="chip">v' + esc(a.version) + '</span>' +
        '</div>';
      list.appendChild(card);
    });
  }

  async function loadList() {
    var q = $('q').value.trim();
    var path = '/api/agents' + (q ? '?q=' + encodeURIComponent(q) : '');
    try {
      var data = await api(path);
      renderList(data.agents || []);
    } catch (e) {
      $('empty').hidden = false;
      $('empty').textContent = 'Could not load the registry: ' + e.message;
    }
  }

  function installSnippet(a) {
    var line = 'onidia-chat -agents-install ' + a.id;
    return line + '\n' +
      '\n' +
      '# or point her at the index once, in chat-app.ini:\n' +
      '# agents-registry = ' + API + '/registry.json';
  }

  async function showAgent(id) {
    $('detail-sec').hidden = false;
    var d = $('detail');
    d.innerHTML = '<p class="empty">Loading&hellip;</p>';
    var a;
    try {
      a = await api('/api/agents/' + encodeURIComponent(id));
    } catch (e) {
      d.innerHTML = '<p class="empty">No such agent: ' + esc(e.message) + '</p>';
      return;
    }
    var starred = me.authenticated && me.stars && me.stars[id];
    d.innerHTML =
      '<a href="#/" class="chip">&larr; all agents</a>' +
      '<h2 style="margin-top:14px">' + esc(a.id) + '</h2>' +
      '<p class="lede">' + esc(a.description) + '</p>' +
      '<div class="meta" style="margin-top:14px">' +
        statusChip(a) +
        '<span class="chip star">&#9733; ' + a.stars + '</span>' +
        '<span class="chip">' + a.installs + ' install' + (a.installs === 1 ? '' : 's') + '</span>' +
        '<span class="chip">v' + esc(a.version) + '</span>' +
        (a.author_login ? '<span class="chip">@' + esc(a.author_login) + '</span>' : '') +
        (a.source_repo ? '<a class="chip" href="' + esc(a.source_repo) + '" rel="noopener">source</a>' : '') +
      '</div>' +
      '<dl class="kv">' +
        '<dt>Agent id</dt><dd><code>' + esc(a.id) + '</code></dd>' +
        '<dt>Version</dt><dd>' + esc(a.version) + '</dd>' +
        '<dt>Published</dt><dd>' + esc((a.created_at || '').slice(0, 10)) + '</dd>' +
        (a.repo_path ? '<dt>In repo</dt><dd><code>' + esc(a.repo_path) + '</code></dd>' : '') +
        (a.zip_sha256 ? '<dt>SHA-256</dt><dd><code>' + esc(a.zip_sha256.slice(0, 16)) + '&hellip;</code></dd>' : '') +
      '</dl>' +
      '<div class="install"><pre id="snip">' + esc(installSnippet(a)) + '</pre></div>' +
      (a.params && a.params.length
        ? '<h3>Parameters</h3><ul class="params">' + a.params.map(function (p) {
            return '<li><code>' + esc(p.name) + '</code>' + (p.required ? ' (required)' : '') +
              (p.description ? ' &mdash; ' + esc(p.description) : '') + '</li>';
          }).join('') + '</ul>'
        : '') +
      '<p style="margin-top:20px"><button id="starbtn" class="primary">' +
        (starred ? 'Unstar' : 'Star') + ' this agent</button> ' +
        '<button id="copybtn" class="ghost">Copy the command</button></p>';
    $('copybtn').addEventListener('click', copySnippet);
    $('starbtn').addEventListener('click', function () { toggleStar(a, d); });
  }

  async function toggleStar(a, container) {
    if (!me.authenticated) { window.location.href = API + '/login'; return; }
    try {
      var r = await api('/api/agents/' + encodeURIComponent(a.id) + '/star', { method: 'POST' });
      a.stars = r.stars;
      showAgent(a.id);
      loadList();
    } catch (e) {
      if (e.status === 401) { window.location.href = API + '/login'; return; }
      window.alert('Could not star: ' + e.message);
    }
  }

  function copySnippet() {
    var el = $('snip');
    if (!el) return;
    var t = el.innerText;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t);
    } else {
      var ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  // --- routing ----------------------------------------------------------

  function route() {
    var h = location.hash || '';
    var m = h.match(/^#\/agent\/(.+)$/);
    if (m) {
      showAgent(decodeURIComponent(m[1]));
      window.scrollTo(0, 0);
    } else {
      $('detail-sec').hidden = true;
      loadList();
    }
  }

  // --- boot -------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', async function () {
    $('q').addEventListener('input', debounce(loadList, 200));
    $('refresh').addEventListener('click', loadList);
    $('logout').addEventListener('click', async function () {
      try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
      window.location.href = '/';
    });
    $('publish').addEventListener('click', publish);

    await loadSession();
    route();
    window.addEventListener('hashchange', route);

    // GitHub sent us back with ?auth=ok / ?auth=failed; clear it so a reload
    // does not replay the message, then refresh the session.
    if (location.search.indexOf('auth=') !== -1) {
      history.replaceState({}, '', location.pathname);
    }
  });

  async function publish() {
    var errBox = $('share-err'), okBox = $('share-ok'), btn = $('publish');
    errBox.hidden = true; okBox.hidden = true;
    if (!me.authenticated) { window.location.href = API + '/login'; return; }
    var repo = $('repo').value.trim();
    if (!repo) { errBox.textContent = 'A repository is required.'; errBox.hidden = false; return; }
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      var a = await api('/api/agents', {
        method: 'POST',
        body: { repo: repo, path: $('path').value.trim() }
      });
      okBox.textContent = a.status === 'approved'
        ? a.id + ' is published and installable now.'
        : a.id + ' was submitted and is waiting for review.';
      okBox.hidden = false;
      $('repo').value = ''; $('path').value = '';
      loadList();
    } catch (e) {
      errBox.textContent = e.message;
      errBox.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Publish';
    }
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }
})();
