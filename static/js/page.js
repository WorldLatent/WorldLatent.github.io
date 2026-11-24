/* ==========================================================================
 *  WorldLatent project page: renderer + playback.
 *  You should not need to edit this file; add videos in static/js/content.js.
 *
 *  - Builds every section from window.WL_CONTENT.
 *  - Each example card is a "sync group": its videos start together and
 *    restart together when the longest one ends, so frames stay aligned.
 *  - Only groups on screen play (IntersectionObserver); off-screen ones pause.
 *  - Global speed / pause controls in the toolbar; click a video to enlarge.
 *  - perception.viewer / generation.viewer (or an example's `viewer`) add the
 *    interactive 3D viewer (static/js/viewer3d.js), which follows the toolbar's
 *    speed and pause.
 * ========================================================================== */
(function () {
  'use strict';

  var C = window.WL_CONTENT || {};
  var state = { speed: 1, paused: false, groups: [], viewers: [] };

  /* ------------------------------------------------------------ DOM helper */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  /* -------------------------------------------------------- sync groups */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var g = e.target.__group;
      if (!g || e.isIntersecting === g.visible) return;
      g.visible = e.isIntersecting;
      if (g.visible) restart(g); else pauseGroup(g);
    });
  }, { threshold: 0 });

  function live(g) { return g.videos.filter(function (v) { return !v.__missing; }); }

  function applyRate(v) {
    var r = (v.__rate || 1) * state.speed;
    v.defaultPlaybackRate = r;
    v.playbackRate = r;
  }

  function pickLeader(g) {
    var best = null;
    live(g).forEach(function (v) {
      if (!best || (v.duration || 0) > (best.duration || 0)) best = v;
    });
    g.leader = best;
  }

  function playGroup(g) {
    live(g).forEach(function (v) {
      applyRate(v);
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    });
  }

  function pauseGroup(g) { g.videos.forEach(function (v) { v.pause(); }); }

  function restart(g) {
    live(g).forEach(function (v) { try { v.currentTime = 0; } catch (err) {} });
    if (g.visible && !state.paused) playGroup(g);
  }

  function makeGroup(rate) {
    return { videos: [], visible: false, leader: null, rate: rate || 1, el: null };
  }

  function registerGroup(g, el) {
    g.el = el;
    el.__group = g;
    g.videos.forEach(function (v) {
      v.addEventListener('loadedmetadata', function () { applyRate(v); pickLeader(g); });
      v.addEventListener('ended', function () {
        var all = live(g).every(function (x) { return x.ended; });
        if (v === g.leader || all) restart(g);
      });
    });
    state.groups.push(g);
    io.observe(el);
  }

  /* ---------------------------------------------------------- building blocks */
  function clip(c, g, opts) {
    opts = opts || {};
    var v = h('video', {
      src: c.src, muted: true, playsinline: true, preload: 'metadata',
      'aria-label': c.label || c.caption || 'video', title: 'Click to enlarge',
    });
    v.muted = true;            // the attribute alone is not enough in some browsers
    v.loop = false;            // looping is driven by the sync group
    v.__rate = c.rate || g.rate || 1;
    var fig = h('figure', { class: 'clip' + (c.ours ? ' is-ours' : '') + (opts.wide ? ' clip-wide' : '') + (opts.cls ? ' ' + opts.cls : '') },
      c.label ? h('figcaption', null, c.label) : null,
      h('div', { class: 'frame' }, v));
    v.addEventListener('error', function () { markMissing(fig, v, c.src); }, { once: true });
    v.addEventListener('click', function () { openLightbox(c.src, c.caption || c.label || '', v.__rate); });
    g.videos.push(v);
    return fig;
  }

  function markMissing(fig, v, src) {
    v.__missing = true;
    var frame = fig.querySelector('.frame');
    frame.innerHTML = '';
    frame.classList.add('is-missing');
    frame.appendChild(h('div', { class: 'missing' }, h('strong', null, 'Video not found'), h('code', null, src || '(no src)')));
  }

  // inline: inside an example card (title row + viewer); otherwise just the viewer
  function viewer3d(v, inline) {
    var box = h('div', { class: inline ? 'v3d-wrap' : 'v3d-solo' },
      inline ? h('div', { class: 'v3d-title' },
        h('h4', null, v.title || 'Interactive 3D viewer'),
        v.caption ? h('span', null, v.caption) : null) : null);
    var slot = h('div');
    box.appendChild(slot);
    if (window.WLViewer) {
      var api = window.WLViewer.mount(slot, { scenes: v.scenes, src: v.src, zoom: v.zoom, initial: v.initial, labels: v.labels });
      api.setSpeed(state.speed);
      state.viewers.push(api);
    }
    return box;
  }

  // a section's own viewer card (title, caption, thumbnails + viewer)
  function viewerCard(V) {
    return card({ title: V.title || 'Interactive 3D viewer', cls: 'viewer-card', id: V.id }, function () {
      return [
        V.caption ? h('p', { class: 'v3d-caption', html: V.caption }) : null,
        viewer3d(V, false),
      ];
    });
  }

  function tags(list) {
    return list.filter(Boolean).map(function (t) { return h('span', { class: 'tag' }, t); });
  }

  function card(opts, build) {
    var g = makeGroup(opts.rate);
    var el = h('article', { class: 'example' + (opts.cls ? ' ' + opts.cls : ''), id: opts.id });
    if (opts.title || (opts.tags && opts.tags.length)) {
      el.appendChild(h('header', { class: 'example-head' },
        opts.title ? h('h3', null, opts.title) : null,
        h('div', { class: 'tags' }, tags(opts.tags || []))));
    }
    append(el, build(g));
    if (opts.note) el.appendChild(h('p', { class: 'note', html: opts.note }));
    registerGroup(g, el);
    return el;
  }

  /* ------------------------------------------------------------- sections */
  function renderPerception(root) {
    var P = C.perception || {};
    var datasets = P.datasets || [];

    if (datasets.length) {
      var tabBar = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Dataset' });
      var panels = h('div', { class: 'tab-panels' });
      datasets.forEach(function (ds, i) {
        var id = 'perception-' + i;
        var btn = h('button', {
          class: 'tab', role: 'tab', id: id + '-tab', type: 'button',
          'aria-selected': i === 0 ? 'true' : 'false', 'aria-controls': id,
        }, h('span', { class: 'tab-name' }, ds.name),
           ds.figure ? h('span', { class: 'tab-meta' }, ds.figure) : null);
        var panel = h('div', { class: 'tab-panel', role: 'tabpanel', id: id, 'aria-labelledby': id + '-tab', hidden: i !== 0 });
        (ds.examples || []).forEach(function (ex) {
          panel.appendChild(card({ title: ds.name + ': ' + ex.title, tags: [ex.figure], rate: ex.rate, note: ex.note }, function (g) {
            return clip({ src: ex.src, caption: ds.name + ': ' + ex.title, rate: ex.rate }, g, { wide: true });
          }));
        });
        btn.addEventListener('click', function () {
          Array.prototype.forEach.call(tabBar.children, function (b) { b.setAttribute('aria-selected', b === btn ? 'true' : 'false'); });
          Array.prototype.forEach.call(panels.children, function (p) { p.hidden = p !== panel; });
        });
        tabBar.appendChild(btn);
        panels.appendChild(panel);
      });
      root.querySelector('[data-slot="grids"]').append(tabBar, panels);
    }

    var oursSlot = root.querySelector('[data-slot="ours"]');
    var ours = P.ours || [];
    if (!ours.length) { root.querySelector('[data-block="ours"]').hidden = true; return; }
    ours.forEach(function (ex) {
      oursSlot.appendChild(card({ title: ex.title, tags: [ex.figure], rate: ex.rate, note: ex.note }, function (g) {
        var n = Math.min(ex.clips.length, 4);
        return [
          h('div', { class: 'row cols-' + n }, ex.clips.map(function (c) {
            return clip({ label: c.label, src: c.src, ours: c.ours, caption: ex.title + ': ' + c.label, rate: c.rate }, g);
          })),
          ex.viewer ? viewer3d(ex.viewer, true) : null,
        ];
      }));
    });
    if (P.viewer && (P.viewer.scenes || P.viewer.src)) oursSlot.appendChild(viewerCard(P.viewer));
  }

  function renderRerender(root) {
    var slot = root.querySelector('[data-slot="examples"]');
    ((C.rerender || {}).examples || []).forEach(function (ex, i) {
      slot.appendChild(card({
        title: 'Example ' + (i + 1) + ': ' + ex.title,
        tags: [ex.source, ex.figure], rate: ex.rate, note: ex.note, cls: 'rerender',
      }, function (g) {
        var cap = function (s) { return ex.title + ': ' + s; };
        return [
          h('div', { class: 'row cols-3' },
            clip({ label: 'Input RGB video',                src: ex.input.rgb,      caption: cap('input RGB video') }, g),
            clip({ label: 'Estimated depth maps',           src: ex.input.depth,    caption: cap('estimated depth maps'), ours: true }, g),
            clip({ label: 'Estimated 3D geometry + camera', src: ex.input.geometry, caption: cap('estimated 3D geometry + camera'), ours: true }, g)),
          h('div', { class: 'flow', 'aria-hidden': 'true' },
            h('span', { class: 'arrow' }, '↓'), 'Estimated depth + new text prompt', h('span', { class: 'arrow' }, '↓')),
          h('div', { class: 'row cols-3 centered' }, (ex.outputs || []).map(function (o, j) {
            return h('div', { class: 'output' },
              clip({ label: 'Prompt ' + (j + 1) + ': ' + o.name, src: o.src, caption: cap('prompt ' + (j + 1) + ', ' + o.name), ours: true, rate: o.rate }, g),
              o.prompt ? h('p', { class: 'prompt', html: o.prompt }) : null);
          })),
        ];
      }));
    });
  }

  function renderGeneration(root) {
    var G = C.generation || {};
    var slot = root.querySelector('[data-slot="examples"]');
    (G.examples || []).forEach(function (ex) {
      slot.appendChild(card({ title: ex.title, tags: [ex.figure], rate: ex.rate, note: ex.note, cls: 'gen' }, function (g) {
        var cap = function (s) { return ex.title + ': ' + s; };
        return h('div', { class: 'gen-body' },
          h('div', { class: 'prompt prompt-side' }, h('span', { class: 'prompt-label' }, 'Text prompt'), h('p', { html: ex.prompt || '' })),
          h('div', { class: 'row cols-3' },
            clip({ label: 'Generated RGB',        src: ex.rgb,      caption: cap('generated RGB') }, g),
            clip({ label: 'Generated depth',      src: ex.depth,    caption: cap('generated depth') }, g),
            clip({ label: '3D geometry + camera', src: ex.geometry, caption: cap('3D geometry + camera') }, g)));
      }));
    });
    if (G.viewer && (G.viewer.scenes || G.viewer.src)) {
      // each scene shows the text prompt of the example with the same title
      (G.viewer.scenes || []).forEach(function (sc) {
        if (sc.prompt) return;
        var ex = (G.examples || []).filter(function (e) { return e.title === sc.title; })[0];
        if (ex) sc.prompt = ex.prompt;
      });
      slot.appendChild(viewerCard(G.viewer));
    }
  }

  function renderDecomposition(root) {
    var D = C.decomposition || {};
    var slot = root.querySelector('[data-slot="examples"]');
    (D.examples || []).forEach(function (ex) {
      var rows = ex.rows || D.rows || [];
      var cols = ex.columns || D.columns || [];
      slot.appendChild(card({ title: ex.title, tags: [ex.source], rate: ex.rate, note: ex.note, cls: 'decomp' }, function (g) {
        return h('div', { class: 'decomp-grid' + (rows.length ? '' : ' no-rows') },
          cols.length ? h('div', { class: 'decomp-corner' }) : null,
          cols.length ? h('div', { class: 'decomp-cols', style: 'grid-template-columns:repeat(' + cols.length + ',1fr)' },
            cols.map(function (c) { return h('span', { html: c }); })) : null,
          rows.length ? h('div', { class: 'decomp-rows', style: 'grid-template-rows:repeat(' + rows.length + ',1fr)' },
            rows.map(function (r, i) {
              return h('div', { class: 'decomp-row' },
                h('span', { class: 'rn' }, 'Row ' + (i + 1)),
                h('span', { class: 'rt', html: r.title || r }),
                r.detail ? h('span', { class: 'rd', html: r.detail }) : null);
            })) : null,
          clip({ src: ex.src, caption: ex.title, rate: ex.rate }, g, { cls: 'clip-decomp' }));
      }));
    });
  }

  /* ------------------------------------------------------------- toolbar */
  function initToolbar() {
    var speedBtns = document.querySelectorAll('[data-speed]');
    Array.prototype.forEach.call(speedBtns, function (b) {
      b.addEventListener('click', function () {
        state.speed = parseFloat(b.getAttribute('data-speed'));
        Array.prototype.forEach.call(speedBtns, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        state.groups.forEach(function (g) { g.videos.forEach(applyRate); });
        state.viewers.forEach(function (v) { v.setSpeed(state.speed); });
        var lb = document.querySelector('#lightbox video');
        if (lb) applyRate(lb);
      });
    });
    var pauseBtn = document.getElementById('toggle-play');
    pauseBtn.addEventListener('click', function () {
      state.paused = !state.paused;
      pauseBtn.textContent = state.paused ? 'Play all' : 'Pause all';
      pauseBtn.setAttribute('aria-pressed', state.paused ? 'true' : 'false');
      state.groups.forEach(function (g) {
        if (state.paused) pauseGroup(g); else if (g.visible) playGroup(g);
      });
      state.viewers.forEach(function (v) { v.setPaused(state.paused); });
    });
  }

  /* ------------------------------------------------------------- lightbox */
  var lb = document.getElementById('lightbox');
  function openLightbox(src, caption, rate) {
    lb.innerHTML = '';
    var v = h('video', { src: src, controls: true, loop: true, autoplay: true, muted: true, playsinline: true });
    v.muted = true;
    v.__rate = rate || 1;
    v.addEventListener('loadedmetadata', function () {
      applyRate(v);
      // scale small clips (512 px) up to fill the screen while keeping their aspect ratio
      var s = Math.min(window.innerWidth * 0.94 / v.videoWidth, window.innerHeight * 0.84 / v.videoHeight);
      if (isFinite(s) && s > 0) {
        v.style.width = Math.round(v.videoWidth * s) + 'px';
        v.style.height = Math.round(v.videoHeight * s) + 'px';
      }
    });
    lb.appendChild(h('div', { class: 'lb-inner', role: 'dialog', 'aria-modal': 'true', 'aria-label': caption || 'Video' },
      h('button', { class: 'lb-close', type: 'button', 'aria-label': 'Close', onclick: closeLightbox }, '×'),
      v,
      caption ? h('p', { class: 'lb-cap' }, caption) : null));
    lb.hidden = false;
    document.body.classList.add('lb-open');
    lb.querySelector('.lb-close').focus();
  }
  function closeLightbox() {
    lb.hidden = true;
    lb.innerHTML = '';
    document.body.classList.remove('lb-open');
  }
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });

  /* ----------------------------------------------------------------- boot */
  var renderers = {
    perception: renderPerception, rerender: renderRerender,
    generation: renderGeneration, decomposition: renderDecomposition,
  };
  Object.keys(renderers).forEach(function (k) {
    var root = document.querySelector('[data-render="' + k + '"]');
    if (root) renderers[k](root);
  });
  initToolbar();
})();
