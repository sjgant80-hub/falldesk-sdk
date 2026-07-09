# @ai-native-solutions/falldesk-sdk

Sovereign workstation primitives extracted from FallDesk. LLM cascade planning, verticals taxonomy, category routing, and the build-engine prompt.

## Install

```bash
npm i @ai-native-solutions/falldesk-sdk
```

## Use

```js
import {
  CATEGORIES, VERTICALS, PROVIDERS,
  categorize, planCascade, fetchCatalog, filterCatalog,
  BUILD_SYSTEM, buildUserPrompt
} from '@ai-native-solutions/falldesk-sdk';

// route an app entry to a category
categorize({ name: 'fallhr', bundle: 'hr-firm' }); // "business"

// plan the LLM cascade based on env
const plan = await planCascade({
  providerConfig: { groq: { enabled: true, key: 'gsk_...' } },
  hasWebGPU: false
});
// [{ id:'webllm', status:'skip', reason:'no WebGPU' },
//  { id:'ollama', status:'ready' }, ... ]

// pull the marketplace catalog with fallback
const { apps, source } = await fetchCatalog();
const business = filterCatalog(apps, { category: 'business' });

// build-engine prompts
const user = buildUserPrompt('sovereign appointment book', 'business');
```

## What's inside

- `CATEGORIES` · sidebar taxonomy (pinned / library / discover / create / system)
- `VERTICALS` · 11 firm/practice wedges (hr, law, accountancy, claims, insurance, mortgage, estate-agent, clinic, vet, recruitment, ifa)
- `PROVIDERS` · 8 LLM providers across T1 (WebLLM), T2 (Ollama/LM Studio), T3-free (Groq/OpenRouter/Google/Cerebras), T3-paid (Anthropic)
- `categorize()` · verbatim routing rules from source
- `planCascade()` · deterministic ordering + skip reasons
- `BUILD_SYSTEM` / `buildUserPrompt()` · sovereign-HTML generation prompt
- `fetchCatalog()` · fall-registry mirror with embedded fallback
- `filterCatalog()` · category / bundle / query filtering

## Playground

Open `docs/index.html` locally or on the published Pages URL.

## License

MIT · AI-Native Solutions
