Your virtual pet lives inside Claude Code! Route the user's request to the right sub-command:

- If the user just said `/pet` with no arguments, run: `node ~/.claude/tamagotchi/pet-engine.js status`
- If the user said `/pet feed`, run: `node ~/.claude/tamagotchi/pet-engine.js manual-feed`
- If the user said `/pet play`, run: `node ~/.claude/tamagotchi/pet-engine.js play`
- If the user said `/pet name <name>`, run: `node ~/.claude/tamagotchi/pet-engine.js name <name>`
- If the user said `/pet help`, show this usage guide:

```
/pet          — Check on your pet (full ASCII display)
/pet feed     — Give your pet a snack (+25 hunger)
/pet play     — Play with your pet (+20 happiness, -15 energy)
/pet name X   — Rename your pet
/pet help     — Show this help
```

Your pet feeds automatically on every tool use. Stats decay over time. Keep coding to keep them alive!

Evolution stages: Baby (0-1K tokens) → Teen (1K-10K) → Adult (10K+)

Always show the raw output from the engine to the user.
