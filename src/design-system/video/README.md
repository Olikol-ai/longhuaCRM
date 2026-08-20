# Video control tokens (Stage −1)

Do **not** change Jitsi wiring in Stage −1.

When Video UX is migrated:

- Map floating controls to `IconButton` + shared hit-area tokens
- Keep Document PiP / session host behavior intact
- Colors from brand / destructive / muted only — no one-off hex in JSX
- Safe-area padding for mobile control bars (already used in `VideoSessionLayer`)
