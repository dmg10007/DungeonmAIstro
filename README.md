# DungeonmAIstro

An AI-powered D&D 5e Dungeon Master web app — from your first character to the final boss.

## Features (MVP)

- **Adventure Setup** — configure mode, players, tone, length, and a custom prompt
- **Character Lab** — guided 5e character creation; PDF import scaffold (next milestone)
- **DM Chat** — persistent campaign memory with your LLM of choice
- **Dice Engine** — d4/d6/d8/d10/d12/d20/d100, advantage/disadvantage, modifiers
- **Encrypted API Key Vault** — AES-256-GCM via WebCrypto, 6-week expiry
- **Local campaign save/resume** — append-only event log in localStorage
- **Dark/light mode** with system-preference detection

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite 5 |
| Language | TypeScript 5 |
| Routing | React Router v6 |
| Validation | Zod 3 |
| HTML sanitization | DOMPurify |
| Crypto | WebCrypto (browser-native) |
| Fonts | Cinzel (display) + Satoshi (body) via Fontshare |

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Development Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build (source maps disabled)
npm run lint     # ESLint
npm test         # Vitest unit tests
```

## Security Notes

- API keys are encrypted with AES-256-GCM + PBKDF2 (310,000 iterations) before storage
- Raw keys never touch localStorage unencrypted
- CSP headers configured in `vite.config.ts` (production: configure on your host)
- All imported/user content sanitized via DOMPurify before rendering
- Campaign state validated with Zod schemas on every load

## Roadmap

See [`dungeonmaistro-roadmap.md`](./dungeonmaistro-roadmap.md) and [`dungeonmaistro-architecture.md`](./dungeonmaistro-architecture.md) in the repo root for the full phased plan.

## License

See [LICENSE](./LICENSE).
