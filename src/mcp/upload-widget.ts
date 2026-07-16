/**
 * MCP Apps UI widget for "bring your own image" (SEP-1865, spec 2026-01-26).
 *
 * This is the inline, in-chat upload widget — modeled 1:1 on Higgsfield's
 * `media_upload_widget`: a drop zone → image thumbnail with a "Ready" badge and
 * an "X" to remove → a green "Continue" button the user must click to finish.
 * Nothing is injected into the conversation until "Continue" is pressed; then a
 * completion message carrying the public image URL is sent back, exactly like
 * Higgsfield's "The … upload is complete. Use … for my previous request."
 *
 * The host (e.g. claude.ai) renders this HTML in a sandboxed iframe when a tool
 * declares `_meta.ui.resourceUri` = UPLOAD_WIDGET_URI and the
 * `io.modelcontextprotocol/ui` capability was negotiated. Hosts that don't
 * support MCP Apps fall back to the tool's text content (browser upload link).
 *
 * Flow inside the iframe:
 *   1. postMessage JSON-RPC `ui/initialize` → read hostContext (theme).
 *   2. `ui/notifications/initialized`.
 *   3. Receive `ui/notifications/tool-result`; read structuredContent to get
 *      the upload endpoint (`${apiBase}/u/${token}`).
 *   4. User drops/picks an image → raw POST the bytes to that endpoint → "Ready".
 *   5. On "Continue", `ui/message` injects the resulting public URL back into
 *      the conversation so the model uses it in image_urls / the pending request.
 */

export const UPLOAD_WIDGET_URI = 'ui://geraew/upload-widget';
export const UPLOAD_WIDGET_MIME = 'text/html;profile=mcp-app';

export const UPLOAD_WIDGET_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --bg: var(--color-background-primary, #131318);
    --panel: var(--color-background-secondary, #1b1b22);
    --fg: var(--color-text-primary, #f4f4f6);
    --muted: var(--color-text-secondary, #9a9aa6);
    --border: var(--color-border-primary, #2a2a34);
    --accent: #bfff00;
    --accent-fg: #10130a;
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif);
  }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--fg); background: transparent; }
  .card {
    background: var(--bg); border: 1px solid var(--border); border-radius: 18px;
    overflow: hidden;
  }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; font-weight: 700; font-size: 14px;
  }
  .head .mark {
    width: 22px; height: 22px; border-radius: 6px; background: var(--accent);
    color: var(--accent-fg); display: grid; place-items: center; font-size: 13px; font-weight: 800;
  }
  .body { padding: 0 16px 16px; }
  .stage {
    position: relative; background: var(--panel); border-radius: 14px;
    min-height: 210px; display: grid; place-items: center; padding: 18px;
  }
  /* Empty / drop state */
  .drop { text-align: center; cursor: pointer; width: 100%; }
  .drop .plus {
    width: 46px; height: 46px; border-radius: 999px; margin: 0 auto;
    background: rgba(255,255,255,.06); border: 1px solid var(--border);
    display: grid; place-items: center; font-size: 24px; color: var(--fg);
  }
  .drop.drag .plus { border-color: var(--accent); color: var(--accent); }
  .drop .big { display: block; margin-top: 12px; font-size: 14px; font-weight: 600; }
  .drop .small { display: block; margin-top: 4px; font-size: 12px; color: var(--muted); }
  input[type=file] { display: none; }
  /* Thumbnail state */
  .thumb {
    position: relative; width: 150px; height: 150px; border-radius: 12px;
    overflow: hidden; border: 1px solid var(--border); background: #0c0c10;
  }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb .badge {
    position: absolute; left: 0; right: 0; bottom: 0; padding: 6px 8px;
    font-size: 12px; font-weight: 600; text-align: center; color: #fff;
    background: linear-gradient(transparent, rgba(0,0,0,.72));
  }
  .thumb .x {
    position: absolute; top: 6px; right: 6px; width: 22px; height: 22px;
    border-radius: 999px; border: none; cursor: pointer;
    background: rgba(0,0,0,.55); color: #fff; font-size: 13px; line-height: 22px;
  }
  .thumb .prog {
    position: absolute; left: 8px; right: 8px; bottom: 8px; height: 5px;
    border-radius: 999px; background: rgba(255,255,255,.2); overflow: hidden;
  }
  .thumb .prog > i { display: block; height: 100%; width: 0%; background: var(--accent); transition: width .2s; }
  /* Footer */
  .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; min-height: 34px; }
  .msg { font-size: 12.5px; color: var(--muted); }
  .msg.err { color: #ff6b6b; }
  .continue {
    border: none; border-radius: 999px; padding: 9px 20px; font-size: 14px; font-weight: 700;
    background: var(--accent); color: var(--accent-fg); cursor: pointer;
  }
  .continue[disabled] { opacity: .4; cursor: default; }
  /* Done state */
  .done { text-align: center; padding: 20px 8px; }
  .done .check { font-size: 42px; }
  .done h2 { margin: 8px 0 4px; font-size: 16px; }
  .done p { color: var(--muted); font-size: 13px; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <div class="head"><span id="title">Enviar imagem</span><span class="mark">EW</span></div>
    <div class="body" id="body">
      <div class="stage" id="stage">
        <label class="drop" id="drop">
          <span class="plus">+</span>
          <span class="big">Upload image</span>
          <span class="small">PNG, JPG ou WEBP · até 25MB</span>
          <input type="file" id="file" accept="image/png,image/jpeg,image/webp" />
        </label>
      </div>
      <div class="foot" id="foot" style="display:none">
        <span class="msg" id="msg"></span>
        <button class="continue" id="continue" disabled>Continue</button>
      </div>
    </div>
  </div>
<script>
(function () {
  var MAX = 25 * 1024 * 1024;
  var OK = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1 };
  var nextId = 1, pending = {}, endpoint = null;
  var current = null; // { file, url, blobUrl }
  var uploading = false, sent = false;

  function rpc(method, params) {
    var id = nextId++;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      window.parent.postMessage({ jsonrpc: '2.0', id: id, method: method, params: params || {} }, '*');
    });
  }
  function notify(method, params) {
    window.parent.postMessage({ jsonrpc: '2.0', method: method, params: params || {} }, '*');
  }

  var elStage = document.getElementById('stage');
  var elFoot = document.getElementById('foot');
  var elMsg = document.getElementById('msg');
  var elContinue = document.getElementById('continue');

  function setMsg(text, isErr) {
    elMsg.className = 'msg' + (isErr ? ' err' : '');
    elMsg.textContent = text || '';
  }
  function applyTheme(hostContext) {
    try {
      var vars = hostContext && hostContext.styles && hostContext.styles.variables;
      if (!vars) return;
      var root = document.documentElement;
      Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    } catch (e) {}
  }

  window.addEventListener('message', function (ev) {
    var msg = ev.data;
    if (!msg || msg.jsonrpc !== '2.0') return;
    if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
      var p = pending[msg.id]; if (!p) return; delete pending[msg.id];
      if (msg.error) p.reject(msg.error); else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'ui/notifications/tool-result') {
      try {
        var sc = msg.params && msg.params.structuredContent;
        if (sc && sc.upload_endpoint) endpoint = sc.upload_endpoint;
      } catch (e) {}
    }
  });

  (async function boot() {
    try {
      var res = await rpc('ui/initialize', {
        protocolVersion: '2026-01-26',
        capabilities: {},
        clientInfo: { name: 'geraew-upload', version: '1.0.0' },
        appCapabilities: { availableDisplayModes: ['inline'] }
      });
      applyTheme(res && res.hostContext);
      notify('ui/notifications/initialized', {});
      try {
        var sc = res && res.hostContext && res.hostContext.toolInfo
          && res.hostContext.toolInfo.result && res.hostContext.toolInfo.result.structuredContent;
        if (sc && sc.upload_endpoint) endpoint = sc.upload_endpoint;
      } catch (e) {}
    } catch (e) {}
  })();

  // ── Drop / pick wiring (rebound whenever the empty state is rendered) ──
  function wireDrop() {
    var drop = document.getElementById('drop');
    var file = document.getElementById('file');
    if (!drop || !file) return;
    ['dragenter', 'dragover'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (ev) {
      var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) pick(f);
    });
    file.addEventListener('change', function () { if (file.files[0]) pick(file.files[0]); });
  }
  wireDrop();

  function renderEmpty() {
    if (current && current.blobUrl) { try { URL.revokeObjectURL(current.blobUrl); } catch (e) {} }
    current = null; uploading = false;
    elStage.innerHTML =
      '<label class="drop" id="drop"><span class="plus">+</span>' +
      '<span class="big">Upload image</span>' +
      '<span class="small">PNG, JPG ou WEBP · até 25MB</span>' +
      '<input type="file" id="file" accept="image/png,image/jpeg,image/webp" /></label>';
    wireDrop();
    elFoot.style.display = 'none';
    setMsg('');
    elContinue.disabled = true;
  }

  function renderThumb() {
    elStage.innerHTML =
      '<div class="thumb">' +
      '<img src="' + current.blobUrl + '" alt="" />' +
      '<button class="x" id="rm" title="Remover">✕</button>' +
      '<div class="prog" id="prog"><i id="fill"></i></div>' +
      '<div class="badge" id="badge">Enviando…</div>' +
      '</div>';
    document.getElementById('rm').addEventListener('click', function () {
      if (uploading) return; renderEmpty();
    });
    elFoot.style.display = 'flex';
    setMsg('');
    elContinue.disabled = true;
  }

  function markReady() {
    var prog = document.getElementById('prog');
    var badge = document.getElementById('badge');
    // Swap the blob preview for the CDN URL, which the sandbox CSP allows via
    // resourceDomains (blob: img-src may be blocked); guarantees the thumbnail.
    var img = elStage.querySelector('.thumb img');
    if (img && current && current.url) img.setAttribute('src', current.url);
    if (prog) prog.style.display = 'none';
    if (badge) badge.textContent = 'Ready';
    elContinue.disabled = false;
  }

  async function pick(f) {
    if (uploading) return;
    if (!OK[f.type]) { renderEmpty(); setMsg('Formato não suportado. Use PNG, JPG ou WEBP.', true); elFoot.style.display = 'flex'; return; }
    if (f.size > MAX) { renderEmpty(); setMsg('Arquivo muito grande (máx 25MB).', true); elFoot.style.display = 'flex'; return; }
    current = { file: f, url: null, blobUrl: URL.createObjectURL(f) };
    renderThumb();
    await doUpload();
  }

  async function doUpload() {
    if (!endpoint) { setMsg('Preparando o envio…', false);
      // brief retry: the tool-result may still be in flight
      var waited = 0;
      while (!endpoint && waited < 5000) { await new Promise(function (r) { setTimeout(r, 250); }); waited += 250; }
      if (!endpoint) { setMsg('Não consegui preparar o envio. Feche e tente de novo.', true); return; }
    }
    uploading = true;
    var fill = document.getElementById('fill');
    if (fill) fill.style.width = '20%';
    try {
      var r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': current.file.type }, body: current.file });
      if (fill) fill.style.width = '100%';
      var j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j.ok || !j.url) throw new Error(j.message || 'Falha no envio.');
      current.url = j.url;
      uploading = false;
      markReady();
    } catch (e) {
      uploading = false;
      var badge = document.getElementById('badge');
      if (badge) badge.textContent = 'Erro';
      setMsg((e && e.message) ? e.message : 'Erro de conexão.', true);
    }
  }

  elContinue.addEventListener('click', async function () {
    if (sent || !current || !current.url) return;
    sent = true;
    elContinue.disabled = true;
    var name = current.file.name || 'imagem';
    document.getElementById('body').innerHTML =
      '<div class="done"><div class="check">✅</div><h2>Imagem enviada!</h2>' +
      '<p>Já pode continuar — a GeraEW vai usar esta imagem como referência.</p></div>';
    try {
      await rpc('ui/message', {
        role: 'user',
        content: {
          type: 'text',
          text: 'The GeraEW upload is complete. Use this public image URL as the reference (image_urls) for my previous request: '
            + current.url + '. Filename: ' + name + '.'
        }
      });
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
