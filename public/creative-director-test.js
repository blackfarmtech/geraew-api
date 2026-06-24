const $ = (id) => document.getElementById(id);
const state = { token: '', sessionId: '', status: '', proposal: null, lastGenerationId: '', sse: null };

function setStatus(s) {
  state.status = s || '—';
  const p = $('statusPill');
  p.textContent = s || '—';
  p.className = 'pill status ' + (s || '');
}
function api() { return $('baseUrl').value.replace(/\/+$/, ''); }
function authHeaders() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (($('token').value || '').trim() || state.token) }; }

function log(msg, kind = 'info') {
  const el = document.createElement('div');
  el.className = 'l-' + kind;
  el.textContent = '› ' + msg;
  $('log').prepend(el);
}
function addMsg(role, text) {
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.textContent = text;
  $('chat').appendChild(el);
  $('chat').scrollTop = $('chat').scrollHeight;
}

async function jsonOrThrow(res) {
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const m = data?.message || data?.error?.message || data?.code || data?.raw || ('HTTP ' + res.status);
    throw new Error(typeof m === 'string' ? m : JSON.stringify(m));
  }
  return data;
}

// ---- LOGIN ----
$('loginBtn').onclick = async () => {
  try {
    $('authHint').textContent = 'Entrando...';
    const res = await fetch(api() + '/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('email').value, password: $('password').value }),
    });
    const data = await jsonOrThrow(res);
    state.token = data.accessToken;
    $('token').value = data.accessToken;
    $('authHint').innerHTML = '<span style="color:var(--ok)">✓ Logado.</span> Token carregado.';
  } catch (e) {
    $('authHint').innerHTML = '<span style="color:var(--err)">Falha: ' + e.message + '</span>';
  }
};
$('token').oninput = () => { state.token = $('token').value.trim(); };

// Sempre lê o token ao vivo do campo (cobre autofill que não dispara 'input').
function currentToken() {
  const t = ($('token').value || '').trim();
  state.token = t;
  return t;
}

// ---- NEW SESSION ----
$('newSessionBtn').onclick = async () => {
  if (!currentToken()) {
    $('authHint').innerHTML = '<span style="color:var(--err)">Faça login ou cole um token primeiro.</span>';
    return;
  }
  try {
    const res = await fetch(api() + '/api/v1/creative-sessions', {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ platform: $('platform').value || undefined, format: $('format').value || undefined }),
    });
    const s = await jsonOrThrow(res);
    state.sessionId = s.id;
    $('sessionId').textContent = s.id.slice(0, 8) + '…';
    setStatus(s.status);
    $('chat').innerHTML = '';
    addMsg('system', 'Sessão criada. Converse com o Director abaixo.');
    $('composer').classList.remove('disconnected');
    $('apiUrl').textContent = api();
    renderBrief(null);
    $('proposalBox').innerHTML = '';
    $('approveBtn').disabled = true;
    log('sessão ' + s.id + ' criada', 'ok');
  } catch (e) {
    alert('Erro ao criar sessão: ' + e.message);
  }
};

// ---- SEND MESSAGE ----
async function send() {
  const text = $('messageInput').value.trim();
  if (!text || !state.sessionId) return;
  addMsg('user', text);
  $('messageInput').value = '';
  $('sendBtn').disabled = true;
  try {
    const res = await fetch(api() + '/api/v1/creative-sessions/' + state.sessionId + '/messages', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: text }),
    });
    const data = await jsonOrThrow(res);
    addMsg('assistant', data.reply);
    setStatus(data.status);
    renderBrief(data.brief);
    if (data.ready && data.proposedGeneration) {
      state.proposal = data.proposedGeneration;
      renderProposal(data.proposedGeneration);
      $('approveBtn').disabled = false;
    } else {
      $('proposalBox').innerHTML = '';
      $('approveBtn').disabled = true;
    }
  } catch (e) {
    addMsg('system', '⚠ erro: ' + e.message);
  } finally {
    $('sendBtn').disabled = false;
  }
}
$('sendBtn').onclick = send;
$('messageInput').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

// ---- APPROVE ----
$('approveBtn').onclick = async () => {
  if (!confirm('Aprovar e disparar a geração? Isso vai consumir créditos.')) return;
  $('approveBtn').disabled = true;
  try {
    const res = await fetch(api() + '/api/v1/creative-sessions/' + state.sessionId + '/approve', {
      method: 'POST', headers: authHeaders(),
    });
    const data = await jsonOrThrow(res);
    setStatus(data.status);
    state.lastGenerationId = data.generationId;
    log('geração disparada: ' + data.generationId + ' (créditos: ' + data.creditsConsumed + ')', 'ok');
    addMsg('system', '🎬 Geração disparada — acompanhando status (polling).');
    pollGeneration();
  } catch (e) {
    log('approve falhou: ' + e.message, 'err');
    setStatus(state.status); // serviço reverte pra AWAITING_APPROVAL
    $('approveBtn').disabled = false;
    alert('Falha ao aprovar: ' + e.message);
  }
};

// ---- Polling do status da geração ----
// (O SSE /generations/events autentica só via header Authorization, que o
//  EventSource não envia — por isso usamos polling com fetch aqui.)
async function pollGeneration() {
  if (!state.lastGenerationId) return;
  let tries = 0;
  const tick = async () => {
    tries++;
    try {
      const res = await fetch(api() + '/api/v1/generations/' + state.lastGenerationId, { headers: authHeaders() });
      const g = await jsonOrThrow(res);
      log('polling #' + tries + ': ' + g.status, 'info');
      if (g.status === 'completed') { showResult(g.outputUrl || g.output_url); return; }
      if (g.status === 'failed') { log('geração FALHOU: ' + (g.errorMessage || ''), 'err'); return; }
    } catch (e) { log('polling erro: ' + e.message, 'err'); }
    if (tries < 60) setTimeout(tick, 3000);
  };
  tick();
}
function showResult(url) {
  log('✓ geração concluída', 'ok');
  $('resultBox').innerHTML = '<img class="result" src="' + url + '" alt="resultado" referrerpolicy="no-referrer" />'
    + '<div class="hint"><a href="' + url + '" target="_blank" style="color:var(--accent)">abrir original</a> '
    + '(se a imagem não aparecer aqui por CSP, use o link)</div>';
}

// ---- RENDER ----
const BRIEF_KEYS = [['produto','Produto'],['objetivo','Objetivo'],['persona','Persona'],['plataforma','Plataforma'],['formato','Formato']];
function renderBrief(brief) {
  const c = $('brief');
  c.innerHTML = '';
  BRIEF_KEYS.forEach(([k, label]) => {
    const v = brief ? brief[k] : null;
    const row = document.createElement('div');
    row.className = 'brief-field';
    row.innerHTML = '<span class="k">' + label + '</span>'
      + '<span class="v ' + (v ? 'filled' : 'empty') + '">' + (v ? escapeHtml(v) : '—') + '</span>';
    c.appendChild(row);
  });
}
function renderProposal(p) {
  $('proposalBox').innerHTML =
    '<div class="proposal"><h3>Proposta de geração</h3>'
    + '<div class="p"><b>aspect_ratio:</b> ' + escapeHtml(p.aspect_ratio || '9:16') + '</div>'
    + (p.rationale ? '<div class="p" style="margin-top:6px;color:var(--muted)"><b>porquê:</b> ' + escapeHtml(p.rationale) + '</div>' : '')
    + '<pre>' + escapeHtml(p.prompt) + '</pre></div>';
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

$('apiUrl').textContent = api();
renderBrief(null);
