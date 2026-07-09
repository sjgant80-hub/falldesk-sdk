// falldesk SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from falldesk/index.html · 81276 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

/*!
 * Fall Kit · v1.0.0 · the shared cascade for every estate seed
 *
 * Inlineable JS module. Drop into any seed via <script> or copy-paste inline.
 * Preserves single-HTML sovereignty (no external deps until user opts in to T2 WebLLM).
 *
 * What it gives every seed:
 *  - AI tier picker: T0 (off · default) · T2 (WebLLM in-browser, 5 models 1B-70B) · T3 (BYOK Anthropic/OpenAI/Google)
 *  - Universal entry: FallKit.aiComplete(systemPrompt, userMsg, maxTokens) → string|null
 *  - AI chip UI in header
 *  - WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN)
 *  - Help section partial: FallKit.helpSection()
 *  - Settings panel: FallKit.openSettings()
 *
 * Doctrine (per botler CLAUDE.md):
 *  - T0 fallback ALWAYS works · aiComplete returns null · caller MUST degrade gracefully
 *  - NEVER hide a feature behind AI · NEVER proxy API keys · NEVER log keys
 *  - WebLLM is lazy-loaded · model weights download ONLY on user opt-in
 *
 * Estate-first canonical references:
 *  - WebLLM pattern: Downloads/botler/index.html (T0/T2/T3 cascade)
 *  - WebRTC pattern: Downloads/fallnet/fallnet-shim.js (raw RTCPeerConnection)
 *  - Mesh channel:   'fall-signal'
 */
(function (root) {
  'use strict';
  const FALL_KIT_VERSION = '1.2.0';
  const KCC_MINT_URL = 'https://sjgant80-hub.github.io/kcc-mint/';
  // ─── Model registry ──────────────────────────────────────────────
  const WEBLLM_MODELS = {
    'llama-1b':  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',   size: '~700MB', label: '1B · fast · any laptop / phone' },
    'llama-3b':  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',   size: '~2GB',   label: '3B · balanced · default · most laptops' },
    'qwen-7b':   { id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',     size: '~5GB',   label: '7B · capable · needs decent GPU (M-series Mac / 8GB+ VRAM)' },
    'llama-8b':  { id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',   size: '~5GB',   label: '8B · common · needs decent GPU' },
    'llama-70b': { id: 'Llama-3.1-70B-Instruct-q4f16_1-MLC',  size: '~40GB',  label: '70B · frontier · needs serious GPU + 64GB+ RAM' },
  };
  const DEFAULT_MODEL = 'llama-3b';
  const T3_PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', models: ['claude-sonnet-4-5','claude-opus-4-7','claude-haiku-4-5'], default: 'claude-sonnet-4-5', url: 'https://api.anthropic.com/v1/messages' },
    openai:    { label: 'OpenAI',           models: ['gpt-4o','gpt-4o-mini','o1-mini'],                          default: 'gpt-4o-mini',      url: 'https://api.openai.com/v1/chat/completions' },
    google:    { label: 'Google Gemini',    models: ['gemini-1.5-pro','gemini-1.5-flash','gemini-2.0-flash-exp'], default: 'gemini-1.5-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/' },
  };
  // ─── State ───────────────────────────────────────────────────────
  const STATE = {
    config: loadConfig(),
    ai: { ready: false, loading: false, progress: 0, engine: null, model: null },
    mesh: { active: false, peers: new Map(), bc: null, signal: null },
  };
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem('fall-kit.config') || '{}'); }
    catch (e) { return {}; }
  }
  function saveConfig() {
    try { localStorage.setItem('fall-kit.config', JSON.stringify(STATE.config)); } catch (e) {}
  }
  // ─── DOM helpers ─────────────────────────────────────────────────
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  // ─── AI tier ─────────────────────────────────────────────────────
  function aiTier() { return STATE.config.ai_tier || 'T0'; }
  function renderAiChip() {
    const chip = $('#fk-ai-chip');
    if (!chip) return;
    const txt = $('#fk-ai-chip-text');
    chip.classList.remove('fk-chip-live', 'fk-chip-loading', 'fk-chip-warn');
    const tier = aiTier();
    if (tier === 'T0') { txt.textContent = 'T0 · off'; }
    else if (tier === 'T2') {
      if (STATE.ai.ready) { txt.textContent = 'T2 ' + (WEBLLM_MODELS[STATE.config.webllm_model || DEFAULT_MODEL]?.label.split(' · ')[0] || '') + ' · ready'; chip.classList.add('fk-chip-live'); }
      else if (STATE.ai.loading) { txt.textContent = 'T2 loading ' + Math.round(STATE.ai.progress) + '%'; chip.classList.add('fk-chip-loading'); }
      else { txt.textContent = 'T2 · click to load'; chip.classList.add('fk-chip-warn'); }
    } else if (tier === 'T3') {
      if (STATE.config.api_key) { txt.textContent = 'T3 ' + (T3_PROVIDERS[STATE.config.api_provider]?.label || 'BYOK') + ' · active'; chip.classList.add('fk-chip-live'); }
      else { txt.textContent = 'T3 · no key set'; chip.classList.add('fk-chip-warn'); }
    }
  }
  async function loadWebLLM(modelKey) {
    if (STATE.ai.loading) return;
    const key = modelKey || STATE.config.webllm_model || DEFAULT_MODEL;
    const model = WEBLLM_MODELS[key];
    if (!model) { console.error('fall-kit: unknown model', key); return; }
    if (STATE.ai.ready && STATE.ai.model === model.id) return;
    STATE.ai.loading = true; STATE.ai.progress = 0; renderAiChip();
    notify('Loading WebLLM · ' + model.label + ' · ' + model.size + ' first time', 'info');
    try {
      const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
      const engine = await CreateMLCEngine(model.id, {
        initProgressCallback: p => { STATE.ai.progress = (p.progress || 0) * 100; renderAiChip(); }
      });
      STATE.ai.engine = engine;
      STATE.ai.model = model.id;
      STATE.ai.ready = true;
      STATE.ai.loading = false;
      STATE.config.webllm_model = key; saveConfig();
      renderAiChip();
      notify('WebLLM ready · sovereign mode · ' + model.label.split(' · ')[0], 'ok');
    } catch (e) {
      console.error('fall-kit: WebLLM load failed', e);
      STATE.ai.loading = false; renderAiChip();
      notify('WebLLM load failed · ' + e.message, 'err');
    }
  }
  async function aiComplete(systemPrompt, userMsg, maxTokens) {
    maxTokens = maxTokens || 600;
    const tier = aiTier();
    if (tier === 'T2' && STATE.ai.ready && STATE.ai.engine) {
      const r = await STATE.ai.engine.chat.completions.create({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        max_tokens: maxTokens,
      });
      return r.choices[0].message.content;
    }
    if (tier === 'T3' && STATE.config.api_key && STATE.config.api_provider) {
      return await aiCloudCall(systemPrompt, userMsg, maxTokens);
    }
    return null;
  }
  async function aiCloudCall(sys, msg, maxTokens) {
    const provider = STATE.config.api_provider;
    const key = STATE.config.api_key;
    const model = STATE.config.api_model || T3_PROVIDERS[provider]?.default;
    if (provider === 'anthropic') {
      const r = await fetch(T3_PROVIDERS.anthropic.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return j.content[0].text;
    }
    if (provider === 'openai') {
      const r = await fetch(T3_PROVIDERS.openai.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] }),
      });
      if (!r.ok) throw new Error('OpenAI ' + r.status);
      const j = await r.json();
      return j.choices[0].message.content;
    }
    if (provider === 'google') {
      const r = await fetch(T3_PROVIDERS.google.url + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: sys + '\n\n---\n\n' + msg }] }], generationConfig: { maxOutputTokens: maxTokens } }),
      });
      if (!r.ok) throw new Error('Google ' + r.status);
      const j = await r.json();
      return j.candidates[0].content.parts[0].text;
    }
    throw new Error('unknown provider: ' + provider);
  }
  // ─── WebRTC P2P mesh (ported from canonical fallnet · fall-signal channel · Google STUN) ───
  const MESH_CHANNEL = 'fall-signal';
  const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function meshStart(opts) {
    if (STATE.mesh.active) return;
    opts = opts || {};
    const seedId = opts.seedId || (location.pathname + '#' + Math.random().toString(36).slice(2, 8));
    STATE.mesh.seedId = seedId;
    try { STATE.mesh.bc = new BroadcastChannel(MESH_CHANNEL); }
    catch (e) { console.warn('fall-kit: BroadcastChannel unavailable'); return; }
    STATE.mesh.bc.onmessage = e => {
      const m = e.data;
      if (!m || !m.kind || m.peerId === seedId) return;
      if (opts.onMessage) opts.onMessage(m);
    };
    STATE.mesh.bc.postMessage({ kind: 'fall-kit:hello', peerId: seedId, ts: Date.now(), seedName: opts.seedName || 'unknown' });
    STATE.mesh.active = true;
    notify('Mesh active · channel ' + MESH_CHANNEL, 'ok');
  }
  function meshPost(kind, payload) {
    if (!STATE.mesh.active || !STATE.mesh.bc) return false;
    STATE.mesh.bc.postMessage({ kind: kind, peerId: STATE.mesh.seedId, ts: Date.now(), payload: payload });
    return true;
  }
  // ─── Toast ───────────────────────────────────────────────────────
  function notify(msg, kind) {
    let t = $('#fk-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'fk-toast';
      t.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(20px);background:#c08a3a;color:#0a0a0a;padding:9px 18px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;opacity:0;transition:all .22s;z-index:10000;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#a14a2a' : kind === 'ok' ? '#6b8d4a' : '#c08a3a';
    t.style.color = kind === 'err' ? '#fff' : '#0a0a0a';
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2400);
  }
  // ─── Settings modal ──────────────────────────────────────────────
  function openSettings() {
    let bg = $('#fk-modal-bg');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'fk-modal-bg';
      bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow-y:auto;z-index:9999';
      bg.onclick = e => { if (e.target.id === 'fk-modal-bg') closeSettings(); };
      document.body.appendChild(bg);
    }
    const tier = aiTier();
    const provider = STATE.config.api_provider || 'anthropic';
    const providerCfg = T3_PROVIDERS[provider];
    bg.innerHTML = `
      <div style="background:#13121a;border:1px solid #c08a3a;border-radius:5px;max-width:600px;width:100%;padding:22px 24px;color:#ebe3d2;font-family:system-ui,-apple-system,sans-serif;font-size:13.5px;line-height:1.55">
        <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Tier</label>
          <select id="fk-tier" style="width:100%;padding:8px 11px;background:#1a1922;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13.5px;font-family:inherit">
            <option value="T0"${tier==='T0'?' selected':''}>T0 · off (default · the seed works fully without AI)</option>
            <option value="T2"${tier==='T2'?' selected':''}>T2 · WebLLM in-browser · sovereign · pick a model below</option>
            <option value="T3"${tier==='T3'?' selected':''}>T3 · BYOK · Anthropic / OpenAI / Google · stored in your browser only</option>
          </select>
        </div>
        <div id="fk-t2-block" style="display:${tier==='T2'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">WebLLM model · 1B → 70B cascade</label>
          <select id="fk-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit">
            ${Object.entries(WEBLLM_MODELS).map(([k,m]) => `<option value="${k}"${(STATE.config.webllm_model||DEFAULT_MODEL)===k?' selected':''}>${esc(m.label)} · ${esc(m.size)}</option>`).join('')}
          </select>
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button id="fk-load-llm" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">${STATE.ai.ready?'✓ Loaded · switch':'Load model (one-time download)'}</button>
            <span id="fk-llm-status" style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.04em">${STATE.ai.ready?'ready':STATE.ai.loading?Math.round(STATE.ai.progress)+'%':'not loaded'}</span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">First load downloads the model from @mlc-ai/web-llm CDN. Cached forever after. Inference is 100% local — open DevTools → Network during use, nothing leaves.</div>
        </div>
        <div id="fk-t3-block" style="display:${tier==='T3'?'block':'none'};margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">BYOK provider</label>
          <select id="fk-provider" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${Object.entries(T3_PROVIDERS).map(([k,p]) => `<option value="${k}"${provider===k?' selected':''}>${esc(p.label)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Model</label>
          <select id="fk-api-model" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:inherit;margin-bottom:10px">
            ${providerCfg.models.map(m => `<option value="${m}"${(STATE.config.api_model||providerCfg.default)===m?' selected':''}>${esc(m)}</option>`).join('')}
          </select>
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">API key</label>
          <input type="password" id="fk-key" value="${esc(STATE.config.api_key || '')}" placeholder="${STATE.config.api_key ? '(set · leave empty to keep)' : 'sk-ant-... or sk-... or AIza...'}" autocomplete="off" style="width:100%;padding:8px 11px;background:#22212c;border:1px solid #3a342c;color:#ebe3d2;border-radius:3px;font-size:13px;font-family:ui-monospace,Menlo,monospace">
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">Key lives in this browser only (localStorage). Sent direct to the provider — never to us. Wipe with Reset.</div>
        </div>
        <div style="margin-bottom:14px;padding:12px 14px;background:#1a1922;border:1px solid #2a2934;border-radius:4px">
          <label style="display:block;font-size:11px;color:#a89e88;letter-spacing:.04em;margin-bottom:6px;text-transform:uppercase">Cross-seed mesh</label>
          <div style="display:flex;gap:8px;align-items:center">
            <button id="fk-mesh-toggle" style="padding:6px 12px;background:${STATE.mesh.active?'#6b8d4a':'#1a1922'};color:${STATE.mesh.active?'#fff':'#a89e88'};border:1px solid ${STATE.mesh.active?'#6b8d4a':'#3a342c'};border-radius:3px;font-size:11px;cursor:pointer;font-family:inherit">${STATE.mesh.active?'✓ Active · disconnect':'Activate mesh'}</button>
            <span style="font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#6e6a5e;letter-spacing:.04em">channel · <code style="background:#22212c;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code></span>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6e6a5e;line-height:1.55">BroadcastChannel for same-device · WebRTC for cross-device (planned). Other estate seeds on the same channel discover each other automatically.</div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button onclick="FallKit.closeSettings()" style="padding:7px 14px;background:transparent;color:#a89e88;border:1px solid #3a342c;border-radius:3px;font-size:12px;cursor:pointer;font-family:inherit">Close</button>
          <button id="fk-save" style="padding:7px 14px;background:#c08a3a;color:#0a0a0a;border:none;border-radius:3px;font-weight:600;font-size:12px;cursor:pointer;font-family:inherit">Save</button>
        </div>
      </div>`;
    // Wire interactions
    $('#fk-tier').onchange = () => {
      const t = $('#fk-tier').value;
      $('#fk-t2-block').style.display = t === 'T2' ? 'block' : 'none';
      $('#fk-t3-block').style.display = t === 'T3' ? 'block' : 'none';
    };
    $('#fk-provider') && ($('#fk-provider').onchange = () => {
      const p = $('#fk-provider').value;
      const sel = $('#fk-api-model');
      sel.innerHTML = T3_PROVIDERS[p].models.map(m => `<option value="${m}">${esc(m)}</option>`).join('');
    });
    $('#fk-load-llm') && ($('#fk-load-llm').onclick = () => {
      const m = $('#fk-model').value;
      loadWebLLM(m);
    });
    $('#fk-mesh-toggle').onclick = () => {
      if (STATE.mesh.active) { STATE.mesh.bc?.close(); STATE.mesh.active = false; STATE.mesh.bc = null; notify('Mesh disconnected'); }
      else meshStart({ seedName: STATE.config.seedName || 'seed' });
      openSettings();  // refresh modal
    };
    $('#fk-save').onclick = () => {
      STATE.config.ai_tier = $('#fk-tier').value;
      if ($('#fk-model')) STATE.config.webllm_model = $('#fk-model').value;
      if ($('#fk-provider')) STATE.config.api_provider = $('#fk-provider').value;
      if ($('#fk-api-model')) STATE.config.api_model = $('#fk-api-model').value;
      const newKey = $('#fk-key')?.value;
      if (newKey) STATE.config.api_key = newKey;
      saveConfig(); renderAiChip(); notify('Saved', 'ok'); closeSettings();
    };
  }
  function closeSettings() { const bg = $('#fk-modal-bg'); if (bg) bg.remove(); }
  // ─── Help section (returns HTML string for inclusion in seed Help tabs) ───
  function helpSection() {
    return `<div style="background:rgba(192,138,58,.05);border:1px solid #3a342c;border-radius:4px;padding:18px 22px;margin:14px 0">
      <p style="font-size:13px;color:#a89e88;line-height:1.7;margin-bottom:10px">This seed runs fully without AI (<strong style="color:#c08a3a">T0</strong>, default). Enable a tier in settings if you want AI-assist features:</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">Tier</th><th style="padding:6px 10px;text-align:left;background:rgba(0,0,0,.2);font-family:ui-monospace,Menlo,monospace;font-size:10px;color:#a89e88;letter-spacing:.08em;text-transform:uppercase">What it is</th></tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T0</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">Off. The seed works fully. No AI · no downloads · no API calls.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T2</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">WebLLM in-browser. Pick a model: 1B (700MB, fast) → 3B (2GB, balanced) → 7B (5GB, capable) → 70B (40GB, frontier). One-time download, runs offline forever after. Zero data leaves your device.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#c08a3a;font-weight:600">T3</td><td style="padding:6px 10px;border-top:1px solid #2a2934;color:#a89e88">BYOK · Anthropic Claude · OpenAI GPT · Google Gemini. You bring the API key, you pay the provider direct. Key stays in your browser, sent direct to the provider, never proxied.</td></tr>
        </tbody>
      </table>
      <p style="font-size:12px;color:#6e6a5e;line-height:1.6;margin-top:10px">Open the AI chip in the header to switch tier or check status. Cross-seed mesh activates a BroadcastChannel on <code style="background:#1a1922;padding:1px 5px;border-radius:2px">${MESH_CHANNEL}</code> so other estate seeds on the same device discover this one.</p>
    </div>`;
  }
  // ─── CSS for AI chip ─────────────────────────────────────────────
  function injectCss() {
    const s = document.createElement('style');
    s.id = 'fk-css';
    s.textContent = `
      #fk-ai-chip { display:inline-flex; align-items:center; gap:6px; padding:4px 9px; border-radius:3px; font-family:ui-monospace,Menlo,monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; font-weight:600; cursor:pointer; border:1px solid #3a342c; background:#1a1922; color:#a89e88; user-select:none; vertical-align:middle }
      #fk-ai-chip:hover { border-color:#c08a3a; color:#ebe3d2 }
      #fk-ai-chip.fk-chip-live { border-color:#6b8d4a; color:#6b8d4a; background:rgba(107,141,74,.10) }
      #fk-ai-chip.fk-chip-loading { border-color:#e8a83a; color:#e8a83a; background:rgba(232,168,58,.10) }
      #fk-ai-chip.fk-chip-warn { border-color:#a14a2a; color:#a14a2a; background:rgba(161,74,42,.08) }
      #fk-ai-chip .fk-dot { width:6px; height:6px; border-radius:50%; background:currentColor; flex-shrink:0 }
      #fk-ai-chip.fk-chip-loading .fk-dot { animation:fk-pulse 1s infinite }
      @keyframes fk-pulse { 0%,100%{opacity:1}50%{opacity:.3} }
      .fk-ai-assist { display:inline-flex; align-items:center; gap:5px; padding:4px 9px; font-size:11px; border:1px solid #c08a3a; color:#c08a3a; background:transparent; border-radius:3px; cursor:pointer; font-family:inherit }
      .fk-ai-assist:hover { background:#c08a3a; color:#0a0a0a }
      .fk-ai-assist::before { content:'✦'; font-size:12px }
    `;
    document.head.appendChild(s);
  }
  // ─── KCC Mint launcher (v1.2 · fork-this-seed shortcut) ──────────
  function openMint() {
    const slug = (STATE.config.seedName || location.hostname.split('.')[0] || 'seed').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const url = location.href.split('?')[0].split('#')[0];
    const params = new URLSearchParams({ fork: '1', parent_slug: slug, parent_name: name, parent_url: url, parent_desc: desc });
  }
  // ─── Init ────────────────────────────────────────────────────────
  function init(opts) {
    opts = opts || {};
    injectCss();
    if (opts.seedName) STATE.config.seedName = opts.seedName;
    if ($('#fk-ai-chip')) { renderAiChip(); return { version: FALL_KIT_VERSION, mounted: false }; }
    const chip = document.createElement('button');
    chip.id = 'fk-ai-chip';
    chip.title = 'AI cascade · click to configure tier and model';
    chip.innerHTML = '<span class="fk-dot"></span><span id="fk-ai-chip-text">T0 · off</span>';
    chip.onclick = openSettings;
    // Try anchor first, fall back to floating bottom-right
    const anchor = opts.chipAnchor ? $(opts.chipAnchor) : null;
    if (anchor) { anchor.appendChild(chip); }
    else {
      chip.style.cssText += ';position:fixed;bottom:14px;left:14px;z-index:9998;box-shadow:0 4px 14px rgba(0,0,0,.4)';
      document.body.appendChild(chip);
    }
    // v1.2 · floating mint button next to chip
    if (!$('#fk-mint-btn') && !opts.hideMint) {
      const mintBtn = document.createElement('button');
      mintBtn.id = 'fk-mint-btn';
      mintBtn.title = 'Mint a fork of this seed as a KCC bundle · provenance economy';
      mintBtn.innerHTML = '<span style="font-size:13px">✦</span> mint fork';
      mintBtn.style.cssText = 'position:fixed;bottom:14px;left:130px;z-index:9998;display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:3px;font-family:ui-monospace,Menlo,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;cursor:pointer;border:1px solid #c08a3a;color:#c08a3a;background:rgba(10,10,15,.7);box-shadow:0 4px 14px rgba(0,0,0,.4)';
      mintBtn.onmouseover = () => { mintBtn.style.background = '#c08a3a'; mintBtn.style.color = '#0a0a0a'; };
      mintBtn.onmouseout  = () => { mintBtn.style.background = 'rgba(10,10,15,.7)'; mintBtn.style.color = '#c08a3a'; };
      mintBtn.onclick = openMint;
      document.body.appendChild(mintBtn);
    }
    renderAiChip();
    return { version: FALL_KIT_VERSION, mounted: true };
  }
  // ─── Public API ──────────────────────────────────────────────────
  root.FallKit = {
    version: FALL_KIT_VERSION,
    init: init,
    aiTier: aiTier,
    aiComplete: aiComplete,
    loadWebLLM: loadWebLLM,
    openSettings: openSettings,
    closeSettings: closeSettings,
    renderAiChip: renderAiChip,
    helpSection: helpSection,
    meshStart: meshStart,
    meshPost: meshPost,
    notify: notify,
    openMint: openMint,  // v1.2 · launch kcc-mint with this seed prefilled as parent
    MODELS: WEBLLM_MODELS,
    PROVIDERS: T3_PROVIDERS,
    state: STATE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
  // fall-kit init · auto-mounts a floating AI chip bottom-left
  (function () {
    function go() { if (typeof FallKit !== 'undefined') FallKit.init({ seedName: "falldesk" }); }
    else go();
  })();
'use strict';
const VERSION = '1.0.0';
const PRIME = 1061;
const STORE = 'falldesk-v1';
const REGISTRY_URL = 'https://sjgant80-hub.github.io/fall-registry/index.json';
// ═══════════════════════════════════════════════════════════════
// CATEGORIES (sidebar nav · data-driven · extensible)
// ═══════════════════════════════════════════════════════════════
const CATEGORIES = [
 // Section: pinned
 { id: 'desk', section: 'pinned', label: 'My Desk', icon: '⭐' },
 // Section: library
 { id: 'personal', section: 'library', label: 'Personal', icon: '👤' },
 { id: 'business', section: 'library', label: 'Business', icon: '💼' },
 { id: 'entertainment',section: 'library', label: 'Entertainment', icon: '🎮' },
 { id: 'guild', section: 'library', label: 'Guild', icon: '⚒' },
 // Section: discover
 { id: 'marketplace', section: 'discover', label: 'Marketplace', icon: '🏪' },
 { id: 'seeds', section: 'discover', label: 'Seeds', icon: '🌱' },
 // Section: create
 { id: 'build', section: 'create', label: 'Build new tool', icon: '✨' },
 // Section: system
 { id: 'settings', section: 'system', label: 'Settings', icon: '⚙' }
];
// Coming-soon categories — visible in sidebar to signal the roadmap, not interactive yet
const COMING_SOON = [
 { id: 'communication', label: 'Communication', icon: '💬', note: 'sovereign chat · WebRTC + relay · v2' },
 { id: 'media', label: 'Media', icon: '📺', note: 'sovereign video/audio · P2P · v2' },
 { id: 'social', label: 'Social', icon: '🌐', note: 'sovereign social · ATproto · v2' },
 { id: 'productivity', label: 'Productivity', icon: '📝', note: 'notes · calendar · tasks · v2' }
];
const SECTION_LABELS = {
 pinned: 'Pinned',
 library: 'My Library',
 discover: 'Discover',
 create: 'Create',
 system: 'System'
};
// ═══════════════════════════════════════════════════════════════
// PROVIDERS · LLM cascade (lifted from FallSeed HR v2)
// ═══════════════════════════════════════════════════════════════
const PROVIDERS = [
 { id: 'webllm', name: 'WebLLM', tier: 'T1', tierLabel: 'sovereign', priority: 1,
 model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', defaultEnabled: false, pricePer1MIn: 0, pricePer1MOut: 0,
 note: 'In-browser via WebGPU · ~2GB first load · zero network after' },
 { id: 'ollama', name: 'Ollama (local)', tier: 'T2', tierLabel: 'sovereign', priority: 2,
 endpoint: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2', defaultEnabled: true,
 pricePer1MIn: 0, pricePer1MOut: 0, note: 'localhost:11434 · OLLAMA_ORIGINS=* ollama serve' },
 { id: 'lmstudio', name: 'LM Studio', tier: 'T2', tierLabel: 'sovereign', priority: 3,
 endpoint: 'http://localhost:1234/v1/chat/completions', model: 'loaded', defaultEnabled: true,
 pricePer1MIn: 0, pricePer1MOut: 0, note: 'localhost:1234 · enable CORS in Server tab' },
 { id: 'groq', name: 'Groq', tier: 'T3-free', tierLabel: 'free', priority: 4,
 endpoint: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile',
 requiresKey: true, defaultEnabled: true, signupUrl: 'https://console.groq.com/keys',
 pricePer1MIn: 0, pricePer1MOut: 0, note: '30 req/min · Llama 3.3 70B · fastest cloud' },
 { id: 'openrouter-free', name: 'OpenRouter free', tier: 'T3-free', tierLabel: 'free', priority: 5,
 endpoint: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free',
 requiresKey: true, defaultEnabled: true, signupUrl: 'https://openrouter.ai/keys',
 pricePer1MIn: 0, pricePer1MOut: 0, note: 'Free Llama 3.3 70B · 200 req/day' },
 { id: 'google', name: 'Google AI Studio', tier: 'T3-free', tierLabel: 'free', priority: 6,
 endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent',
 model: 'gemini-2.5-flash', requiresKey: true, defaultEnabled: true, signupUrl: 'https://aistudio.google.com/apikey',
 pricePer1MIn: 0, pricePer1MOut: 0, note: 'Gemini 2.5 Flash · 1M tokens/day free' },
 { id: 'cerebras', name: 'Cerebras', tier: 'T3-free', tierLabel: 'free', priority: 7,
 endpoint: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b',
 requiresKey: true, defaultEnabled: true, signupUrl: 'https://cloud.cerebras.ai/platform',
 pricePer1MIn: 0, pricePer1MOut: 0, note: 'Llama 3.3 70B at 2200 tok/sec' },
 { id: 'anthropic', name: 'Anthropic', tier: 'T3-paid', tierLabel: 'paid', priority: 8,
 endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514',
 requiresKey: true, defaultEnabled: false, signupUrl: 'https://console.anthropic.com/',
 pricePer1MIn: 3, pricePer1MOut: 15, paid: true, note: 'Sonnet 4 · highest quality codegen' }
];
// ═══════════════════════════════════════════════════════════════
// CATEGORIZER — map registry entries → our taxonomy
// ═══════════════════════════════════════════════════════════════
function categorize(app) {
 const n = (app.name || '').toLowerCase();
 const c = (app.category || '').toLowerCase();
 const b = (app.bundle || '').toLowerCase();
 if (/^fallaccount|^falladviser|^fallstack|^falllife|^fallhealth/.test(n)) return 'personal';
 if (/kard|warhum/.test(n)) return 'entertainment';
 if (c.includes('guild') || /^acg-/.test(n)) return 'guild';
 if (/fallseed|konom|fallmesh|fall-mcp|fallrelay|fall-hot|fall-euaiact|fallcompass/.test(n)) return 'sovereignty';
 if (/firm|wedge|business|vertical/.test(b+c) || /^fall(hr|legal|books|claim|insurance|mortgage|estate|clinic|vet|recruit|paper|onboard|practice|advis|adv)/.test(n)) return 'business';
 if (c.includes('meta')) return 'sovereignty';
 return 'sovereignty';
}
function bundleOf(app) { return (app.bundle || '').toLowerCase().replace(/-firm$/, '').replace(/-practice$/, ''); }
function roleOf(app) { return app.bundleRole || ''; }
// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let state = {
 active: 'desk',
 catalog: [],
 catalogTs: 0,
 installed: {}, // name → { name, html, version, installedAt, source }
 pinned: new Set(),
 generated: [], // tools created via build engine
 providerConfig: {},
 rateLimits: {},
 usage: {},
 webllmEngine: null,
 webllmStatus: 'unloaded',
 prefs: { audience: null, verticals: [], aiTier: null, completed: false },
 searchQuery: '',
 bundleFilter: '',
 marketCategory: 'all',
 webgpuOk: !!navigator.gpu
};
const $ = (s, p = document) => p.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = p => (p || '') + '_' + Math.random().toString(36).slice(2, 11);
const now = () => Date.now();
function toast(m) {
 const t = $('#toast'); t.textContent = m; t.classList.add('show');
 clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), 2200);
}
function openModal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.add('open'); }
function closeModal() { $('#modal').classList.remove('open'); }
async function sha256(s) {
 const buf = new TextEncoder().encode(s);
 const h = await crypto.subtle.digest('SHA-256', buf);
 return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
// ═══════════════════════════════════════════════════════════════
// IDB
// ═══════════════════════════════════════════════════════════════
let db;
function openDB() {
 return new Promise((res, rej) => {
 const r = indexedDB.open(STORE, 1);
 r.onupgradeneeded = e => {
 const d = e.target.result;
 ['config', 'installed', 'generated', 'catalog'].forEach(s => {
 if (!d.objectStoreNames.contains(s)) {
 d.createObjectStore(s, s === 'config' || s === 'catalog' ? {} : { keyPath: 'id' });
 }
 });
 };
 r.onsuccess = e => { db = e.target.result; res(db); };
 r.onerror = rej;
 });
}
function idbGet(s, k) { return new Promise(r => { const tx = db.transaction(s,'readonly'); const q = tx.objectStore(s).get(k); q.onsuccess = () => r(q.result); }); }
function idbGetAll(s) { return new Promise(r => { const tx = db.transaction(s,'readonly'); const q = tx.objectStore(s).getAll(); q.onsuccess = () => r(q.result||[]); }); }
function idbPut(s, v, k) { return new Promise(r => { const tx = db.transaction(s,'readwrite'); const o = tx.objectStore(s); const q = k != null ? o.put(v, k) : o.put(v); q.onsuccess = () => r(true); }); }
function idbDelete(s, k) { return new Promise(r => { const tx = db.transaction(s,'readwrite'); tx.objectStore(s).delete(k); tx.oncomplete = () => r(true); }); }
async function loadAll() {
 if (!db) await openDB();
 state.prefs = await idbGet('config', 'prefs') || state.prefs;
 state.providerConfig = await idbGet('config', 'providerConfig') || {};
 state.rateLimits = await idbGet('config', 'rateLimits') || {};
 state.usage = await idbGet('config', 'usage') || {};
 const pinnedArr = await idbGet('config', 'pinned') || [];
 state.pinned = new Set(pinnedArr);
 const installedArr = await idbGetAll('installed');
 installedArr.forEach(a => state.installed[a.id] = a);
 state.generated = await idbGetAll('generated');
 const cached = await idbGet('catalog', 'apps');
 if (cached) { state.catalog = cached.apps; state.catalogTs = cached.ts; }
 for (const p of PROVIDERS) {
 if (!(p.id in state.providerConfig)) state.providerConfig[p.id] = { enabled: p.defaultEnabled, key: '', customModel: '' };
 if (!(p.id in state.usage)) state.usage[p.id] = { totalIn: 0, totalOut: 0, calls: 0, lastUsed: 0 };
 }
 await idbPut('config', state.providerConfig, 'providerConfig');
}
async function persistProvider() { await idbPut('config', state.providerConfig, 'providerConfig'); }
async function persistUsage() { await idbPut('config', state.usage, 'usage'); }
async function persistPrefs() { await idbPut('config', state.prefs, 'prefs'); }
async function persistPinned() { await idbPut('config', Array.from(state.pinned), 'pinned'); }
// ═══════════════════════════════════════════════════════════════
// CATALOG LOADER · fall-registry mirror with fallback
// ═══════════════════════════════════════════════════════════════
async function loadCatalog(force) {
 if (!force && state.catalog.length && (now() - state.catalogTs) < 6 * 3600 * 1000) return;
 try {
 const r = await Promise.race([
 fetch(REGISTRY_URL),
 new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
 ]);
 if (!r.ok) throw new Error('registry ' + r.status);
 const data = await r.json();
 state.catalog = data.apps || [];
 state.catalogTs = now();
 await idbPut('catalog', { ts: state.catalogTs, apps: state.catalog }, 'apps');
 } catch (e) {
 if (!state.catalog.length) {
 state.catalog = FALLBACK_CATALOG;
 state.catalogTs = now();
 }
 }
}
// Minimal embedded fallback in case fall-registry is unreachable AND nothing cached
const FALLBACK_CATALOG = [
 { name: 'fallhr', prime: 1009, url: 'https://sjgant80-hub.github.io/fallhr/', purpose: 'HR firm anchor · employees · holiday · absence', category: 'business-vertical', bundle: 'hr-firm', bundleRole: 'anchor' },
 { name: 'fallaccount', prime: 467, url: 'https://sjgant80-hub.github.io/fallaccount/', purpose: 'Sovereign accounting for UK sole traders', category: 'personal' },
 { name: 'fallseed-hr', prime: 1049, url: 'https://sjgant80-hub.github.io/fallseed-hr/', purpose: 'PWA seed for HR firms with build engine', category: 'meta', bundle: 'hr-firm', bundleRole: 'seed' }
];
// ═══════════════════════════════════════════════════════════════
// PROVIDER AVAILABILITY + STREAMING CASCADE
// ═══════════════════════════════════════════════════════════════
async function detectLocalRunner(endpoint) {
 try {
 const ep = endpoint.replace('/v1/chat/completions', endpoint.includes('11434') ? '/api/version' : '/v1/models');
 const r = await Promise.race([fetch(ep, { method: 'GET' }), new Promise((_, rej) => setTimeout(() => rej('timeout'), 1500))]);
 return r.ok;
 } catch (e) { return false; }
}
async function providerAvailable(p) {
 const cfg = state.providerConfig[p.id] || {};
 if (!cfg.enabled) return { ok: false, reason: 'disabled' };
 if (p.requiresKey && !cfg.key) return { ok: false, reason: 'no key' };
 const rl = state.rateLimits[p.id];
 if (rl && rl.until > now()) return { ok: false, reason: 'rate-limited' };
 if (p.tier === 'T2') {
 const reachable = await detectLocalRunner(p.endpoint);
 if (!reachable) return { ok: false, reason: 'not on ' + p.endpoint.match(/localhost:\d+/)[0] };
 }
 if (p.id === 'webllm' && !navigator.gpu) return { ok: false, reason: 'no WebGPU' };
 return { ok: true };
}
async function readSSE(reader, onLine) {
 const decoder = new TextDecoder(); let buf = '';
 while (true) {
 const { done, value } = await reader.read(); if (done) break;
 buf += decoder.decode(value, { stream: true });
 const lines = buf.split('\n'); buf = lines.pop() || '';
 for (const line of lines) {
 const t = line.trim();
 if (t.startsWith('data: ')) { const payload = t.slice(6); if (payload === '[DONE]') return; try { onLine(JSON.parse(payload)); } catch(e){} }
 }
 }
}
async function callOpenAICompatStream(p, key, model, system, user, maxTokens, onToken) {
 const headers = { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' };
 if (key) headers['Authorization'] = 'Bearer ' + key;
 if (p.id === 'openrouter-free') { headers['HTTP-Referer'] = 'https://sjgant80-hub.github.io/falldesk/'; headers['X-Title'] = 'FallDesk'; }
 const resp = await fetch(p.endpoint, { method: 'POST', headers, body: JSON.stringify({ model, stream: true, messages: [{ role:'system', content:system }, { role:'user', content:user }], max_tokens: maxTokens, temperature: 0.3 }) });
 if (resp.status === 429) { state.rateLimits[p.id] = { until: now() + 60000 }; throw new Error('rate-limited'); }
 if (!resp.ok) { const t = await resp.text(); throw new Error(p.name + ' ' + resp.status + ': ' + t.slice(0,150)); }
 let text = '', tokensIn = 0, tokensOut = 0;
 await readSSE(resp.body.getReader(), (data) => {
 const delta = data.choices?.[0]?.delta?.content || '';
 if (delta) { text += delta; onToken(text); }
 if (data.usage) { tokensIn = data.usage.prompt_tokens||tokensIn; tokensOut = data.usage.completion_tokens||tokensOut; }
 });
 if (!tokensOut) tokensOut = Math.ceil(text.length/4);
 return { text, tokensIn, tokensOut, model };
}
async function callAnthropicStream(p, key, model, system, user, maxTokens, onToken) {
 const resp = await fetch(p.endpoint, { method: 'POST', headers: { 'x-api-key':key, 'anthropic-version':'2023-06-01', 'content-type':'application/json', 'anthropic-dangerous-direct-browser-access':'true' }, body: JSON.stringify({ model, max_tokens: maxTokens, system, stream: true, messages: [{ role:'user', content:user }] }) });
 if (resp.status === 429) { state.rateLimits[p.id] = { until: now() + 60000 }; throw new Error('rate-limited'); }
 if (!resp.ok) { const t = await resp.text(); throw new Error('Anthropic ' + resp.status + ': ' + t.slice(0,150)); }
 let text = '', tokensIn = 0, tokensOut = 0;
 await readSSE(resp.body.getReader(), (data) => {
 if (data.type === 'content_block_delta' && data.delta?.text) { text += data.delta.text; onToken(text); }
 if (data.type === 'message_start' && data.message?.usage) tokensIn = data.message.usage.input_tokens || 0;
 if (data.type === 'message_delta' && data.usage) tokensOut = data.usage.output_tokens || tokensOut;
 });
 return { text, tokensIn, tokensOut, model };
}
async function callGoogleStream(p, key, model, system, user, maxTokens, onToken) {
 const ep = p.endpoint + '?key=' + encodeURIComponent(key) + '&alt=sse';
 const resp = await fetch(ep, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ contents: [{ role:'user', parts: [{ text:user }] }], systemInstruction: { parts: [{ text:system }] }, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 } }) });
 if (resp.status === 429) { state.rateLimits[p.id] = { until: now() + 60000 }; throw new Error('rate-limited'); }
 if (!resp.ok) { const t = await resp.text(); throw new Error('Google ' + resp.status + ': ' + t.slice(0,150)); }
 let text = '', tokensIn = 0, tokensOut = 0;
 await readSSE(resp.body.getReader(), (data) => {
 const part = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
 if (part) { text += part; onToken(text); }
 if (data.usageMetadata) { tokensIn = data.usageMetadata.promptTokenCount || tokensIn; tokensOut = data.usageMetadata.candidatesTokenCount || tokensOut; }
 });
 return { text, tokensIn, tokensOut, model };
}
async function callWebLLMStream(model, system, user, maxTokens, onToken, onProgress) {
 if (!state.webllmEngine) {
 onProgress && onProgress('loading model (~2GB first time)...');
 state.webllmStatus = 'loading';
 const webllm = await import('https://esm.run/@mlc-ai/web-llm');
 state.webllmEngine = await webllm.CreateMLCEngine(model, { initProgressCallback: pr => onProgress && onProgress(pr.text || 'loading...') });
 state.webllmStatus = 'ready';
 }
 const reply = await state.webllmEngine.chat.completions.create({ messages: [{ role:'system', content:system }, { role:'user', content:user }], max_tokens: maxTokens, temperature: 0.3, stream: true });
 let text = '', tokensOut = 0;
 for await (const chunk of reply) { const delta = chunk.choices?.[0]?.delta?.content || ''; if (delta) { text += delta; onToken(text); tokensOut++; } }
 return { text, tokensIn: Math.ceil((system.length+user.length)/4), tokensOut, model };
}
async function callProviderStream(p, system, user, maxTokens, onToken, onProgress) {
 const cfg = state.providerConfig[p.id] || {};
 const model = cfg.customModel || p.model;
 if (p.id === 'webllm') return callWebLLMStream(model, system, user, maxTokens, onToken, onProgress);
 if (p.id === 'anthropic') return callAnthropicStream(p, cfg.key, model, system, user, maxTokens, onToken);
 if (p.id === 'google') return callGoogleStream(p, cfg.key, model, system, user, maxTokens, onToken);
 return callOpenAICompatStream(p, cfg.key, model, system, user, maxTokens, onToken);
}
async function runCascadeStream(system, user, maxTokens, onToken, onTrace) {
 const sorted = PROVIDERS.slice().sort((a,b) => a.priority - b.priority);
 const trace = [];
 for (const p of sorted) {
 const t0 = now();
 const avail = await providerAvailable(p);
 if (!avail.ok) { trace.push({ provider: p.name, status: 'skip', reason: avail.reason, ms: 0 }); onTrace && onTrace(trace); continue; }
 trace.push({ provider: p.name, status: 'try', reason: 'connecting...', ms: 0 }); onTrace && onTrace(trace);
 try {
 const result = await callProviderStream(p, system, user, maxTokens, onToken, (msg) => { trace[trace.length-1].reason = msg; onTrace && onTrace(trace); });
 trace[trace.length-1].status = 'ok';
 trace[trace.length-1].reason = `${result.tokensIn}→${result.tokensOut} · ${result.model}`;
 trace[trace.length-1].ms = now() - t0;
 onTrace && onTrace(trace);
 state.usage[p.id].totalIn += result.tokensIn;
 state.usage[p.id].totalOut += result.tokensOut;
 state.usage[p.id].calls += 1;
 state.usage[p.id].lastUsed = now();
 await persistUsage();
 return { ...result, provider: p, trace };
 } catch (e) {
 trace[trace.length-1].status = 'fail';
 trace[trace.length-1].reason = e.message.slice(0,100);
 trace[trace.length-1].ms = now() - t0;
 onTrace && onTrace(trace);
 }
 }
 throw new Error('All providers failed. Configure at least one in Settings.');
}
// ═══════════════════════════════════════════════════════════════
// INSTALL / LAUNCH / UNINSTALL
// ═══════════════════════════════════════════════════════════════
async function installApp(name) {
 const entry = state.catalog.find(a => a.name === name);
 if (!entry) { toast('Not in catalog'); return; }
 toast('Installing ' + name + '...');
 try {
 const html = await fetch(entry.url + (entry.url.endsWith('/') ? '' : '/')).then(r => r.text());
 if (!html.includes('<html') && !html.includes('<!DOCTYPE')) throw new Error('Not HTML');
 const installed = {
 id: name, name, html,
 version: entry.version || '1.0.0',
 prime: entry.prime,
 purpose: entry.purpose,
 url: entry.url,
 category: categorize(entry),
 bundle: entry.bundle || '',
 bundleRole: entry.bundleRole || '',
 installedAt: now(),
 source: 'marketplace',
 sizeKb: Math.round(html.length / 1024)
 };
 state.installed[name] = installed;
 await idbPut('installed', installed);
 toast('Installed ' + name);
 render();
 } catch (e) {
 toast('Install failed: ' + e.message.slice(0,40));
 }
}
async function uninstallApp(name) {
 if (!confirm('Uninstall ' + name + '? (its IDB data on this device remains unless you wipe it from inside the app)')) return;
 delete state.installed[name];
 state.pinned.delete(name);
 await idbDelete('installed', name);
 await persistPinned();
 toast('Uninstalled');
 render();
}
function launchApp(name) {
 const installed = state.installed[name];
 if (!installed) { installApp(name); return; }
 const iframe = $('#appFrame');
 iframe.srcdoc = installed.html;
 $('#iframeShell').style.display = 'block';
 installed.lastLaunched = now();
 idbPut('installed', installed);
}
function launchGenerated(id) {
 const g = state.generated.find(x => x.id === id);
 if (!g) return;
 $('#appFrame').srcdoc = g.html;
 $('#iframeShell').style.display = 'block';
}
function closeAppFrame() { $('#iframeShell').style.display = 'none'; $('#appFrame').srcdoc = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#iframeShell').style.display === 'block') closeAppFrame(); });
async function togglePin(name) {
 if (state.pinned.has(name)) state.pinned.delete(name); else state.pinned.add(name);
 await persistPinned();
 render();
}
// ═══════════════════════════════════════════════════════════════
// BUILD ENGINE (cascade-driven · context-aware)
// ═══════════════════════════════════════════════════════════════
const BUILD_SYSTEM = `You are FallDesk-Build, the generative engine of the FallDesk sovereign workstation.
You generate sovereign single-HTML applications. Every tool you produce MUST:
1. Be a COMPLETE single HTML file starting with <!DOCTYPE html> and ending with <\/html>.
2. Inline all CSS using the FallDesk dark palette: --void #0b0a0f, --brass #b8974a, --amber #ff8c00, --cream #e6e1d6, --line #2a2934.
3. Inline all JavaScript. Use 'use strict'. Any literal close-script tag in a string MUST be written as <\/script>.
4. Store data in IndexedDB keyed by the tool name. Use auto-increment integer ids.
5. Open a BroadcastChannel matching the tool's category (e.g. 'fall-hr', 'fall-personal', 'fall-life'). Broadcast 'hello' to 'fall-signal' channel on boot.
6. Include a P3 audit chain: prevHash + SHA-256 chained entries on every state mutation.
7. Include a seedDemo() function with 2-3 sample records (isDemo:true flag) populated on first boot.
8. Have at least 3 tabs in the nav: a main list view, a settings panel with Export/Import/Wipe, and a Q&A panel.
9. Include a modal pattern for add/edit forms.
10. Use the same CSS class names as the rest of the FallDesk estate: nav.tabs, .card, .btn, .btn.brass, .toast, .modal-bg, .modal, .field, .row.
11. Include a regulatory or domain disclaimer at the top of the main view.
12. Include a manifest data: URL for PWA installability.
13. Set <meta name="prime" content="XXXX"> using a prime from: 1063, 1069, 1087, 1091, 1093, 1097, 1103, 1109, 1117, 1123.
When the user describes a tool they need, output ONLY the complete HTML file. No preamble, no markdown code fences. Start with <!DOCTYPE html> and end with <\/html>.`;
let buildContextCategory = null;
let lastBuilt = null;
async function runBuild(prompt) {
 if (!prompt || !prompt.trim()) { toast('Describe what you need'); return; }
 const enabled = PROVIDERS.filter(p => state.providerConfig[p.id]?.enabled && (!p.requiresKey || state.providerConfig[p.id]?.key));
 if (!enabled.length) { toast('Configure an LLM in Settings'); switchCat('settings'); return; }
 switchCat('build');
 await new Promise(r => setTimeout(r, 50));
 $('#bpPrompt').value = prompt;
 const out = $('#bpOutput'); const iframe = $('#bpFrame'); const placeholder = $('#bpPlaceholder');
 out.classList.add('streaming'); out.textContent = '';
 if (iframe) { iframe.style.display = 'block'; iframe.srcdoc = '<html><body style="font:14px Inter;padding:20px;color:#666">awaiting first token...</body></html>'; }
 if (placeholder) placeholder.style.display = 'none';
 const contextHint = buildContextCategory ? `\n\nCONTEXT: this tool extends the "${buildContextCategory}" category of the user's FallDesk. It should use the BroadcastChannel 'fall-${buildContextCategory}' for mesh sync with other ${buildContextCategory} tools.` : '';
 const userMsg = `Build a complete sovereign HTML tool for this need:\n\n"${prompt}"${contextHint}\n\nOUTPUT: complete single HTML file. Start with <!DOCTYPE html>. End with </html>. No preamble. No code fences.`;
 try {
 const result = await runCascadeStream(BUILD_SYSTEM, userMsg, 16000,
 (cur) => {
 out.textContent = cur.length > 10000 ? cur.slice(-10000) : cur;
 out.scrollTop = out.scrollHeight;
 if (iframe && cur.includes('<body') && cur.length > 400) {
 try { iframe.srcdoc = cur + (cur.includes('</html>') ? '' : '\n<!-- streaming... --></body></html>'); } catch(e){}
 }
 },
 (trace) => {
 const traceEl = $('#bpTrace');
 if (traceEl) traceEl.innerHTML = '<div class="cascade-trace">' + trace.map(t => `<div class="line ${t.status}"><span class="p">${esc(t.provider)}</span> · ${esc(t.reason)}${t.ms?' · '+t.ms+'ms':''}</div>`).join('') + '</div>';
 }
 );
 let html = result.text.replace(/^```html\n?/, '').replace(/\n?```\s*$/, '').trim();
 if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) throw new Error('LLM returned non-HTML');
 out.classList.remove('streaming');
 const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
 const primeMatch = html.match(/<meta\s+name=["']prime["']\s+content=["'](\d+)["']/i);
 const nameGuess = (titleMatch?.[1] || '').match(/fall[a-z]+/i)?.[0] || 'tool_' + Math.random().toString(36).slice(2,7);
 lastBuilt = {
 id: uid('gen'), ts: now(), prompt, name: nameGuess, toolName: nameGuess,
 prime: primeMatch ? Number(primeMatch[1]) : null,
 html, provider: result.provider.name, model: result.model,
 tokensIn: result.tokensIn, tokensOut: result.tokensOut,
 category: buildContextCategory || 'sovereignty',
 source: 'generated'
 };
 state.generated.push(lastBuilt);
 await idbPut('generated', lastBuilt);
 // ALSO install it into the launcher so it appears in the relevant category
 const asInstalled = { id: nameGuess, name: nameGuess, html, version: '1.0.0', prime: lastBuilt.prime, purpose: prompt.slice(0,140), url: '(generated)', category: lastBuilt.category, installedAt: now(), source: 'generated', sizeKb: Math.round(html.length/1024) };
 state.installed[nameGuess] = asInstalled;
 await idbPut('installed', asInstalled);
 out.textContent = html.slice(0, 6000) + (html.length > 6000 ? '\n\n...' + (html.length - 6000) + ' more bytes' : '');
 if (iframe) iframe.srcdoc = html;
 toast('Built ' + nameGuess + ' via ' + result.provider.name);
 render();
 } catch (e) {
 out.classList.remove('streaming');
 out.textContent = '❌ ' + e.message;
 toast('Build failed');
 }
}
function downloadLast() {
 if (!lastBuilt) return;
 const blob = new Blob([lastBuilt.html], { type: 'text/html' });
 const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = lastBuilt.toolName + '.html';
 document.body.appendChild(a); a.click(); a.remove();
 toast('Downloaded');
}
// ═══════════════════════════════════════════════════════════════
// MESH (announce to fall-signal)
// ═══════════════════════════════════════════════════════════════
function initMesh() {
 try {
 const sig = new BroadcastChannel('fall-signal');
 sig.postMessage({ source: 'falldesk', type: 'hello', prime: PRIME, version: VERSION, ts: now() });
 } catch(e) {}
}
// ═══════════════════════════════════════════════════════════════
// AUTO-DETECT LOCAL RUNNERS
// ═══════════════════════════════════════════════════════════════
async function autoDetectProviders() {
 for (const p of PROVIDERS.filter(p => p.tier === 'T2')) {
 const reachable = await detectLocalRunner(p.endpoint);
 if (reachable && !state.providerConfig[p.id].userToggled) state.providerConfig[p.id].enabled = true;
 }
 await persistProvider();
}
// ═══════════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════════
function render() {
 renderSidebar();
 updateTierBadge();
 const v = $('#view');
 switch (state.active) {
 case 'desk': return renderDesk(v);
 case 'personal': return renderCategory(v, 'personal', '👤 Personal');
 case 'business': return renderBusiness(v);
 case 'entertainment':return renderCategory(v, 'entertainment', '🎮 Entertainment');
 case 'guild': return renderCategory(v, 'guild', '⚒ Guild');
 case 'marketplace': return renderMarketplace(v);
 case 'seeds': return renderSeeds(v);
 case 'build': return renderBuild(v);
 case 'settings': return renderSettings(v);
 }
}
function switchCat(id) { state.active = id; buildContextCategory = ['personal','business','entertainment','sovereignty','guild'].includes(id) ? id : null; render(); }
function updateTierBadge() {
 const enabled = PROVIDERS.filter(p => state.providerConfig[p.id]?.enabled && (!p.requiresKey || state.providerConfig[p.id]?.key));
 const tiers = new Set(enabled.map(p => p.tierLabel));
 $('#tierBadge').textContent = enabled.length ? enabled.length + ' LLMs · ' + Array.from(tiers).join('/') : 'NO LLM';
}
function renderSidebar() {
 const counts = {};
 for (const cat of CATEGORIES) {
 if (['personal','business','entertainment','sovereignty','guild'].includes(cat.id)) {
 counts[cat.id] = Object.values(state.installed).filter(a => a.category === cat.id).length;
 }
 }
 const groups = {};
 for (const cat of CATEGORIES) { if (!groups[cat.section]) groups[cat.section] = []; groups[cat.section].push(cat); }
 let html = '';
 for (const sec of ['pinned','library','discover','create','system']) {
 html += `<div class="side-section">${SECTION_LABELS[sec]}</div>`;
 for (const cat of groups[sec]) {
 html += `<div class="side-item ${state.active===cat.id?'active':''}" onclick="switchCat('${cat.id}')"><span>${cat.icon}</span><span>${cat.label}</span>${counts[cat.id]!=null?`<span class="count">${counts[cat.id]}</span>`:''}</div>`;
 }
 }
 // Coming-soon section
 html += `<div class="side-section">Coming soon (v2)</div>`;
 for (const cs of COMING_SOON) {
 html += `<div class="side-item soon" title="${esc(cs.note)}"><span>${cs.icon}</span><span>${cs.label}</span><span class="badge">soon</span></div>`;
 }
 $('#sidebar').innerHTML = html;
}
function renderDesk(v) {
 const installedCount = Object.keys(state.installed).length;
 const pinnedApps = Array.from(state.pinned).map(n => state.installed[n]).filter(Boolean);
 const recentApps = Object.values(state.installed).sort((a,b) => (b.lastLaunched||0) - (a.lastLaunched||0)).slice(0, 8);
 v.innerHTML = `
 <div class="hero">
 <h1>Welcome to your FallDesk</h1>
 <div class="lede">One Progressive Web App. ${state.catalog.length} sovereign apps in the marketplace. ${installedCount} installed on this device. The build engine writes new tools on demand using any LLM. All data stays on your machine. <span style="color:var(--brass)">Install FallDesk to your desktop (Chrome menu → Install) for the full workstation feel.</span></div>
 </div>
 <div class="kpi-grid">
 <div class="kpi"><div class="label">Installed</div><div class="val">${installedCount}</div></div>
 <div class="kpi"><div class="label">In marketplace</div><div class="val">${state.catalog.length}</div></div>
 <div class="kpi"><div class="label">Built by you</div><div class="val">${state.generated.length}</div></div>
 <div class="kpi"><div class="label">Pinned</div><div class="val">${state.pinned.size}</div></div>
 </div>
 <div class="card">
 <h3>✨ Build something new</h3>
 <div style="display:flex;gap:8px;margin-top:8px">
 <input id="deskBuildPrompt" placeholder="e.g. 'track my dog's vet visits' or 'simple personal expense log' or 'team morale pulse survey'" style="flex:1" onkeydown="if(event.key==='Enter')runBuild(this.value)">
 </div>
 <div style="font-size:11px;color:var(--cream-muted);margin-top:6px;font-family:var(--mono)">Cascade tries: ${PROVIDERS.filter(p => state.providerConfig[p.id]?.enabled && (!p.requiresKey||state.providerConfig[p.id]?.key)).map(p=>p.name).join(' → ')||'no LLM configured · open Settings'}</div>
 </div>
 ${pinnedApps.length ? `
 <div class="section-h"><h2>⭐ Pinned</h2></div>
 <div class="app-grid">${pinnedApps.map(a => tileHtml(a, true)).join('')}</div>
 ` : ''}
 ${recentApps.length ? `
 <div class="section-h"><h2>Recently used</h2></div>
 <div class="app-grid">${recentApps.map(a => tileHtml(a)).join('')}</div>
 ` : `
 <div class="section-h"><h2>Get started</h2><div class="sub">install your first app from the marketplace</div></div>
 <div class="card" style="text-align:center;padding:30px">
 <div style="font-size:42px;margin-bottom:10px">🏪</div>
 <p style="font-size:14px;color:var(--cream-dim);margin-bottom:16px">Open the marketplace to browse ${state.catalog.length} sovereign apps across personal, business, and 11 industry verticals.</p>
 <button class="btn brass" onclick="switchCat('marketplace')">Browse marketplace →</button>
 </div>
 `}`;
}
function tileHtml(a, isPinned) {
 const installed = !!state.installed[a.name || a.id];
 const status = isPinned ? 'pinned' : installed ? (a.source==='generated'?'generated':'installed') : 'market';
 const initials = (a.name || a.id).replace(/^fall/,'').slice(0,2).toUpperCase();
 return `<div class="app-tile" onclick="launchApp('${a.name||a.id}')">
 <span class="status ${status}" title="${status}"></span>
 <div class="icon">${esc(initials)}</div>
 <div class="nm">${esc(a.name||a.id)}</div>
 <div class="purpose">${esc((a.purpose||'').slice(0,100))}${(a.purpose||'').length>100?'…':''}</div>
 <div class="meta"><span>prime ${a.prime||'—'}${a.sizeKb?' · '+a.sizeKb+'KB':''}</span><span>${a.bundleRole||''}</span></div>
 </div>`;
}
function renderCategory(v, cat, title) {
 const items = Object.values(state.installed).filter(a => a.category === cat);
 const marketplace = state.catalog.filter(a => categorize(a) === cat && !state.installed[a.name]);
 v.innerHTML = `
 <div class="section-h"><h2>${esc(title)}</h2><div class="sub">${items.length} installed · ${marketplace.length} available</div></div>
 ${items.length ? `
 <div class="section-h"><h2 style="font-size:14px">Installed</h2></div>
 <div class="app-grid">${items.map(a => tileHtml(a)).join('')}</div>
 ` : ''}
 ${marketplace.length ? `
 <div class="section-h" style="margin-top:24px"><h2 style="font-size:14px">Available in marketplace</h2></div>
 <div class="app-grid">${marketplace.slice(0,24).map(a => tileHtml(a)).join('')}</div>
 ${marketplace.length > 24 ? `<div style="text-align:center;margin-top:14px"><button class="btn" onclick="state.marketCategory='${cat}';switchCat('marketplace')">See all ${marketplace.length} in marketplace →</button></div>` : ''}
 ` : ''}
 ${(!items.length && !marketplace.length) ? `<div class="empty">No apps in this category yet.</div>` : ''}
 <div class="card" style="margin-top:24px;border-color:var(--brass)">
 <h3>✨ Build a ${cat} tool</h3>
 <div style="display:flex;gap:8px;margin-top:8px">
 <input id="catBuildPrompt" placeholder="describe what you need in this category" style="flex:1" onkeydown="if(event.key==='Enter')runBuild(this.value)">
 </div>
 <div style="font-size:11px;color:var(--cream-muted);margin-top:6px">build context: <strong>${cat}</strong> · the generated tool will mesh on <code style="background:var(--ink);padding:1px 4px">fall-${cat}</code></div>
 </div>`;
}
function renderBusiness(v) {
 // Group by bundle (vertical)
 const installed = Object.values(state.installed).filter(a => a.category === 'business');
 const marketplace = state.catalog.filter(a => categorize(a) === 'business');
 const bundles = {};
 for (const a of [...installed, ...marketplace]) {
 const b = bundleOf(a) || 'other';
 if (!bundles[b]) bundles[b] = [];
 if (!bundles[b].find(x => (x.name||x.id) === (a.name||a.id))) bundles[b].push(a);
 }
 const ordered = Object.keys(bundles).sort();
 v.innerHTML = `
 <div class="section-h"><h2>💼 Business</h2><div class="sub">${ordered.length} verticals · ${installed.length} tools installed</div></div>
 ${ordered.map(b => {
 const apps = bundles[b];
 const installedCount = apps.filter(a => state.installed[a.name||a.id]).length;
 return `<div class="card">
 <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
 <h3 style="margin:0;text-transform:capitalize">${esc(b)} firm</h3>
 <span style="font-family:var(--mono);font-size:10px;color:var(--cream-muted)">${installedCount}/${apps.length} installed</span>
 </div>
 <div class="app-grid">${apps.map(a => tileHtml(a)).join('')}</div>
 </div>`;
 }).join('')}
 <div class="card" style="margin-top:24px;border-color:var(--brass)">
 <h3>✨ Build a business tool</h3>
 <div style="display:flex;gap:8px;margin-top:8px">
 <input id="busBuildPrompt" placeholder="e.g. 'GDPR data subject access request handler' or 'meeting room booking'" style="flex:1" onkeydown="if(event.key==='Enter')runBuild(this.value)">
 </div>
 </div>`;
}
function renderMarketplace(v) {
 let apps = state.catalog;
 if (state.marketCategory && state.marketCategory !== 'all') {
 apps = apps.filter(a => categorize(a) === state.marketCategory);
 }
 if (state.searchQuery) {
 const q = state.searchQuery.toLowerCase();
 apps = apps.filter(a => (a.name+' '+(a.purpose||'')).toLowerCase().includes(q));
 }
 const cats = ['all','personal','business','entertainment','sovereignty','guild'];
 v.innerHTML = `
 <div class="section-h"><h2>🏪 Marketplace</h2><div class="sub">${apps.length} of ${state.catalog.length} apps · live registry · last sync ${state.catalogTs?new Date(state.catalogTs).toLocaleString('en-GB'):'never'}</div>
 <div class="actions"><button class="btn sm" onclick="loadCatalog(true).then(()=>render())">↻ Refresh from registry</button></div>
 </div>
 <div class="disclaimer"><strong>Sovereign install:</strong> click any app → Install. FallDesk fetches the HTML from GitHub Pages once, stores it in your browser's IndexedDB, and runs it locally from then on. If sjgant80-hub.github.io goes offline tomorrow, your installed apps still work. <strong>Your data stays on your device</strong> — each app uses its own IDB scope.</div>
 <div class="filter-bar">
 ${cats.map(c => `<button class="filter-chip ${state.marketCategory===c?'active':''}" onclick="state.marketCategory='${c}';render()">${c==='all'?'All':c.charAt(0).toUpperCase()+c.slice(1)}</button>`).join('')}
 </div>
 ${apps.length ? `<div class="app-grid">${apps.map(a => tileHtml(a)).join('')}</div>` : '<div class="empty">No apps match.</div>'}`;
}
function renderSeeds(v) {
 const seedApps = state.catalog.filter(a => /fallseed/.test(a.name));
 v.innerHTML = `
 <div class="section-h"><h2>🌱 Seeds</h2><div class="sub">forkable PWA templates for whole verticals</div></div>
 <div class="card" style="font-size:13px;line-height:1.7;color:var(--cream-dim)">
 <strong style="color:var(--brass)">What's a seed?</strong> A seed is a Progressive Web App that ships with a complete vertical wedge (anchor/onboard/paper/practice — four tools) plus a build engine that generates new tools on demand. You install a seed, get the four tools, then extend it with whatever your firm needs. Forkable into any vertical via the Fork Seed mechanic inside each seed.
 </div>
 ${seedApps.length ? `<div class="app-grid">${seedApps.map(a => tileHtml(a)).join('')}</div>` : `
 <div class="card" style="text-align:center;padding:30px">
 <div style="font-size:42px;margin-bottom:10px">🌱</div>
 <p style="font-size:13px;color:var(--cream-dim);margin-bottom:14px">First seed shipped: <strong>fallseed-hr</strong> — Progressive Web App for UK HR firms with a build engine and Fork Seed packager. Open it to see the mechanic, then fork it into clinic, vet, recruit, or any other vertical.</p>
 </div>
 `}`;
}
function renderBuild(v) {
 const enabled = PROVIDERS.filter(p => state.providerConfig[p.id]?.enabled && (!p.requiresKey || state.providerConfig[p.id]?.key));
 v.innerHTML = `
 <div class="section-h"><h2>✨ Build new tool</h2><div class="sub">${enabled.length} provider${enabled.length===1?'':'s'} ready · streaming · context: <strong>${buildContextCategory||'open'}</strong></div></div>
 ${enabled.length===0 ? `<div class="disclaimer"><strong>No LLM configured.</strong> Configure at least one in <a onclick="switchCat('settings')" style="color:var(--brass);cursor:pointer;text-decoration:underline">Settings</a>. Cheapest path: install ollama locally (no key), or 30-second free Groq signup.</div>` : ''}
 <div class="card">
 <h3>What do you want?</h3>
 <textarea id="bpPrompt" rows="4" placeholder="describe the tool plainly — 'track DSE workstation assessments by employee with annual expiry', 'simple kanban board for project tasks', 'expense claim register with mileage at 45p/25p'"></textarea>
 <div style="display:flex;gap:8px;margin-top:10px">
 ${lastBuilt ? `<button class="btn" onclick="downloadLast()">↓ Download last</button>` : ''}
 </div>
 <div id="bpTrace"></div>
 </div>
 <div class="build-stage">
 <div>
 <h3>Generated HTML (streaming)</h3>
 <div class="preview-area" id="bpOutput">(token stream appears here)</div>
 </div>
 <div>
 <h3>Live preview</h3>
 <iframe id="bpFrame" style="width:100%;height:55vh;border:1px solid var(--line);border-radius:4px;background:white;display:none"></iframe>
 <div class="preview-area" id="bpPlaceholder" style="min-height:55vh">(iframe will render as HTML streams in)</div>
 </div>
 </div>
 ${state.generated.length ? `
 <div class="section-h" style="margin-top:24px"><h2>Previously generated</h2></div>
 <div class="app-grid">${state.generated.slice().reverse().slice(0,12).map(g => `<div class="app-tile" onclick="launchGenerated('${g.id}')">
 <span class="status generated"></span>
 <div class="icon">${esc(g.toolName.replace(/^fall/,'').slice(0,2).toUpperCase())}</div>
 <div class="nm">${esc(g.toolName)}</div>
 <div class="purpose">${esc(g.prompt.slice(0,100))}${g.prompt.length>100?'…':''}</div>
 <div class="meta"><span>via ${esc(g.provider)}</span><span>${new Date(g.ts).toLocaleDateString('en-GB')}</span></div>
 </div>`).join('')}</div>
 ` : ''}`;
}
function renderSettings(v) {
 const totalCalls = Object.values(state.usage).reduce((s,u) => s+u.calls, 0);
 const totalTokens = Object.values(state.usage).reduce((s,u) => s+u.totalIn+u.totalOut, 0);
 const totalCost = PROVIDERS.filter(p => p.paid).reduce((s,p) => { const u = state.usage[p.id] || {totalIn:0,totalOut:0}; return s + (u.totalIn*p.pricePer1MIn + u.totalOut*p.pricePer1MOut)/1000000; }, 0);
 v.innerHTML = `
 <div class="section-h"><h2>⚙ Settings</h2></div>
 <div class="kpi-grid">
 <div class="kpi"><div class="label">Apps installed</div><div class="val">${Object.keys(state.installed).length}</div></div>
 <div class="kpi"><div class="label">Tools built</div><div class="val">${state.generated.length}</div></div>
 <div class="kpi"><div class="label">Cascade calls</div><div class="val">${totalCalls}</div></div>
 <div class="kpi"><div class="label">Total spent</div><div class="val">£${totalCost.toFixed(4)}</div></div>
 </div>
 <div class="section-h"><h2 style="font-size:15px">LLM Providers (cascade)</h2></div>
 ${PROVIDERS.map(p => {
 const cfg = state.providerConfig[p.id] || {};
 const u = state.usage[p.id] || {calls:0,totalIn:0,totalOut:0};
 const isRL = state.rateLimits[p.id]?.until > now();
 return `<div class="provider-row">
 <div class="toggle ${cfg.enabled?'on':''}" onclick="toggleProvider('${p.id}')"></div>
 <span class="tag ${p.tier==='T1'?'t1':p.tier==='T2'?'t2':p.tier==='T3-free'?'tf':'tp'}">${p.tier}</span>
 <div><div class="nm">${esc(p.name)}</div><div style="font-size:10px;color:var(--cream-muted);margin-top:2px">${esc(p.note)} · ${u.calls} calls · ${(u.totalIn+u.totalOut).toLocaleString()} tokens${isRL?' · <span style="color:var(--red)">rate-limited</span>':''}</div></div>
 ${p.requiresKey ? `<input type="password" placeholder="paste key" style="font-size:11px;padding:5px 7px" value="${esc(cfg.key||'')}" onchange="updateKey('${p.id}',this.value)">` : '<div></div>'}
 ${p.signupUrl ? `<a href="${p.signupUrl}" target="_blank" class="btn sm" style="text-align:center;text-decoration:none">↗ get key</a>` : '<div></div>'}
 </div>`;
 }).join('')}
 <div class="section-h"><h2 style="font-size:15px">Data</h2></div>
 <div class="card">
 <div style="display:flex;gap:8px;flex-wrap:wrap">
 <button class="btn sm" onclick="exportAll()">↓ Export everything (JSON)</button>
 <button class="btn sm" onclick="loadCatalog(true).then(()=>render()).then(()=>toast('Refreshed catalog'))">↻ Refresh marketplace catalog</button>
 <button class="btn sm" onclick="restartWizard()">↻ Restart first-run wizard</button>
 <button class="btn sm danger" onclick="wipeAll()" style="border-color:var(--red);color:var(--red)">⚠ Wipe everything</button>
 </div>
 </div>
 <div class="section-h"><h2 style="font-size:15px">About</h2></div>
 <div class="card" style="font-size:12px;color:var(--cream-dim);line-height:1.7">
 A sovereign workstation in one HTML file. Mirror of <a href="https://sjgant80-hub.github.io/fall-registry/" target="_blank">fall-registry</a>. Install any app → fetched from its GitHub Pages URL → stored in your browser → runs locally from then on. Build engine generates new tools via the LLM cascade.<br><br>
 <strong style="color:var(--brass)">Coming in v2:</strong> sovereign chat (WebRTC + relay), sovereign media (P2P video), sovereign social (ATproto-style), productivity suite (notes/calendar/tasks). All same architecture: single HTML, BroadcastChannel mesh, IDB storage, no server.
 </div>`;
}
async function toggleProvider(id) {
 state.providerConfig[id].enabled = !state.providerConfig[id].enabled;
 state.providerConfig[id].userToggled = true;
 await persistProvider(); render();
}
async function updateKey(id, key) {
 state.providerConfig[id].key = key.trim();
 await persistProvider(); updateTierBadge(); toast('Key saved');
}
function exportAll() {
 const data = { tool: 'falldesk', v: VERSION, ts: now(), installed: Object.keys(state.installed), generated: state.generated.length, providerConfig: Object.fromEntries(Object.entries(state.providerConfig).map(([k,v]) => [k, {...v, key: v.key?'[redacted]':''}])), usage: state.usage, pinned: Array.from(state.pinned), prefs: state.prefs };
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'falldesk-export.json';
 document.body.appendChild(a); a.click(); a.remove();
 toast('Exported (keys redacted)');
}
async function wipeAll() {
 if (!confirm('Wipe everything including installed apps, generated tools, and keys?')) return;
 for (const s of ['config','installed','generated','catalog']) { const tx = db.transaction(s,'readwrite'); tx.objectStore(s).clear(); await new Promise(r => tx.oncomplete = r); }
 location.reload();
}
function restartWizard() { state.prefs.completed = false; showWizardIfNeeded(); }
// ═══════════════════════════════════════════════════════════════
// FIRST-RUN WIZARD
// ═══════════════════════════════════════════════════════════════
const WIZARD_VERTICALS = ['hr-firm','law-firm','accountancy-firm','claims-firm','insurance-firm','mortgage-firm','estate-agent-firm','clinic-firm','vet-practice','recruitment-firm','ifa-firm'];
function showWizardIfNeeded() {
 if (state.prefs.completed) return;
 const audience = state.prefs.audience || null;
 openModal(`
 <h2>Welcome to FallDesk</h2>
 <div class="lede">Your sovereign workstation. One PWA. Hundreds of apps. Builds new ones on demand. <strong>Three questions and you're set up.</strong></div>
 <h3 style="margin-top:14px;font-size:14px;color:var(--brass)">1. Who is this for?</h3>
 <div class="choice-grid">
 <div class="choice ${audience==='personal'?'selected':''}" onclick="wizSetAudience('personal')"><div class="ic">👤</div><div class="nm">Just me</div><div class="desc">Personal finance, life admin, side hustle</div></div>
 <div class="choice ${audience==='business'?'selected':''}" onclick="wizSetAudience('business')"><div class="ic">💼</div><div class="nm">My business</div><div class="desc">Firm tools across regulated UK verticals</div></div>
 <div class="choice ${audience==='both'?'selected':''}" onclick="wizSetAudience('both')"><div class="ic">⊕</div><div class="nm">Both</div><div class="desc">Personal AND business, all in one workstation</div></div>
 </div>
 ${(audience==='business'||audience==='both') ? `
 <h3 style="margin-top:14px;font-size:14px;color:var(--brass)">2. Which verticals?</h3>
 <div style="font-size:12px;color:var(--cream-muted);margin-bottom:8px">pick any that apply</div>
 <div class="vertical-list">${WIZARD_VERTICALS.map(v => `<button class="vertical-chip ${state.prefs.verticals?.includes(v)?'active':''}" onclick="wizToggleVertical('${v}')">${v.replace(/-/g,' ')}</button>`).join('')}</div>
 ` : ''}
 ${audience ? `
 <h3 style="margin-top:14px;font-size:14px;color:var(--brass)">${audience==='personal'?'2':'3'}. Which kind of AI?</h3>
 <div class="choice-grid">
 <div class="choice ${state.prefs.aiTier==='free'?'selected':''}" onclick="wizSetAiTier('free')"><div class="ic">🆓</div><div class="nm">Free cloud</div><div class="desc">Groq · 30-second signup · free Llama 3.3 70B</div></div>
 <div class="choice ${state.prefs.aiTier==='paid'?'selected':''}" onclick="wizSetAiTier('paid')"><div class="ic">💷</div><div class="nm">Paid cloud</div><div class="desc">Anthropic Claude · best quality · ~£0.03/tool</div></div>
 </div>
 ` : ''}
 <div class="actions">
 ${(audience && state.prefs.aiTier) ? `<button class="btn brass" onclick="wizComplete()">Set up my workstation →</button>` : `<button class="btn brass" disabled>Set up my workstation →</button>`}
 <button class="btn ghost" onclick="wizSkip()">Skip · I'll configure manually</button>
 </div>
 `);
}
async function wizSetAudience(a) { state.prefs.audience = a; if (!state.prefs.verticals) state.prefs.verticals = []; await persistPrefs(); showWizardIfNeeded(); }
async function wizToggleVertical(v) { state.prefs.verticals = state.prefs.verticals || []; const i = state.prefs.verticals.indexOf(v); if (i>=0) state.prefs.verticals.splice(i,1); else state.prefs.verticals.push(v); await persistPrefs(); showWizardIfNeeded(); }
async function wizSetAiTier(t) { state.prefs.aiTier = t; await persistPrefs(); showWizardIfNeeded(); }
async function wizComplete() {
 state.prefs.completed = true;
 await persistPrefs();
 // Pre-enable providers based on tier choice
 if (state.prefs.aiTier === 'sovereign') {
 state.providerConfig.webllm.enabled = true;
 state.providerConfig.ollama.enabled = true;
 } else if (state.prefs.aiTier === 'free') {
 state.providerConfig.groq.enabled = true;
 if (state.providerConfig['openrouter-free']) state.providerConfig['openrouter-free'].enabled = true;
 state.providerConfig.google.enabled = true;
 } else if (state.prefs.aiTier === 'paid') {
 state.providerConfig.anthropic.enabled = true;
 }
 await persistProvider();
 closeModal();
 toast('Welcome to FallDesk');
 switchCat('desk');
}
async function wizSkip() { state.prefs.completed = true; await persistPrefs(); closeModal(); }
// ═══════════════════════════════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════════════════════════════
function onSearch(q) {
 state.searchQuery = q;
 if (state.active === 'marketplace') render();
}
function onSearchEnter() {
 const q = state.searchQuery.trim();
 if (!q) return;
 // If looks like a tool description, treat as build prompt
 if (q.length > 20) { runBuild(q); $('#searchInput').value = ''; state.searchQuery = ''; }
 else { switchCat('marketplace'); }
}
// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════
(async function boot() {
 try {
 await openDB();
 await loadAll();
 initMesh();
 loadCatalog().then(() => { render(); autoDetectProviders().then(() => render()); });
 render();
 if (!state.prefs.completed) setTimeout(showWizardIfNeeded, 300);
 } catch (e) {
 console.error('boot error', e);
 $('#view').innerHTML = '<div class="card">Boot error: ' + esc(e.message) + '</div>';
 }
})();

// Named exports for the primary API surface
export { loadConfig };
export { saveConfig };
export { $ };
export { esc };
export { aiTier };
export { renderAiChip };
export { loadWebLLM };
export { aiComplete };
export { aiCloudCall };
export { meshStart };

export { FALL_KIT_VERSION };
export { KCC_MINT_URL };
export { WEBLLM_MODELS };
export { DEFAULT_MODEL };
export { T3_PROVIDERS };
export { STATE };
export { MESH_CHANNEL };
export { STUN_SERVERS };
export { VERSION };
export { PRIME };
