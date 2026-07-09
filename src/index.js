// FallDesk SDK · REAL extraction from falldesk/index.html
// LLM cascade, verticals, categories, categorizer, build system prompt, catalog helpers

'use strict';

export const VERSION = '1.0.0';
export const REGISTRY_URL = 'https://sjgant80-hub.github.io/fall-registry/index.json';

// ─── Categories (sidebar nav taxonomy) ───────────────────────────────
export const CATEGORIES = [
  { id: 'desk',         section: 'pinned',   label: 'My Desk',        icon: 'star' },
  { id: 'personal',     section: 'library',  label: 'Personal',       icon: 'person' },
  { id: 'business',     section: 'library',  label: 'Business',       icon: 'briefcase' },
  { id: 'entertainment',section: 'library',  label: 'Entertainment',  icon: 'game' },
  { id: 'sovereignty',  section: 'library',  label: 'Sovereignty',    icon: 'diamond' },
  { id: 'guild',        section: 'library',  label: 'Guild',          icon: 'tools' },
  { id: 'marketplace',  section: 'discover', label: 'Marketplace',    icon: 'store' },
  { id: 'seeds',        section: 'discover', label: 'Seeds',          icon: 'seed' },
  { id: 'build',        section: 'create',   label: 'Build new tool', icon: 'sparkle' },
  { id: 'settings',     section: 'system',   label: 'Settings',       icon: 'gear' }
];

export const SECTION_LABELS = {
  pinned: 'Pinned',
  library: 'My Library',
  discover: 'Discover',
  create: 'Create',
  system: 'System'
};

export const COMING_SOON = [
  { id: 'communication', label: 'Communication', note: 'sovereign chat · WebRTC + relay · v2' },
  { id: 'media',         label: 'Media',         note: 'sovereign video/audio · P2P · v2' },
  { id: 'social',        label: 'Social',        note: 'sovereign social · ATproto · v2' },
  { id: 'productivity',  label: 'Productivity',  note: 'notes · calendar · tasks · v2' }
];

// ─── Vertical wedges (from WIZARD_VERTICALS) ─────────────────────────
export const VERTICALS = [
  'hr-firm', 'law-firm', 'accountancy-firm', 'claims-firm', 'insurance-firm',
  'mortgage-firm', 'estate-agent-firm', 'clinic-firm', 'vet-practice',
  'recruitment-firm', 'ifa-firm'
];

// ─── LLM Cascade providers (verbatim structure, 3-tier) ─────────────
export const PROVIDERS = [
  { id: 'webllm', name: 'WebLLM', tier: 'T1', tierLabel: 'sovereign', priority: 1,
    model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC', defaultEnabled: false,
    pricePer1MIn: 0, pricePer1MOut: 0,
    note: 'In-browser via WebGPU · ~2GB first load · zero network after' },
  { id: 'ollama', name: 'Ollama (local)', tier: 'T2', tierLabel: 'sovereign', priority: 2,
    endpoint: 'http://localhost:11434/v1/chat/completions', model: 'llama3.2',
    defaultEnabled: true, pricePer1MIn: 0, pricePer1MOut: 0,
    note: 'localhost:11434 · OLLAMA_ORIGINS=* ollama serve' },
  { id: 'lmstudio', name: 'LM Studio', tier: 'T2', tierLabel: 'sovereign', priority: 3,
    endpoint: 'http://localhost:1234/v1/chat/completions', model: 'loaded',
    defaultEnabled: true, pricePer1MIn: 0, pricePer1MOut: 0,
    note: 'localhost:1234 · enable CORS in Server tab' },
  { id: 'groq', name: 'Groq', tier: 'T3-free', tierLabel: 'free', priority: 4,
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile', requiresKey: true, defaultEnabled: true,
    signupUrl: 'https://console.groq.com/keys',
    pricePer1MIn: 0, pricePer1MOut: 0,
    note: '30 req/min · Llama 3.3 70B · fastest cloud' },
  { id: 'openrouter-free', name: 'OpenRouter free', tier: 'T3-free', tierLabel: 'free', priority: 5,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free', requiresKey: true, defaultEnabled: true,
    signupUrl: 'https://openrouter.ai/keys',
    pricePer1MIn: 0, pricePer1MOut: 0, note: 'Free Llama 3.3 70B · 200 req/day' },
  { id: 'google', name: 'Google AI Studio', tier: 'T3-free', tierLabel: 'free', priority: 6,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent',
    model: 'gemini-2.5-flash', requiresKey: true, defaultEnabled: true,
    signupUrl: 'https://aistudio.google.com/apikey',
    pricePer1MIn: 0, pricePer1MOut: 0, note: 'Gemini 2.5 Flash · 1M tokens/day free' },
  { id: 'cerebras', name: 'Cerebras', tier: 'T3-free', tierLabel: 'free', priority: 7,
    endpoint: 'https://api.cerebras.ai/v1/chat/completions', model: 'llama-3.3-70b',
    requiresKey: true, defaultEnabled: true, signupUrl: 'https://cloud.cerebras.ai/platform',
    pricePer1MIn: 0, pricePer1MOut: 0, note: 'Llama 3.3 70B at 2200 tok/sec' },
  { id: 'anthropic', name: 'Anthropic', tier: 'T3-paid', tierLabel: 'paid', priority: 8,
    endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514',
    requiresKey: true, defaultEnabled: false, signupUrl: 'https://console.anthropic.com/',
    pricePer1MIn: 3, pricePer1MOut: 15, paid: true,
    note: 'Sonnet 4 · highest quality codegen' }
];

// ─── Categorizer (verbatim rules from source) ───────────────────────
export function categorize(app) {
  const n = (app.name || '').toLowerCase();
  const c = (app.category || '').toLowerCase();
  const b = (app.bundle || '').toLowerCase();
  if (/^fallaccount|^falladviser|^fallstack|^falllife|^fallhealth/.test(n)) return 'personal';
  if (/kard|warhum/.test(n)) return 'entertainment';
  if (c.includes('guild') || /^acg-/.test(n)) return 'guild';
  if (/fallseed|konom|fallmesh|fall-mcp|fallrelay|fall-hot|fall-euaiact|fallcompass/.test(n)) return 'sovereignty';
  if (/firm|wedge|business|vertical/.test(b + c) ||
      /^fall(hr|legal|books|claim|insurance|mortgage|estate|clinic|vet|recruit|paper|onboard|practice|advis|adv)/.test(n))
    return 'business';
  if (c.includes('meta')) return 'sovereignty';
  return 'sovereignty';
}

export function bundleOf(app) {
  return (app.bundle || '').toLowerCase().replace(/-firm$/, '').replace(/-practice$/, '');
}

// ─── Build engine system prompt (public-safe adaptation) ────────────
export const BUILD_SYSTEM = `You are FallDesk-Build, the generative engine of the FallDesk sovereign workstation.

You generate sovereign single-HTML applications. Every tool you produce MUST:
1. Be a COMPLETE single HTML file starting with <!DOCTYPE html> and ending with </html>.
2. Inline all CSS using the FallDesk dark palette: --void #0b0a0f, --brass #b8974a, --amber #ff8c00, --cream #e6e1d6, --line #2a2934.
3. Inline all JavaScript. Use 'use strict'.
4. Store data in IndexedDB keyed by the tool name. Use auto-increment integer ids.
5. Open a BroadcastChannel matching the tool's category. Broadcast 'hello' on boot.
6. Include an audit chain: prevHash + SHA-256 chained entries on every state mutation.
7. Include a seedDemo() function with 2-3 sample records (isDemo:true flag) on first boot.
8. Have at least 3 tabs: main list view, settings (Export/Import/Wipe), and a Q&A panel.
9. Include a modal pattern for add/edit forms.
10. Use consistent CSS classes: nav.tabs, .card, .btn, .btn.brass, .toast, .modal-bg, .modal, .field, .row.
11. Include a regulatory or domain disclaimer at the top of the main view.
12. Include a manifest data: URL for PWA installability.

When the user describes a tool they need, output ONLY the complete HTML file. No preamble, no markdown code fences. Start with <!DOCTYPE html> and end with </html>.`;

export function buildUserPrompt(need, contextCategory) {
  const contextHint = contextCategory
    ? `\n\nCONTEXT: this tool extends the "${contextCategory}" category. Use BroadcastChannel 'fall-${contextCategory}' for mesh sync.`
    : '';
  return `Build a complete sovereign HTML tool for this need:\n\n"${need}"${contextHint}\n\nOUTPUT: complete single HTML file. Start with <!DOCTYPE html>. End with </html>. No preamble. No code fences.`;
}

// ─── Cascade planner (returns ordered plan; does not fetch itself) ──
// Consumer supplies { providerConfig, rateLimits, hasWebGPU, localReachable }
export async function planCascade(ctx = {}) {
  const cfg = ctx.providerConfig || {};
  const rl = ctx.rateLimits || {};
  const now = Date.now();
  const sorted = PROVIDERS.slice().sort((a, b) => a.priority - b.priority);
  const plan = [];
  for (const p of sorted) {
    const pc = cfg[p.id] || { enabled: p.defaultEnabled };
    let status = 'ready', reason = '';
    if (!pc.enabled) { status = 'skip'; reason = 'disabled'; }
    else if (p.requiresKey && !pc.key) { status = 'skip'; reason = 'no key'; }
    else if (rl[p.id] && rl[p.id].until > now) { status = 'skip'; reason = 'rate-limited'; }
    else if (p.id === 'webllm' && !ctx.hasWebGPU) { status = 'skip'; reason = 'no WebGPU'; }
    else if (p.tier === 'T2' && ctx.localReachable && ctx.localReachable[p.id] === false) {
      status = 'skip'; reason = 'not on ' + (p.endpoint.match(/localhost:\d+/) || [''])[0];
    }
    plan.push({ id: p.id, name: p.name, tier: p.tier, priority: p.priority, status, reason });
  }
  return plan;
}

// ─── Marketplace catalog helpers ────────────────────────────────────
export const FALLBACK_CATALOG = [
  { name: 'fallhr',      url: 'https://sjgant80-hub.github.io/fallhr/',      purpose: 'HR firm anchor · employees · holiday · absence', category: 'business-vertical', bundle: 'hr-firm', bundleRole: 'anchor' },
  { name: 'fallaccount', url: 'https://sjgant80-hub.github.io/fallaccount/', purpose: 'Sovereign accounting for UK sole traders', category: 'personal' },
  { name: 'fallseed-hr', url: 'https://sjgant80-hub.github.io/fallseed-hr/', purpose: 'PWA seed for HR firms with build engine', category: 'meta', bundle: 'hr-firm', bundleRole: 'seed' }
];

export async function fetchCatalog({ fetchImpl = fetch, url = REGISTRY_URL, timeoutMs = 5000 } = {}) {
  try {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    const r = await fetchImpl(url, ctl ? { signal: ctl.signal } : {});
    if (t) clearTimeout(t);
    if (!r.ok) throw new Error('registry ' + r.status);
    const data = await r.json();
    return { apps: data.apps || [], source: 'registry', ts: Date.now() };
  } catch (e) {
    return { apps: FALLBACK_CATALOG, source: 'fallback', ts: Date.now(), error: e.message };
  }
}

export function filterCatalog(apps, { category, bundle, query } = {}) {
  return (apps || []).filter(a => {
    if (category && category !== 'all' && categorize(a) !== category) return false;
    if (bundle && bundleOf(a) !== bundle) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = ((a.name || '') + ' ' + (a.purpose || '') + ' ' + (a.category || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

// ─── Utility: escape HTML ───────────────────────────────────────────
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default {
  VERSION, REGISTRY_URL, CATEGORIES, SECTION_LABELS, COMING_SOON, VERTICALS,
  PROVIDERS, categorize, bundleOf, BUILD_SYSTEM, buildUserPrompt, planCascade,
  FALLBACK_CATALOG, fetchCatalog, filterCatalog, escapeHtml
};
