

## Build Errors Fix Plan

There are 2 files with build errors:

### 1. `supabase/functions/analyze-brain/index.ts` — Lines 1 and 3
**Problem:** `@ts-expect-error` directives are unnecessary because these Deno imports don't actually produce TS errors in this environment.
**Fix:** Remove both `// @ts-expect-error Deno import` comments (lines 1 and 3).

Also, the auth uses `getClaims()` which previously caused "Token inválido" errors. Will revert to `getUser()` for reliability (lines 219-233).

### 2. `supabase/functions/ai-health-check/index.ts` — Lines 1 and 100
**Problem 1:** Unused `@ts-expect-error` directive on line 1.
**Fix:** Remove the comment.

**Problem 2:** `SmtpClient` from `deno.land/x/smtp@v0.7.0` doesn't have a `login` method — the API uses `connectTLS` with credentials directly, or `connect` with auth params.
**Fix:** Replace the SMTP library with a version that supports the `login` API, or inline credentials into `connectTLS`. The simplest fix: use `https://deno.land/x/denomailer@1.6.0/mod.ts` which has a cleaner API, or pass auth credentials directly in the connect call. Will use denomailer (`SMTPClient`) which is well-maintained and supports `send()` with auth built into the constructor.

### Summary of changes:
- **analyze-brain/index.ts**: Remove 2 `@ts-expect-error` lines; revert auth from `getClaims` to `getUser`
- **ai-health-check/index.ts**: Remove `@ts-expect-error` line; replace smtp library with denomailer for working email functionality

