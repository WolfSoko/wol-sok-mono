# discord-mcp-oauth patches

This folder is a **transit mechanism only**. The actual project lives at
[`wolfsoko/discord-mcp-oauth`](https://github.com/wolfsoko/discord-mcp-oauth).

Claude is building that project inside a sandbox whose outbound git traffic is
restricted to this monorepo. Patches are generated here and pushed to
`wol-sok-mono` so they can be replayed locally into the target repo.

## Applying

```bash
# Clone the target repo (if you haven't already)
git clone git@github.com:wolfsoko/discord-mcp-oauth.git
cd discord-mcp-oauth

# From this monorepo, on branch claude/discord-mcp-oauth-FO3GL
git -C /path/to/wol-sok-mono pull origin claude/discord-mcp-oauth-FO3GL

# Apply all patches for a given chunk, in order
git am /path/to/wol-sok-mono/patches/discord-mcp-oauth/chunk-1/*.patch

# Verify
npm install
npm run typecheck && npm test && npm run lint

# Push to origin/main
git push -u origin main
```

`git am` preserves the author (`Einstein Openclaw <einstein-openclaw@gmail.com>`).
If your local clone has commit signing configured, the replayed commits will
be signed at apply time with your local key.

## Chunk index

| Chunk | Description                                                                                                                                                              | Files                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| 1     | Project scaffold: TS strict, Vitest, ESLint, Prettier, wrangler.toml; `env.ts` + `lib/logger.ts` + `lib/result.ts` with 24 tests. Plus `PLAN.md` tracking the full build. | `chunk-1/0001-*`, `0002-*` |
