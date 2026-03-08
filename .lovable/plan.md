

## Plan: Add `arcee-ai/trinity-large-preview:free` and improve model fallback

### What changes

Add `arcee-ai/trinity-large-preview:free` to the model list in all 8 edge functions that use OpenRouter, and improve the fallback transition by adding a small delay between retries and better logging.

### Files to update (8 edge functions)

1. **`general-chat/index.ts`** (line 214-218)
2. **`brain-chat/index.ts`** (line 288-292)
3. **`summon-clone/index.ts`** (line 171-175)
4. **`generate-prompt/index.ts`** (line 23-27)
5. **`generate-description/index.ts`** (line 123-127)
6. **`agent-squad/index.ts`** (line 22-26)
7. **`analyze-brain/index.ts`** — already has extended list, add `arcee-ai/trinity-large-preview:free` if missing
8. **`ai-health-check/index.ts`** — add to health check list

### Updated model list (all functions)

```typescript
const models = [
  "google/gemini-2.0-flash-001",
  "meta-llama/llama-3.3-70b-instruct:free",
  "arcee-ai/trinity-large-preview:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
];
```

### Improved fallback transition

In each fallback loop, add:
- A 500ms delay between model retries (avoids rapid-fire requests that trigger rate limits)
- Also allow 429 (rate limit) to continue to next model instead of stopping
- Log which model succeeded for debugging

```typescript
for (const model of models) {
  try {
    console.log(`Trying model: ${model}`);
    const aiResponse = await fetch(...);
    
    if (aiResponse.ok) {
      console.log(`Success with model: ${model}`);
      response = aiResponse;
      break;
    } else {
      // ... existing error handling ...
      // On 429, continue to next model (don't break)
      if ([401, 400, 403].includes(aiResponse.status)) break;
      // Small delay before trying next model
      await new Promise(r => setTimeout(r, 500));
    }
  } catch (e) {
    console.error(`Fetch error for ${model}:`, e);
    await new Promise(r => setTimeout(r, 500));
  }
}
```

This applies to: `general-chat`, `brain-chat`, `summon-clone`, `generate-prompt`, `generate-description`, `agent-squad`. The `analyze-brain` and `ai-health-check` already have similar patterns and just need the model added.

