# Ollama Keep-Alive Feature Specification

> Created: 2026-03-17
> Status: Draft

## Overview

Add a "Keep-Alive" configuration for Ollama provider that controls how long the model stays in memory (RAM/GPU).

## User Flow

```
User selects Ollama provider
       ↓
UI shows "Keep-Alive" dropdown
       ↓
User selects option (Forever, 1h, 2h, etc.)
       ↓
User clicks "Save Changes"
       ↓
System sends API request(s) to Ollama
       ↓
Show success/error message in subtitle
```

## UI Design

### Location
In `AiSettingsTab.tsx`, show a collapsible "Ollama Settings" section when provider is Ollama:

```
┌─────────────────────────────────────────────┐
│ Provider: [Ollama ▼]                        │
│ Base URL: [http://localhost:11434]          │
│ Model: [qwen3.5:9b ▼]                       │
│                                             │
│ ┌─ Ollama Settings ───────────────────────┐ │
│ │ Keep-Alive: [Forever        ▼]          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Save Changes]                              │
│ ✓ Ollama model locked in memory             │  ← Success message
└─────────────────────────────────────────────┘

Or on error:
│ ✗ Failed to connect to Ollama server        │  ← Error message
```

### Keep-Alive Options

| Label | API Value | Description |
|-------|-----------|-------------|
| Forever | `-1` | Keep in memory indefinitely |
| 1 hour | `"1h"` | Keep for 1 hour after last use |
| 2 hours | `"2h"` | Keep for 2 hours |
| 4 hours | `"4h"` | Keep for 4 hours |
| 8 hours | `"8h"` | Keep for 8 hours |
| Free | `0` | Unload immediately |

## API Integration

### Endpoint
```
POST {baseUrl}/api/generate
Content-Type: application/json

{
  "model": "<model_name>",
  "keep_alive": <value>
}
```

### Implementation Location
Add to `ollamaParser` in `src/shared/parsers/ollama.ts`:

```typescript
export const ollamaParser: AiProviderParser = {
  // ... existing methods

  /**
   * Set keep-alive for a model
   * @param baseUrl - Ollama base URL
   * @param model - Model name
   * @param keepAlive - Keep-alive value (-1, 0, "1h", etc.)
   */
  async setKeepAlive(baseUrl: string, model: string, keepAlive: KeepAliveValue): Promise<void> {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: keepAlive }),
    });
    if (!response.ok) {
      throw new Error(`Failed to set keep-alive: ${response.statusText}`);
    }
  },

  /**
   * Free a model from memory (keep_alive: 0)
   */
  async freeModel(baseUrl: string, model: string): Promise<void> {
    await this.setKeepAlive(baseUrl, model, 0);
  },
};
```

## Save Logic Flow

When user clicks "Save Changes":

```typescript
async function handleSave() {
  const newConfig = await form.validateFields();
  const oldConfig = currentConfig; // from useConfig hook

  // Step 1: Handle old model cleanup (if Ollama)
  if (oldConfig.providerId === 'ollama' && oldConfig.model) {
    const shouldFreeOldModel =
      newConfig.providerId !== 'ollama' ||  // Switching away from Ollama
      newConfig.model !== oldConfig.model;   // Changing model

    if (shouldFreeOldModel) {
      await ollamaParser.freeModel(oldConfig.customBaseUrl || 'http://localhost:11434', oldConfig.model);
    }
  }

  // Step 2: Save config to database
  await saveConfig(newConfig);

  // Step 3: Apply keep-alive for new config (if Ollama)
  if (newConfig.providerId === 'ollama' && newConfig.model) {
    const baseUrl = newConfig.customBaseUrl || 'http://localhost:11434';
    await ollamaParser.setKeepAlive(baseUrl, newConfig.model, newConfig.keepAlive);
  }
}
```

## Type Definitions

### KeepAliveValue
```typescript
// In src/shared/types.ts
export type KeepAliveValue = -1 | 0 | '1h' | '2h' | '4h' | '8h';

export const KEEP_ALIVE_OPTIONS: { label: string; value: KeepAliveValue }[] = [
  { label: 'Forever', value: -1 },
  { label: '1 hour', value: '1h' },
  { label: '2 hours', value: '2h' },
  { label: '4 hours', value: '4h' },
  { label: '8 hours', value: '8h' },
  { label: 'Free', value: 0 },
];
```

### AiConfig Extension
```typescript
// In src/shared/constants.ts
export type AiConfig = {
  providerId: string;
  apiKey: string;
  model: string;
  customBaseUrl?: string;
  enableThinking: boolean;
  systemPrompt: string;
  keepAlive?: KeepAliveValue;  // NEW: Only used for Ollama
};

export const DEFAULT_AI_CONFIG: AiConfig = {
  // ... existing defaults
  keepAlive: -1,  // Default: Forever
};
```

## Error Handling

### Display Location
Show message below the "Save Changes" button in the header:

```tsx
// State for operation feedback
const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error' | null>(null);
const [statusMessage, setStatusMessage] = useState<string>('');

// In JSX
{statusMessage && (
  <div className={saveStatus === 'error' ? 'text-red-500' : 'text-green-500'}>
    {saveStatus === 'success' ? '✓' : '✗'} {statusMessage}
  </div>
)}
```

### Error Scenarios
| Scenario | Error Message |
|----------|---------------|
| Ollama server not running | "Failed to connect to Ollama server" |
| Model not found | "Model '{model}' not found in Ollama" |
| Network error | "Network error: {message}" |
| Success | "Ollama model locked in memory" |
| Freed old model | "Previous model freed from memory" |

## Files to Modify

| File | Changes |
|------|---------|
| `src/shared/types.ts` | Add `KeepAliveValue` type and options |
| `src/shared/constants.ts` | Add `keepAlive` to `AiConfig`, update default |
| `src/shared/parsers/ollama.ts` | Add `setKeepAlive`, `freeModel` methods |
| `src/renderer/pages/Settings/components/AiSettingsTab.tsx` | Add UI for keep-alive, implement save logic |

## Implementation Order

1. Add types and constants
2. Add parser methods (`setKeepAlive`, `freeModel`)
3. Add UI components (dropdown, status message)
4. Implement save logic with cleanup
5. Test all scenarios

---

## Questions / Decisions Needed

- [x] Scope: Global Ollama setting (applies to all models)
- [x] Trigger: On save, with smart cleanup of old model
- [x] Free on provider switch: Yes
- [x] Error display: Subtitle in settings panel
- [x] Option values: Forever, 1h, 2h, 4h, 8h, Free