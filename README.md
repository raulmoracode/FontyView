# FontyView

A browser-based font analysis workbench. Load a `TTF`, `OTF`, `WOFF` or `WOFF2`
file and inspect its real metadata, specimen, glyphs, Unicode coverage,
metrics, OpenType tables and more.

Every byte is parsed and analysed locally. No font is uploaded, and no font file
is stored in the repository — test fixtures are generated in memory.

Built with [`@raulmoracode/create`](https://github.com/raulmoracode/raulmoracode-create).

## Requirements

- **Node.js 24** — pinned in `.nvmrc` (`nvm use` picks it up automatically)
- **pnpm 12.6.0** — pinned in `package.json` (`packageManager`); never use npm or yarn in this project

## Getting started

```bash
pnpm install
pnpm dev
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build (`dist/`) |
| `pnpm check` | Run the formatter and linter check |
| `pnpm format` | Apply formatting |
| `pnpm lint` | Run the linter |
| `pnpm test` | Run the test suite (watch mode) |

## Tech stack

- **React 19.3.0 + Vite 8.3.1 + TypeScript 7.0.2** — exact versions, no `^` or `~`
- **Tailwind CSS 4.3.3** — CSS-first configuration (`@import "tailwindcss"` in `src/index.css`)
- **shadcn** — `components.json` + `cn()` helper (`src/lib/utils.ts`)
- **Zustand 5.0.15** — global state
- **Biome 2.5.14** — formatter, linter and organize imports
- **opentype.js 2.0.0 + brotli-dec-wasm 2.3.2** — outline decoding and WOFF2 decompression
- **Vitest 5.0.2 + Testing Library** — tests run in `jsdom`
- **Husky 9.1.7 + Commitlint** — Git hooks and Conventional Commits
- **VS Code** — Biome set as default formatter, format on save

## shadcn components

No components are preinstalled. Add yours from the private registry:

```bash
pnpm dlx shadcn@4.21.0 add @raulmoracode/<component>
```

Browse the catalogue at https://registry.raulmoracode.com. After adding components, normalize their style with Biome (the shadcn CLI uses its own formatting):

```bash
pnpm exec biome check --write .
```

## Git workflow

- `pre-commit` runs `pnpm check` and `pnpm test`
- `commit-msg` runs Commitlint — commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add user profile
fix: handle invalid input
```

## Project structure

```text
├── index.html           # tab title + favicon (raulmoracode branding)
├── src/
│   ├── main.tsx     # entry point
│   ├── App.tsx      # root component and section routing
│   ├── index.css    # Tailwind entry point
│   ├── components/  # shadcn UI plus the app's own components
│   │   ├── ui/      # shadcn primitives
│   │   ├── font/    # analysis views
│   │   ├── layout/  # shell and sidebar
│   │   └── upload/  # empty state, drop zone, progress
│   ├── hooks/       # registry hooks plus use-font-registration
│   ├── lib/
│   │   ├── utils.ts # cn()
│   │   ├── format.ts
│   │   └── font/    # binary reader, containers, tables, analysis
│   ├── store/       # zustand stores
│   └── test/        # tests and in-memory font fixtures
├── components.json      # shadcn config (includes the @raulmoracode registry)
├── pnpm-workspace.yaml  # minimumReleaseAge policy + excludes
└── AGENTS.md            # guidelines for AI coding agents
```

## Links

- [raulmoracode.com](https://raulmoracode.com)
- Repository: [github.com/raulmoracode/FontyView](https://github.com/raulmoracode/FontyView)
