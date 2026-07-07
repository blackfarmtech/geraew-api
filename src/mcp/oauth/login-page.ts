/**
 * Renders the OAuth login / consent page shown to the user when a client
 * (e.g. Claude) begins the authorization flow. The form carries the OAuth
 * parameters as hidden fields and posts them, together with the user's
 * credentials, to POST /mcp-oauth/login.
 */

export interface LoginPageParams {
  clientId: string;
  clientName?: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state?: string;
  scope?: string;
  resource?: string;
  googleClientId?: string;
  error?: string;
}

function esc(value: string | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLoginPage(p: LoginPageParams): string {
  const hidden = (name: string, value?: string): string =>
    `<input type="hidden" name="${name}" value="${esc(value)}" />`;

  const appName = esc(p.clientName || 'um aplicativo');

  const googleBlock = p.googleClientId
    ? `
      <div class="divider"><span>ou</span></div>
      <div id="g_id_onload"
           data-client_id="${esc(p.googleClientId)}"
           data-callback="onGoogleCredential"
           data-auto_prompt="false"></div>
      <div class="g_id_signin" data-type="standard" data-theme="filled_black"
           data-text="signin_with" data-shape="pill" data-width="320"></div>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      <script>
        function onGoogleCredential(response) {
          document.getElementById('google_id_token').value = response.credential;
          document.getElementById('login-form').submit();
        }
      </script>`
    : '';

  const errorBlock = p.error
    ? `<div class="error">${esc(p.error)}</div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Conectar à GeraEW</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif;
    background: #0a0a0f; color: #f4f4f5; padding: 24px;
  }
  .card {
    width: 100%; max-width: 380px; background: #14141b; border: 1px solid #26263a;
    border-radius: 16px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,.5);
  }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { font-size: 13px; color: #a1a1aa; margin: 0 0 24px; }
  label { display: block; font-size: 12px; color: #a1a1aa; margin: 14px 0 6px; }
  input[type=email], input[type=password] {
    width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #33334a;
    background: #0e0e15; color: #f4f4f5; font-size: 14px;
  }
  input:focus { outline: none; border-color: #8b5cf6; }
  button.primary {
    width: 100%; margin-top: 20px; padding: 12px; border: 0; border-radius: 10px;
    background: #8b5cf6; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button.primary:hover { background: #7c46f0; }
  .error { background: #3b1220; border: 1px solid #7f1d1d; color: #fca5a5;
    padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 16px; }
  .divider { display: flex; align-items: center; gap: 10px; margin: 22px 0 6px; color: #52525b; font-size: 12px; }
  .divider::before, .divider::after { content: ""; flex: 1; height: 1px; background: #26263a; }
  .g_id_signin { display: flex; justify-content: center; margin-top: 14px; }
  .foot { margin-top: 22px; font-size: 11px; color: #52525b; text-align: center; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1>Conectar à GeraEW</h1>
    <p class="sub">${appName} quer gerar imagens e vídeos usando a sua conta GeraEW.</p>
    ${errorBlock}
    <form id="login-form" method="post" action="/mcp-oauth/login">
      ${hidden('client_id', p.clientId)}
      ${hidden('redirect_uri', p.redirectUri)}
      ${hidden('code_challenge', p.codeChallenge)}
      ${hidden('code_challenge_method', p.codeChallengeMethod)}
      ${hidden('state', p.state)}
      ${hidden('scope', p.scope)}
      ${hidden('resource', p.resource)}
      <input type="hidden" id="google_id_token" name="google_id_token" value="" />

      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" placeholder="voce@exemplo.com" />

      <label for="password">Senha</label>
      <input id="password" name="password" type="password" autocomplete="current-password" placeholder="••••••••" />

      <button class="primary" type="submit">Entrar e autorizar</button>
      ${googleBlock}
    </form>
    <div class="foot">Ao autorizar, ${appName} poderá gerar conteúdo e consumir créditos da sua conta. Você pode revogar o acesso a qualquer momento.</div>
  </div>
</body>
</html>`;
}
