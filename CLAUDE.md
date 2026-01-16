# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates the code, and a virtual file system displays the result with live preview—no files are written to disk.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma + SQLite, Vercel AI SDK with Anthropic Claude, Monaco Editor, shadcn/ui

## Common Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run test         # Run Vitest tests
npm run build        # Production build
npm run lint         # ESLint
npm run setup        # Install deps + Prisma generate + migrate
npm run db:reset     # Reset database
```

Run a single test file:
```bash
npx vitest src/components/chat/__tests__/MessageList.test.tsx
```

## Architecture

### Core Data Flow

1. **Chat Input** → `ChatProvider` (wraps `@ai-sdk/react` useChat) → POST `/api/chat`
2. **API Route** → Claude with tools (`str_replace_editor`, `file_manager`) → streams response
3. **Tool Calls** → `FileSystemContext.handleToolCall()` → updates `VirtualFileSystem`
4. **Preview** → `PreviewFrame` transforms JSX via Babel → renders in sandboxed iframe

### Key Abstractions

- **VirtualFileSystem** (`src/lib/file-system.ts`): In-memory file tree. Methods: `createFile`, `updateFile`, `deleteFile`, `rename`, `readFile`, `serialize`
- **FileSystemContext** (`src/lib/contexts/file-system-context.tsx`): React context managing VFS state and AI tool call handling
- **ChatContext** (`src/lib/contexts/chat-context.tsx`): Wraps Vercel AI SDK, coordinates with FileSystem
- **JSX Transformer** (`src/lib/transform/jsx-transformer.ts`): Babel transforms + import map generation for preview

### AI Tools (defined in `src/lib/tools/`)

- `str_replace_editor`: view, create, str_replace, insert, undo_edit commands
- `file_manager`: rename, delete files

### Preview Entry Point Resolution

Looks for: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → `/src/App.*` → first `.jsx`/`.tsx` found

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/chat/route.ts   # Main AI endpoint
│   └── [projectId]/        # Project detail (auth required)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── chat/               # Chat interface
│   ├── editor/             # Monaco + file tree
│   ├── preview/            # Iframe preview
│   └── auth/               # Sign in/up forms
├── lib/
│   ├── file-system.ts      # VirtualFileSystem class
│   ├── contexts/           # React contexts
│   ├── tools/              # AI tool definitions
│   ├── transform/          # JSX transformation
│   ├── prompts/            # System prompt for Claude
│   └── auth.ts             # JWT session management
├── actions/                # Server actions (auth, projects)
└── middleware.ts           # Route protection
```

## Database Schema

Schema defined in `prisma/schema.prisma`. Uses SQLite stored at `prisma/dev.db`.

**User**
| Field | Type | Notes |
|-------|------|-------|
| id | String | Primary key (cuid) |
| email | String | Unique |
| password | String | bcrypt hashed |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| projects | Project[] | One-to-many relation |

**Project**
| Field | Type | Notes |
|-------|------|-------|
| id | String | Primary key (cuid) |
| name | String | Project display name |
| userId | String? | Optional FK to User |
| messages | String | JSON array of chat messages (default: "[]") |
| data | String | Serialized VirtualFileSystem (default: "{}") |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |
| user | User? | Belongs to User (cascade delete) |

## Environment Variables

```bash
ANTHROPIC_API_KEY=...  # Optional - without it, MockLanguageModel returns sample components
JWT_SECRET=...         # Optional - defaults to "development-secret-key"
```

## Testing

- Vitest with jsdom + React Testing Library
- Tests in `__tests__` folders alongside components
- Mock mode (no API key) useful for UI testing

## Important Files

- `src/lib/prompts/generation.tsx` - System prompt defining Claude's behavior
- `src/app/api/chat/route.ts` - AI endpoint with tool registration
- `src/lib/provider.ts` - AI provider with MockLanguageModel fallback
