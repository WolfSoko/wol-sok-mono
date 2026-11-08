# Plan #2886: claude.yml starts on bot reviews that mention @CLAUDE.md and fails

Spec: [docs/specs/2886-claude-yml-starts-on-bot-reviews-that-mention-claude-md-and-fails.md](../specs/2886-claude-yml-starts-on-bot-reviews-that-mention-claude-md-and-fails.md)

1. **Skip bot senders.** `.github/workflows/claude.yml`: wrap the job's `if`
   in `github.event.sender.type != 'Bot' && ( … )`, with a comment on why
   (case-insensitive `contains()`, empty `allowed_bots`). Test: actionlint on
   the file (no workflow test harness in the repo); the PR run shows the
   workflow still parses. Commit: `fix(github): skip bot senders in the claude
   workflow`, together with spec and plan.
