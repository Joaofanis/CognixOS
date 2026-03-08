

## Root Cause

The edge function logs reveal the real error:

```
import-url auth error: Unexpected token '<', "<html><h"... is not valid JSON
```

`getUser()` makes an **internal network call** from the edge function to the Supabase Auth server. This call is intermittently returning an **HTML error page** instead of JSON, causing all auth to fail with "Token inválido".

## Solution

Replace `getUser()` with `getClaims(token)` in **all 12 edge functions**. `getClaims()` validates the JWT **locally** without any network call, making it immune to this issue.

### Auth pattern (before → after):

```typescript
// BEFORE (network call, fails with HTML response)
const { data: { user }, error } = await userClient.auth.getUser();
const userId = user.id;

// AFTER (local JWT validation, no network call)
const token = authHeader.replace('Bearer ', '');
const { data, error } = await supabase.auth.getClaims(token);
const userId = data.claims.sub;
```

### Files to update (all 12 edge functions):

1. `supabase/functions/import-url/index.ts`
2. `supabase/functions/analyze-brain/index.ts`
3. `supabase/functions/brain-chat/index.ts`
4. `supabase/functions/general-chat/index.ts`
5. `supabase/functions/parse-file/index.ts`
6. `supabase/functions/generate-prompt/index.ts`
7. `supabase/functions/generate-description/index.ts`
8. `supabase/functions/summon-clone/index.ts`
9. `supabase/functions/update-user-profile/index.ts`
10. `supabase/functions/process-rag/index.ts`
11. `supabase/functions/extract-quotes/index.ts`
12. `supabase/functions/agent-squad/index.ts`

Each function gets the same change: replace `getUser()` with `getClaims(token)` and extract `userId` from `data.claims.sub`. Also update the CORS headers in `import-url` to match the other functions (missing platform headers).

