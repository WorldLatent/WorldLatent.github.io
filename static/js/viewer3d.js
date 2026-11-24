/* ==========================================================================
 *  WorldLatent project page: interactive 3D point-cloud viewer.
 *
 *  Plain WebGL, no libraries, so it works both from GitHub Pages and when
 *  index.html is opened straight from disk. Each viewer's data is a
 *  static/viewer/<name>/scene.js file made by tools/make_viewer_data.py; it is
 *  only downloaded when the viewer comes close to the screen.
 *
 *  Used by page.js:  WLViewer.mount(element, { scenes: [{ src, thumb, dataset, name, title, prompt }], zoom: 1 })
 *  (or { src } for a single scene). With several scenes, a row of thumbnails
 *  picks the scene; only the chosen scene's data is downloaded and kept.
 *  A scene's `prompt` (optional) is shown below the controls. `labels` (optional)
 *  replaces the wording for estimated results, e.g. for generated scenes:
 *    { frame: 'Generated frame', depth: 'Generated depth, this frame',
 *      trajectory: 'Generated camera trajectory', camera: 'generated camera' }
 *  Returns { setSpeed(x), setPaused(bool) } for the page toolbar.
 * ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------ data files */
  var pending = {};
  function define(scene) {                    // called by scene.js
    var s = document.currentScript;
    var key = s && s.getAttribute('data-wl-scene');
    var cb = key && pending[key];
    if (cb) { delete pending[key]; cb(scene, s.src.replace(/[^\/]*$/, '')); }
  }
  function loadScene(src, cb) {
    pending[src] = cb;
    var el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.setAttribute('data-wl-scene', src);
    el.onerror = function () { delete pending[src]; el.parentNode.removeChild(el); cb(null); };
    el.onload = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    document.head.appendChild(el);
  }

  function decodeBase64(str) {
    var bin = atob(str), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  var HALF = null;
  function halfToFloat(u16) {
    if (!HALF) {
      HALF = new Float32Array(65536);
      for (var h = 0; h < 65536; h++) {
        var s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
        HALF[h] = e === 0 ? s * Math.pow(2, -14) * (f / 1024)
                : e === 31 ? (f ? NaN : s * Infinity)
                : s * Math.pow(2, e - 15) * (1 + f / 1024);
      }
    }
    var out = new Float32Array(u16.length);
    for (var i = 0; i < u16.length; i++) out[i] = HALF[u16[i]];
    return out;
  }
  function turbo(x) {
    x = Math.min(1, Math.max(0, x));
    var r = 0.13572138 + x * (4.61539260 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
    var g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
    var b = 0.10667330 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
    return [Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b))];
  }

  /* ------------------------------------------------------------ 3D maths */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far);
    return m;
  }
  function lookAt(eye, target, up) {
    var z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  // camera frustum drawn as line segments (apex, image corners, and a tick for "up")
  function frustumSegs(K, W, H, R, c, size) {
    var corners = [[0, 0], [W, 0], [W, H], [0, H]].map(function (uv) {
      var d = [(uv[0] - K[2]) / K[0] * size, (uv[1] - K[3]) / K[1] * size, size];
      return [0, 1, 2].map(function (k) { return c[k] + R[k][0] * d[0] + R[k][1] * d[1] + R[k][2] * d[2]; });
    });
    var p = [];
    for (var i = 0; i < 4; i++) p.push.apply(p, c.concat(corners[i], corners[i], corners[(i + 1) % 4]));
    var top = [0, 1, 2].map(function (k) { return 0.5 * (corners[0][k] + corners[1][k]); });
    var tip = [0, 1, 2].map(function (k) { return top[k] - R[k][1] * size * 0.24; });
    p.push.apply(p, top.concat(tip));
    return p;
  }

  /* ------------------------------------------------------------ WebGL */
  var VS_PTS = 'attribute vec3 p; attribute vec3 c; uniform mat4 m; uniform float s; varying vec3 v;' +
               'void main(){ gl_Position = m * vec4(p, 1.0); gl_PointSize = s; v = c; }';
  var FS_PTS = 'precision mediump float; varying vec3 v; void main(){ gl_FragColor = vec4(v, 1.0); }';
  var VS_SOLID = 'attribute vec3 p; uniform mat4 m; uniform float s; uniform vec2 o;' +
                 'void main(){ gl_Position = m * vec4(p, 1.0); gl_Position.xy += o * gl_Position.w; gl_PointSize = s; }';
  var FS_SOLID = 'precision mediump float; uniform vec4 k; uniform float r;' +
                 'void main(){ if (r > 0.5) { vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25) discard; } gl_FragColor = k; }';

  function program(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var info = { p: p, a: {}, u: {} };
    ['p', 'c'].forEach(function (n) { info.a[n] = gl.getAttribLocation(p, n); });
    ['m', 's', 'k', 'r', 'o'].forEach(function (n) { info.u[n] = gl.getUniformLocation(p, n); });
    return info;
  }
  function buffer(gl, data, dynamic) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    return b;
  }

  var COL_TRAJ = [1.0, 0.82, 0.4, 1.0];      // #ffd166
  var COL_CUR = [0.31, 1.0, 0.86, 1.0];      // #50ffdc
  var BG = [0.055, 0.063, 0.078];            // #0e1014, same as the video frames
  var UP = [0, -1, 0], AX_A = [1, 0, 0], AX_B = [0, 0, 1];   // OpenCV world: y points down
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function segGroup(label, items, value, onPick) {
    var wrap = el('span', 'grp');
    wrap.appendChild(el('span', null, label));
    var seg = el('span', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', label);
    items.forEach(function (it) {
      var b = el('button', null, it[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', it[0] === value ? 'true' : 'false');
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        onPick(it[0]);
      });
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
    return wrap;
  }

  /* ------------------------------------------------------------ viewer */
  function mount(root, opts) {
    var S = null, gl = null, P = null, L = null, base = '';
    var scenes = opts.scenes || [{ src: opts.src }], current = opts.initial || 0, loadToken = 0;
    var LB = opts.labels || {};
    var words = {
      frame: LB.frame || 'Input frame', depth: LB.depth || 'Our depth, this frame',
      trajectory: LB.trajectory || 'Estimated camera trajectory', camera: LB.camera || 'estimated camera',
    };
    var frame = 0, playing = true, globalPaused = false, speed = 1, colorMode = 'rgb';
    var follow = false, visible = false, started = false, dirty = true, raf = 0, last = 0;
    var view = { target: [0, 0, 0], r: 10, theta: 0, phi: 1, fov: 52 };
    var images = { rgb: [], depth: [], preload: [] };

    /* DOM */
    root.classList.add('v3d');
    var stage = el('div', 'v3d-stage');
    stage.tabIndex = 0;
    stage.setAttribute('role', 'application');
    stage.setAttribute('aria-label', 'Interactive 3D point cloud. Drag to rotate, Space to play or pause, arrow keys to step.');
    var canvas = el('canvas');
    var inset = el('figure', 'v3d-inset');
    var insetImg = el('img'); insetImg.alt = '';
    var insetCap = el('figcaption');
    inset.appendChild(insetImg); inset.appendChild(insetCap);
    var legend = el('div', 'v3d-legend',
      '<span><i style="background:#ffd166"></i>' + words.trajectory + '</span>' +
      '<span><i style="background:#50ffdc"></i>Current camera</span>');
    var msg = el('div', 'v3d-msg', 'The interactive 3D view loads when you scroll here.');
    var hint = el('div', 'v3d-hint');
    var nameEl = el('div', 'v3d-name');
    [canvas, nameEl, inset, legend, msg, hint].forEach(function (x) { stage.appendChild(x); });

    var thumbs = null, thumbBtns = [];
    if (scenes.length > 1) {
      thumbs = el('div', 'v3d-thumbs');
      thumbs.setAttribute('role', 'group');
      thumbs.setAttribute('aria-label', 'Choose a scene');
      scenes.forEach(function (sc, i) {
        var b = el('button', 'v3d-thumb');
        b.type = 'button';
        b.title = sc.title || sc.name || '';
        if (sc.thumb) { var im = el('img'); im.src = sc.thumb; im.alt = ''; im.loading = 'lazy'; b.appendChild(im); }
        var lab = el('span', 'lab');
        if (sc.dataset) lab.appendChild(el('strong', null, sc.dataset));
        if (sc.name) lab.appendChild(el(sc.dataset ? 'span' : 'strong', null, sc.name));
        b.appendChild(lab);
        b.setAttribute('aria-pressed', i === current ? 'true' : 'false');
        b.addEventListener('click', function () { if (i !== current || !started) select(i); });
        thumbBtns.push(b);
        thumbs.appendChild(b);
      });
    }

    var bar = el('div', 'v3d-bar');
    var playBtn = el('button', 'btn', 'Pause'); playBtn.type = 'button';
    var slider = el('input'); slider.type = 'range'; slider.min = 0; slider.max = 0; slider.value = 0; slider.step = 1;
    slider.setAttribute('aria-label', 'Frame');
    var tLbl = el('span', 't');
    var timeGrp = el('span', 'grp'); [playBtn, slider, tLbl].forEach(function (x) { timeGrp.appendChild(x); });
    var camBtn = el('button', 'btn', 'Camera view'); camBtn.type = 'button'; camBtn.setAttribute('aria-pressed', 'false');
    camBtn.title = 'Look through the ' + words.camera + ' of the current frame';
    var resetBtn = el('button', 'btn', 'Reset view'); resetBtn.type = 'button';
    var viewGrp = el('span', 'grp'); viewGrp.appendChild(camBtn); viewGrp.appendChild(resetBtn);
    bar.appendChild(timeGrp);
    bar.appendChild(segGroup('Color', [['rgb', 'RGB'], ['depth', 'Depth']], colorMode,
      function (v) { colorMode = v; updateInset(); dirty = true; kick(); }));
    bar.appendChild(viewGrp);
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var help = el('p', 'v3d-help', touch
      ? 'Drag with one finger to rotate &middot; pinch to zoom &middot; drag with two fingers to pan.'
      : 'Drag to rotate &middot; right-drag or Shift+drag to pan &middot; pinch or ' + (IS_MAC ? '&#8984;' : 'Ctrl') +
        '+scroll to zoom &middot; double-click to reset. Click the view, then Space plays/pauses and &larr;/&rarr; step frames.');
    var hasPrompt = scenes.some(function (sc) { return sc.prompt; });
    var promptBox = null, promptText = null;
    if (hasPrompt) {
      promptBox = el('div', 'v3d-prompt prompt', '<span class="prompt-label">Text prompt</span>');
      promptText = el('p');
      promptBox.appendChild(promptText);
    }
    if (thumbs) root.appendChild(thumbs);
    root.appendChild(stage); root.appendChild(bar);
    if (promptBox) root.appendChild(promptBox);
    root.appendChild(help);
    setControlsEnabled(false);

    function setControlsEnabled(on) {
      Array.prototype.forEach.call(bar.querySelectorAll('button, input'), function (x) { x.disabled = !on; });
    }

    /* loading, only when near the screen */
    var near = new IntersectionObserver(function (es) {
      if (!es.some(function (e) { return e.isIntersecting; }) || started) return;
      select(current);
    }, { rootMargin: '600px 0px' });
    near.observe(root);

    function select(i) {
      started = true; near.disconnect();
      current = i;
      thumbBtns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      var sc = scenes[i], tok = ++loadToken;
      nameEl.textContent = sc.title || '';
      if (promptBox) { promptText.innerHTML = sc.prompt || ''; promptBox.hidden = !sc.prompt; }
      setControlsEnabled(false);
      msg.style.display = '';
      msg.textContent = 'Loading 3D point cloud\u2026';
      insetImg.removeAttribute('src'); insetCap.textContent = '';
      if (S) freeScene();
      if (gl) { gl.clearColor(BG[0], BG[1], BG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); }
      loadScene(sc.src, function (scene, b) {
        if (tok !== loadToken) return;            // another scene was picked meanwhile
        if (!scene) { msg.textContent = 'Could not load the 3D data.'; return; }
        try { ensureGL(); build(scene, b); } catch (err) {
          msg.textContent = 'This browser cannot show the 3D view (WebGL is unavailable).';
          if (window.console) console.error(err);
        }
      });
    }
    function freeScene() {
      ['bPos', 'bRgb', 'bDep', 'bTraj', 'bKey', 'bAct', 'bDot'].forEach(function (k) { gl.deleteBuffer(S[k]); });
      S = null;
    }
    var vis = new IntersectionObserver(function (es) {
      visible = es[es.length - 1].isIntersecting;
      if (visible) { dirty = true; kick(); }
    }, { threshold: 0 });
    vis.observe(stage);

    function ensureGL() {
      if (gl) return;
      gl = canvas.getContext('webgl', { antialias: true, alpha: false }) ||
           canvas.getContext('experimental-webgl', { antialias: true, alpha: false });
      if (!gl) throw new Error('no WebGL');
      P = program(gl, VS_PTS, FS_PTS);
      L = program(gl, VS_SOLID, FS_SOLID);
      bindInput();
      if (window.ResizeObserver) new ResizeObserver(function () { dirty = true; kick(); }).observe(stage);
    }

    function build(scene, b) {
      base = b;
      images = { rgb: [], depth: [], preload: [] };
      var T = scene.frames.length, N = 0, start = [];
      scene.frames.forEach(function (f) { start.push(N); N += f.n; });
      var bytes = decodeBase64(scene.data);
      scene.data = null;
      var pos = halfToFloat(new Uint16Array(bytes.buffer, 0, N * 3));
      var rgb = new Uint8Array(bytes.buffer, N * 6, N * 3);

      // depth colours: planar depth of each point in its own camera, turbo on 1/depth
      var inv = new Float32Array(N), samples = [], medDepth = [];
      scene.frames.forEach(function (f, t) {
        var R = f.R, c = f.c, s0 = start[t], step = Math.max(1, Math.floor(f.n / 2000)), own = [];
        for (var i = 0; i < f.n; i++) {
          var j = 3 * (s0 + i);
          var z = (pos[j] - c[0]) * R[0][2] + (pos[j + 1] - c[1]) * R[1][2] + (pos[j + 2] - c[2]) * R[2][2];
          inv[s0 + i] = 1 / Math.max(0.15, z);
          if (i % step === 0) { samples.push(inv[s0 + i]); own.push(z); }
        }
        own.sort(function (a, b) { return a - b; });
        medDepth.push(own.length ? own[Math.floor(own.length / 2)] : 10);   // camera view orbits around this
      });
      samples.sort(function (a, b) { return a - b; });
      var lo = samples[Math.floor(0.02 * samples.length)], hi = samples[Math.floor(0.98 * samples.length)];
      var dcol = new Uint8Array(N * 3), span = 1 / Math.max(1e-6, hi - lo);
      for (var i = 0; i < N; i++) {
        var k = turbo((inv[i] - lo) * span);
        dcol[3 * i] = k[0] * 255; dcol[3 * i + 1] = k[1] * 255; dcol[3 * i + 2] = k[2] * 255;
      }

      var centers = [], keyP = [], fs = scene.frustum || 0.9;
      scene.frames.forEach(function (f, t) {
        centers.push.apply(centers, f.c);
        if (t === 0 || t === Math.floor((T - 1) / 2) || t === T - 1) keyP.push.apply(keyP, frustumSegs(scene.K, scene.W, scene.H, f.R, f.c, fs * 0.78));
      });
      // points used to frame the default view: a sample of the cloud (outliers trimmed) + the cameras
      var fit = [], fstep = Math.max(1, Math.floor(N / 6000));
      for (var q = 0; q < N; q += fstep) fit.push([pos[3 * q], pos[3 * q + 1], pos[3 * q + 2]]);
      var lims = [0, 1, 2].map(function (k) {
        var v = fit.map(function (pt) { return pt[k]; }).sort(function (a, b) { return a - b; });
        return [v[Math.floor(0.01 * v.length)], v[Math.floor(0.99 * v.length)]];
      });
      fit = fit.filter(function (pt) { return [0, 1, 2].every(function (k) { return pt[k] >= lims[k][0] && pt[k] <= lims[k][1]; }); });
      for (var q2 = 0; q2 < keyP.length; q2 += 3) fit.push([keyP[q2], keyP[q2 + 1], keyP[q2 + 2]]);
      scene.frames.forEach(function (f) { fit.push(f.c.slice()); });
      S = {
        fit: fit, medDepth: medDepth,
        scene: scene, T: T, N: N, start: start,
        bPos: buffer(gl, pos), bRgb: buffer(gl, rgb), bDep: buffer(gl, dcol),
        bTraj: buffer(gl, new Float32Array(centers)), bKey: buffer(gl, new Float32Array(keyP)), nKey: keyP.length / 3,
        bAct: buffer(gl, new Float32Array(frustumSegs(scene.K, scene.W, scene.H, scene.frames[0].R, scene.frames[0].c, fs * 1.18)), true),
        bDot: buffer(gl, new Float32Array(3), true),
        maxPt: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64,
      };
      for (var t = 0; t < T; t++) {
        ['rgb', 'depth'].forEach(function (kind) {
          var im = new Image();
          im.src = base + scene.images[kind].replace('{t}', (t < 10 ? '0' : '') + t);
          images[kind].push(im.src);
          images.preload.push(im);
        });
      }
      slider.max = T - 1;
      msg.style.display = 'none';
      setControlsEnabled(true);
      resetView();
      setFrame(0);
      last = 0;
      kick();
    }

    /* camera */
    function eyePos() {
      var sp = Math.sin(view.phi), cp = Math.cos(view.phi), ct = Math.cos(view.theta), st = Math.sin(view.theta);
      return [0, 1, 2].map(function (k) {
        return view.target[k] + view.r * (sp * (ct * AX_A[k] + st * AX_B[k]) + cp * UP[k]);
      });
    }
    function setEyeTarget(eye, target) {
      var off = sub(eye, target), r = Math.sqrt(dot(off, off)) || 1;
      view.target = target.slice();
      view.r = r;
      view.phi = Math.acos(Math.max(-1, Math.min(1, dot(off, UP) / r)));
      view.theta = Math.atan2(dot(off, AX_B), dot(off, AX_A));
    }
    // Default view: the export's observer direction, moved and centred so the whole cloud and trajectory fit
    function resetView() {
      var o = S.scene.observer;
      view.fov = o.fov || 52;
      var dir = norm(sub(o.pos, o.target)), target = o.target.slice();
      var aspect = (stage.clientWidth || 16) / (stage.clientHeight || 9), fov = view.fov * Math.PI / 180;
      var tanY = Math.tan(fov / 2), proj = perspective(fov, aspect, 0.05, 1000);
      function extent(r, tg) {
        var eye = [tg[0] + dir[0] * r, tg[1] + dir[1] * r, tg[2] + dir[2] * r];
        var M = mul(proj, lookAt(eye, tg, UP)), e = [Infinity, -Infinity, Infinity, -Infinity];
        for (var i = 0; i < S.fit.length; i++) {
          var p = S.fit[i], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15];
          if (w < 0.1) return null;
          var x = (M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12]) / w, y = (M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13]) / w;
          e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], y); e[3] = Math.max(e[3], y);
        }
        return e;
      }
      function fitDistance(tg) {
        var lo = 0.5, hi = 800;
        for (var i = 0; i < 40; i++) {
          var mid = (lo + hi) / 2, e = extent(mid, tg);
          if (!e || Math.max(-e[0], e[1], -e[2], e[3]) > 0.88) lo = mid; else hi = mid;
        }
        return hi;
      }
      var r = fitDistance(target);
      for (var pass = 0; pass < 2; pass++) {          // centre the framed content, then refit
        var e = extent(r, target);
        if (!e) break;
        var z = dir, x = norm(cross(UP, z)), y = cross(z, x);
        var cx = (e[0] + e[1]) / 2 * r * tanY * aspect, cy = (e[2] + e[3]) / 2 * r * tanY;
        for (var k = 0; k < 3; k++) target[k] += x[k] * cx + y[k] * cy;
        r = fitDistance(target);
      }
      setEyeTarget([target[0] + dir[0] * r, target[1] + dir[1] * r, target[2] + dir[2] * r], target);
      S.fitR = r;
      view.r /= (opts.zoom || 1);
      setFollow(false);
      dirty = true;
    }
    function cameraView() {
      var f = S.scene.frames[frame], z = [f.R[0][2], f.R[1][2], f.R[2][2]], d = S.medDepth[frame];
      setEyeTarget(f.c, [f.c[0] + d * z[0], f.c[1] + d * z[1], f.c[2] + d * z[2]]);
      view.fov = 2 * Math.atan(S.scene.H / 2 / S.scene.K[1]) * 180 / Math.PI;
    }
    function setFollow(on) {
      follow = on;
      camBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (on) cameraView();
      dirty = true;
    }
    function userMoved() { if (follow) setFollow(false); dirty = true; kick(); }
    function rotate(dx, dy) {
      var h = Math.max(480, stage.clientHeight || 1);   // small (phone) views would otherwise spin too fast
      view.theta -= 2 * Math.PI * dx / h;
      view.phi = Math.max(0.02, Math.min(Math.PI - 0.02, view.phi - 2 * Math.PI * dy / h));
      userMoved();
    }
    function pan(dx, dy) {
      var eye = eyePos(), z = norm(sub(eye, view.target)), x = norm(cross(UP, z)), y = cross(z, x);
      var s = 2 * view.r * Math.tan(view.fov * Math.PI / 360) / (stage.clientHeight || 1);
      for (var k = 0; k < 3; k++) view.target[k] += (-x[k] * dx + y[k] * dy) * s;
      userMoved();
    }
    function zoom(f) {
      var R0 = S ? S.fitR : 20;                    // limits scale with the scene (street vs. tabletop)
      view.r = Math.max(R0 * 0.03, Math.min(R0 * 12, view.r * f));
      userMoved();
    }

    /* frames */
    function updateInset() {
      if (!S) return;
      insetImg.src = images[colorMode === 'depth' ? 'depth' : 'rgb'][frame];
      insetCap.textContent = colorMode === 'depth' ? words.depth : words.frame;
    }
    function setFrame(t) {
      frame = t;
      slider.value = t;
      tLbl.textContent = 'Frame ' + (t + 1) + ' / ' + S.T;
      var f = S.scene.frames[t];
      gl.bindBuffer(gl.ARRAY_BUFFER, S.bAct);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(frustumSegs(S.scene.K, S.scene.W, S.scene.H, f.R, f.c, (S.scene.frustum || 0.9) * 1.18)));
      gl.bindBuffer(gl.ARRAY_BUFFER, S.bDot);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(f.c));
      if (follow) cameraView();
      updateInset();
      dirty = true;
    }
    function setPlaying(p) {
      playing = p;
      playBtn.textContent = p ? 'Pause' : 'Play';
      last = 0;
      kick();
    }
    function step(d) { if (!S) return; setPlaying(false); setFrame((frame + d + S.T) % S.T); kick(); }

    /* drawing */
    function draw() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(stage.clientWidth * dpr)), h = Math.max(1, Math.round(stage.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.clearColor(BG[0], BG[1], BG[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      var mvp = mul(perspective(view.fov * Math.PI / 180, w / h, S.fitR * 0.002, S.fitR * 60), lookAt(eyePos(), view.target, UP));

      // point cloud of the current frame (frames are stored one after another)
      var f = S.scene.frames[frame], first = S.start[frame], count = f.n;
      var ptSize = 2.2 * dpr;
      if (follow) ptSize = Math.max(ptSize, 1.2 * h * (S.scene.stride || 2) / S.scene.H);   // points sit on a stride x stride pixel grid
      gl.useProgram(P.p);
      gl.uniformMatrix4fv(P.u.m, false, mvp);
      gl.uniform1f(P.u.s, Math.min(S.maxPt, ptSize));
      gl.bindBuffer(gl.ARRAY_BUFFER, S.bPos);
      gl.enableVertexAttribArray(P.a.p);
      gl.vertexAttribPointer(P.a.p, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorMode === 'depth' ? S.bDep : S.bRgb);
      gl.enableVertexAttribArray(P.a.c);
      gl.vertexAttribPointer(P.a.c, 3, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.drawArrays(gl.POINTS, first, count);
      gl.disableVertexAttribArray(P.a.c);

      // cameras
      gl.useProgram(L.p);
      gl.uniformMatrix4fv(L.u.m, false, mvp);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      // WebGL lines are 1 device pixel wide: draw them 4 times, shifted by under a pixel, so they read on HiDPI screens
      var lw = 0.75 * dpr, offs = [[0, 0], [2 * lw / w, 0], [0, 2 * lw / h], [2 * lw / w, 2 * lw / h]];
      function solid(buf, prim, n, col, size, round) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(L.a.p);
        gl.vertexAttribPointer(L.a.p, 3, gl.FLOAT, false, 0, 0);
        gl.uniform4fv(L.u.k, col);
        gl.uniform1f(L.u.s, Math.min(S.maxPt, (size || 1) * dpr));
        gl.uniform1f(L.u.r, round ? 1 : 0);
        var passes = prim === gl.POINTS ? 1 : offs.length;
        for (var i = 0; i < passes; i++) { gl.uniform2fv(L.u.o, offs[i]); gl.drawArrays(prim, 0, n); }
      }
      solid(S.bTraj, gl.LINE_STRIP, S.T, COL_TRAJ);
      solid(S.bTraj, gl.POINTS, S.T, COL_TRAJ, 5, true);
      if (!follow) {
        solid(S.bKey, gl.LINES, S.nKey, [COL_TRAJ[0], COL_TRAJ[1], COL_TRAJ[2], 0.7]);
        solid(S.bAct, gl.LINES, 18, COL_CUR);
        solid(S.bDot, gl.POINTS, 1, COL_CUR, 9, true);
      }
      gl.disable(gl.BLEND);
    }

    function kick() { if (!raf && visible && S) raf = requestAnimationFrame(tick); }
    function tick(ts) {
      raf = 0;
      if (!visible || !S) return;
      var animating = playing && !globalPaused;
      if (animating) {
        if (!last) last = ts;
        if (ts - last >= 1000 / (S.scene.fps * speed)) { last = ts; setFrame((frame + 1) % S.T); }
      }
      if (dirty) { dirty = false; draw(); }
      if (animating) raf = requestAnimationFrame(tick);
    }

    /* input */
    var hintTimer = 0;
    function showHint(text) {
      hint.textContent = text;
      hint.classList.add('show');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { hint.classList.remove('show'); }, 1400);
    }
    function bindInput() {
      var ptrs = {};
      function ids() { return Object.keys(ptrs); }
      canvas.addEventListener('pointerdown', function (e) {
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        stage.focus({ preventScroll: true });
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', function (e) {
        var p = ptrs[e.pointerId];
        if (!p) return;
        var list = ids();
        if (list.length === 1) {
          var dx = e.clientX - p.x, dy = e.clientY - p.y;
          p.x = e.clientX; p.y = e.clientY;
          if (p.pan) pan(dx, dy); else rotate(dx, dy);
        } else if (list.length === 2) {
          var a = ptrs[list[0]], b = ptrs[list[1]];
          var d0 = Math.hypot(a.x - b.x, a.y - b.y), m0 = [(a.x + b.x) / 2, (a.y + b.y) / 2];
          p.x = e.clientX; p.y = e.clientY;
          var d1 = Math.hypot(a.x - b.x, a.y - b.y), m1 = [(a.x + b.x) / 2, (a.y + b.y) / 2];
          if (d0 > 0 && d1 > 0) zoom(d0 / d1);
          pan(m1[0] - m0[0], m1[1] - m0[1]);
        }
      });
      function up(e) { delete ptrs[e.pointerId]; }
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      canvas.addEventListener('dblclick', function () { if (S) { resetView(); kick(); } });
      canvas.addEventListener('wheel', function (e) {
        if (!(e.ctrlKey || e.metaKey)) { showHint('Use ' + (IS_MAC ? '⌘' : 'Ctrl') + ' + scroll to zoom'); return; }
        e.preventDefault();
        var d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
        zoom(Math.exp(Math.max(-60, Math.min(60, d)) * 0.006));
      }, { passive: false });
      var g0 = 1;   // Safari trackpad pinch
      stage.addEventListener('gesturestart', function (e) { e.preventDefault(); g0 = 1; });
      stage.addEventListener('gesturechange', function (e) { e.preventDefault(); zoom(g0 / e.scale); g0 = e.scale; });
      stage.addEventListener('keydown', function (e) {
        if (e.code === 'Space') { setPlaying(!playing); e.preventDefault(); }
        else if (e.code === 'ArrowRight') { step(1); e.preventDefault(); }
        else if (e.code === 'ArrowLeft') { step(-1); e.preventDefault(); }
      });
      playBtn.addEventListener('click', function () { setPlaying(!playing); });
      slider.addEventListener('input', function () { if (!S) return; setPlaying(false); setFrame(Number(slider.value)); kick(); });
      camBtn.addEventListener('click', function () { if (!S) return; setFollow(!follow); kick(); });
      resetBtn.addEventListener('click', function () { if (S) { resetView(); kick(); } });
    }

    return {
      setSpeed: function (x) { speed = x || 1; last = 0; },
      setPaused: function (p) { globalPaused = !!p; last = 0; kick(); },
      _debug: function () { return { frame: frame, playing: playing, color: colorMode, follow: follow, view: view, loaded: !!S, points: S && S.N }; },
    };
  }

  window.WLViewer = { define: define, mount: mount };
})();
