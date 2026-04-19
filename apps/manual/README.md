# Skill Harbor Manual

Next.js/Fumadocs-powered documentation app for the Skill Harbor project.

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Your docs will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/                  # Next.js app directory
├── ../../docs/          # Repo-root documentation source (MDX files)
├── lib/
│   └── theme-config.ts  # Site configuration
└── public/              # Static assets
```

## Writing Documentation

Add or edit MDX files in the repo-root `docs/` directory to create new pages. The manual app reads its content from `../../docs` via `source.config.ts`, and the sidebar navigation is automatically generated from that file structure.

## Built with Unmint

This documentation site was created with [Unmint](https://github.com/gregce/unmint), a free and open-source documentation system.
