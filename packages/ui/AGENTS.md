# packages/ui Architecture & Engineering Guide

## 1. Role & Purpose
`@openbots/ui` is the shared design system and component library for OpenBots. It contains reusable UI primitives, typography styles, dialogs, drawers, buttons, dropdowns, inputs, avatars, and animations built with **Tailwind CSS v4**, **Base UI / Radix UI**, and `@blobatar/react`.

---

## 2. Directory Structure & Key Modules

```
packages/ui/
├── src/
│   ├── components/             # Reusable UI Primitives
│   │   ├── button.tsx          # Button with variant & size tokens
│   │   ├── bubble.tsx          # Chat bubble container & reaction badge wrapper
│   │   ├── message.tsx         # Message row, message avatar, message content
│   │   ├── message-scroller.tsx# Smooth auto-scrolling virtual/native viewport
│   │   ├── attachment.tsx      # Media attachments & upload cards
│   │   ├── dialog.tsx          # Accessible modal dialogs
│   │   ├── sheet.tsx           # Slide-over sheets (artifacts, agent settings)
│   │   ├── spinner.tsx         # Loading spinners & animated indicators
│   │   ├── toast.tsx           # Sonner-based notification toasts
│   │   └── ui/blobatar.tsx     # Animated SVG procedural avatars for agents
│   │
│   ├── lib/
│   │   └── utils.ts            # Class name merger (clsx + tailwind-merge)
│   │
│   └── styles/
│       └── globals.css         # Tailwind v4 theme variables & typesetting
│
└── package.json
```

---

## 3. Core Architectural Concepts & Invariants

### A. Design Tokens & Styling
- OpenBots uses **Tailwind CSS v4** `@theme` blocks.
- Semantic color variables: `background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `border`, `ring`.
- All components support dark mode out of the box via CSS variables.

### B. Procedural Agent Avatars (`Blobatar`)
- Each agent receives a unique animated SVG avatar generated procedurally from their name string using `@blobatar/react`.
- Supports animation states (`animate: "always"`, `"hover"`, `"never"`).

---

## 4. Key Rules for Agents Modifying `@openbots/ui`
- **Accessibility**: Ensure keyboard navigation and ARIA attributes are preserved on all interactive components.
- **No Direct App Dependencies**: `@openbots/ui` must NEVER import anything from `apps/web`, `apps/api`, or `@openbots/db`. It is strictly a pure UI layer.
- **Exporting Components**: Always export newly created UI components from `src/index.ts` or `src/components/*`.
