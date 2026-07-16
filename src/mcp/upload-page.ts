/**
 * Renders the "drop your image" page opened by the user during the MCP
 * `geraew_upload_image` flow. The page uploads the selected/dropped image as a
 * raw binary POST to the same URL and shows a success state when done.
 *
 * No external scripts or styles — safe under a strict CSP.
 */

export const UPLOAD_PAGE_CSP = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline'",
  'img-src data: blob:',
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Human-readable list of accepted formats, kept in sync with the server. */
const ACCEPTED = 'PNG, JPG ou WEBP · até 25MB';

export function renderUploadPage(opts: {
  /** POST target (same path as the page). */
  action: string;
  /** true when the session no longer exists / expired. */
  expired?: boolean;
  /** Pre-filled URL when the image was already uploaded in this session. */
  alreadyUrl?: string;
}): string {
  const shell = (inner: string): string => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex" />
<title>Enviar imagem · GeraEW</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: grid; place-items: center;
    padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, #1c1c22 0%, #0b0b0e 60%);
    color: #f4f4f6;
  }
  .card {
    width: 100%; max-width: 420px; background: #14141a;
    border: 1px solid #26262f; border-radius: 20px; padding: 28px 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,.45);
  }
  .brand { font-weight: 700; letter-spacing: .3px; font-size: 15px; color: #bfff00; }
  h1 { font-size: 20px; margin: 14px 0 6px; }
  p.sub { margin: 0 0 20px; color: #a1a1ad; font-size: 14px; line-height: 1.45; }
  .drop {
    border: 1.5px dashed #3a3a46; border-radius: 16px; padding: 32px 18px;
    text-align: center; cursor: pointer; transition: border-color .15s, background .15s;
    background: #101015;
  }
  .drop.drag { border-color: #bfff00; background: #16180f; }
  .drop svg { width: 40px; height: 40px; opacity: .7; }
  .drop .big { display: block; margin-top: 10px; font-size: 15px; font-weight: 600; }
  .drop .small { display: block; margin-top: 4px; font-size: 12.5px; color: #8b8b96; }
  input[type=file] { display: none; }
  .preview { margin-top: 18px; text-align: center; }
  .preview img { max-width: 100%; max-height: 240px; border-radius: 12px; border: 1px solid #26262f; }
  .status { margin-top: 16px; font-size: 14px; text-align: center; min-height: 20px; }
  .status.err { color: #ff6b6b; }
  .status.ok { color: #bfff00; }
  .bar { height: 6px; border-radius: 999px; background: #22222b; overflow: hidden; margin-top: 14px; display: none; }
  .bar.on { display: block; }
  .bar > i { display: block; height: 100%; width: 0%; background: #bfff00; transition: width .2s; }
  .done { text-align: center; }
  .done .check { font-size: 44px; }
  .done h2 { margin: 8px 0 6px; font-size: 19px; }
  .done p { color: #a1a1ad; font-size: 14px; margin: 0; }
</style>
</head>
<body>
  <div class="card">${inner}</div>
</body>
</html>`;

  if (opts.expired) {
    return shell(`
      <div class="brand">GeraEW</div>
      <h1>Link expirado</h1>
      <p class="sub">Este link de envio não é mais válido. Volte ao chat e peça um novo link para enviar sua imagem.</p>
    `);
  }

  if (opts.alreadyUrl) {
    return shell(`
      <div class="done">
        <div class="check">✅</div>
        <h2>Imagem já recebida</h2>
        <p>Pode voltar ao chat — a GeraEW já está com a sua imagem.</p>
      </div>
    `);
  }

  return shell(`
    <div class="brand">GeraEW</div>
    <h1>Envie sua imagem</h1>
    <p class="sub">Solte ou selecione a foto que você quer usar como referência. Assim que enviar, volte ao chat.</p>

    <label class="drop" id="drop">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <span class="big">Toque para escolher ou arraste aqui</span>
      <span class="small">${ACCEPTED}</span>
      <input type="file" id="file" accept="image/png,image/jpeg,image/webp" />
    </label>

    <div class="preview" id="preview"></div>
    <div class="bar" id="bar"><i id="fill"></i></div>
    <div class="status" id="status"></div>

    <script>
      (function () {
        var ACTION = ${JSON.stringify(opts.action)};
        var MAX = 25 * 1024 * 1024;
        var OK = { 'image/png': 1, 'image/jpeg': 1, 'image/webp': 1 };
        var drop = document.getElementById('drop');
        var file = document.getElementById('file');
        var status = document.getElementById('status');
        var preview = document.getElementById('preview');
        var bar = document.getElementById('bar');
        var fill = document.getElementById('fill');
        var busy = false;

        function setStatus(msg, cls) { status.className = 'status' + (cls ? ' ' + cls : ''); status.textContent = msg; }

        ['dragenter','dragover'].forEach(function (e) {
          drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('drag'); });
        });
        ['dragleave','drop'].forEach(function (e) {
          drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('drag'); });
        });
        drop.addEventListener('drop', function (ev) {
          var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
          if (f) upload(f);
        });
        file.addEventListener('change', function () { if (file.files[0]) upload(file.files[0]); });

        function upload(f) {
          if (busy) return;
          if (!OK[f.type]) { setStatus('Formato não suportado. Use ${ACCEPTED}.', 'err'); return; }
          if (f.size > MAX) { setStatus('Arquivo muito grande (máx 25MB).', 'err'); return; }

          preview.innerHTML = '';
          var img = document.createElement('img');
          img.src = URL.createObjectURL(f);
          preview.appendChild(img);

          busy = true; setStatus('Enviando…'); bar.classList.add('on'); fill.style.width = '0%';

          var xhr = new XMLHttpRequest();
          xhr.open('POST', ACTION, true);
          xhr.setRequestHeader('Content-Type', f.type);
          xhr.upload.onprogress = function (e) {
            if (e.lengthComputable) fill.style.width = Math.round((e.loaded / e.total) * 100) + '%';
          };
          xhr.onload = function () {
            busy = false;
            if (xhr.status >= 200 && xhr.status < 300) {
              document.querySelector('.card').innerHTML =
                '<div class="done"><div class="check">✅</div><h2>Imagem enviada!</h2><p>Pode voltar ao chat — a GeraEW já está com a sua imagem.</p></div>';
            } else {
              bar.classList.remove('on');
              var msg = 'Falha no envio. Tente novamente.';
              try { msg = JSON.parse(xhr.responseText).message || msg; } catch (e) {}
              setStatus(msg, 'err');
            }
          };
          xhr.onerror = function () { busy = false; bar.classList.remove('on'); setStatus('Erro de conexão. Tente novamente.', 'err'); };
          xhr.send(f);
        }
      })();
    </script>
  `);
}
