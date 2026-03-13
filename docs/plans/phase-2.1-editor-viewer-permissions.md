# Eden Phase 2.1 — Editor / Viewer Permissions

> **Status**: Proposed
> **Date**: 2026-03-12
> **Phase**: 2.1 (inserted between Phase 2 and Phase 3)
> **Depends on**: Phase 2 (Changeset System & Ingestion Pipeline)
> **Parent plan**: `eden-evolution.md`
> **Estimated effort**: 3–5 days
>
> **Delivers**: Two-tier access control — editors who can modify the story map
> and viewers who can only read it. Satisfies the PRD requirement: "at least
> two levels of access — users who can mess with stuff and users who are
> view-only."

---

## Context

### PRD Requirement

> "Authentication needed, plus we will want at least two levels of access —
> users who can mess with stuff and users who are view-only."
>
> — `docs/prd/high-level-summary.md`

### Platform State (Eve Horizon)

| Primitive | What Exists | Gap |
|-----------|------------|-----|
| **Org roles** | `owner`, `admin`, `member` — in JWT `orgs` claim | No `viewer` role. No project-level granularity. |
| **Project membership** | `eve project members add/remove` CLI. API endpoints exist. | **Not in JWT.** Auth SDK doesn't expose project roles to apps. Apps can't check project membership without a round-trip to Eve API. |
| **Access groups** | Fine-grained scoped bindings with custom roles and permissions | Overkill for two-tier access. Org-level, not project-level in Eden's domain. |
| **Auth SDK** | `eveUserAuth()` attaches `req.eveUser` with org-level role only | No project-role field. No built-in write-guard. |

**Bottom line**: Eve's org roles don't distinguish editor from viewer, and
project membership isn't available in the JWT or Auth SDK. Eden needs its own
project-level role enforcement.

### Platform Enhancement (Assumed)

This plan assumes Eve will add:

1. **Project membership in `/auth/me` response** — When the request includes
   a project context header (e.g. `X-Eve-Project-Id`), the `/auth/me`
   response should include the user's role for that project alongside org
   memberships. This avoids per-request round-trips to the Eve API.

2. **Project roles in Auth SDK** — `eveUserAuth()` should optionally resolve
   project membership and attach it to `req.eveUser.projectRole`. The
   middleware could read the project ID from a request header or a
   configuration option.

Until these ship, Eden maintains its own `project_members` table as the
source of truth. When the platform catches up, Eden migrates to the platform
primitive and drops the local table.

---

## Design

### Role Model

Two roles, deliberately simple:

| Role | Can Read | Can Write | Who Gets It |
|------|----------|-----------|-------------|
| **editor** | Yes | Yes | Org owners and admins (implicit). Org members promoted by an editor. |
| **viewer** | Yes | No | Org members by default. Anyone explicitly invited as viewer. |

**Implicit mapping** from Eve org roles:

```
org owner  → editor on all projects (implicit, no DB row needed)
org admin  → editor on all projects (implicit, no DB row needed)
org member → viewer on all projects (default, unless promoted)
```

Explicit `project_members` rows override the default. An org member with an
explicit `editor` row on a project is an editor for that project, viewer
everywhere else.

### What Editors Can Do (That Viewers Can't)

| Action | Editor | Viewer |
|--------|--------|--------|
| View story map, sources, reviews, Q&A, changes | Yes | Yes |
| Create/edit/delete activities, steps, tasks | Yes | No |
| Create/edit/reorder personas | Yes | No |
| Upload sources (trigger ingestion) | Yes | No |
| Accept/reject changesets | Yes | No |
| Answer questions / trigger evolution | Yes | No |
| Create/edit releases, assign tasks | Yes | No |
| Manage project members (invite/remove/promote) | Yes | No |
| Chat with map-chat agent | Yes | No |
| Export map (JSON/Markdown) | Yes | Yes |

### Data Model

```sql
-- Project members (Eden-managed role assignments)
-- Org owners/admins are implicit editors and don't need rows here.
-- Org members get a row when explicitly invited or promoted.
CREATE TABLE project_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          TEXT NOT NULL,
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL,           -- Eve user ID (user_xxx)
    email           TEXT,                    -- Cached for display
    role            TEXT NOT NULL DEFAULT 'viewer',  -- 'editor' | 'viewer'
    invited_by      TEXT,                    -- user_id of inviter
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON project_members
    USING (org_id = current_setting('app.org_id', true));

CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
```

### Role Resolution Logic

```
function resolveProjectRole(eveUser, projectId):
    // Org owners and admins are always editors
    if eveUser.role in ['owner', 'admin']:
        return 'editor'

    // Check explicit project membership
    row = query project_members WHERE project_id = projectId AND user_id = eveUser.id
    if row exists:
        return row.role

    // Default: org members are viewers
    return 'viewer'
```

This runs once per request (or is cached per request context) and is
available to all downstream guards and controllers.

---

## Implementation

### 1. Database Migration

**File**: `db/migrations/20260313100000_project_members.sql`

Add the `project_members` table with RLS. Lightweight — no data backfill
needed. Existing org owners/admins are implicit editors via the resolution
logic.

### 2. Backend: Role Resolution Middleware

**File**: `apps/api/src/common/project-role.middleware.ts`

A NestJS middleware that runs after `eveUserAuth()` on project-scoped
routes. It:

1. Extracts `projectId` from the route params (`:projectId` or `:id` on
   project-nested routes)
2. Calls `resolveProjectRole(req.user, projectId)`
3. Attaches `req.projectRole` (`'editor' | 'viewer'`)

```typescript
// Pseudo-code — actual implementation will use NestJS middleware pattern
export class ProjectRoleMiddleware implements NestMiddleware {
    constructor(private db: DatabaseService) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const user = req.user;
        if (!user) return next();

        const projectId = req.params.projectId || req.params.id;
        if (!projectId) return next();

        // Org owners/admins are always editors
        if (['owner', 'admin'].includes(user.role)) {
            req.projectRole = 'editor';
            return next();
        }

        // Check explicit membership
        const member = await this.db.query(
            `SELECT role FROM project_members
             WHERE project_id = $1 AND user_id = $2`,
            [projectId, user.id]
        );

        req.projectRole = member?.role || 'viewer';
        next();
    }
}
```

### 3. Backend: Editor Guard

**File**: `apps/api/src/common/editor.guard.ts`

A NestJS guard applied to mutating endpoints. Returns 403 if
`req.projectRole !== 'editor'`.

```typescript
@Injectable()
export class EditorGuard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        if (req.projectRole !== 'editor') {
            throw new ForbiddenException('Editor access required');
        }
        return true;
    }
}
```

**Applied to**: All `POST`, `PATCH`, `DELETE` endpoints on project-scoped
resources. Read endpoints (`GET`) remain accessible to all authenticated
org members.

Usage in controllers:

```typescript
@Get('projects/:projectId/tasks')
@UseGuards(AuthGuard)                    // Any authenticated user
list(@Param('projectId') id: string) { ... }

@Post('projects/:projectId/tasks')
@UseGuards(AuthGuard, EditorGuard)       // Editors only
create(@Param('projectId') id: string, @Body() dto: CreateTaskDto) { ... }
```

### 4. Backend: Member Management API

```
GET    /api/projects/:id/members              List members (with resolved roles)
POST   /api/projects/:id/members              Invite member (editor only)
PATCH  /api/project-members/:id               Update role (editor only)
DELETE /api/project-members/:id               Remove member (editor only)
```

**List response** includes both explicit members and implicit editors
(org owners/admins), so the UI shows the complete picture:

```json
{
    "members": [
        { "user_id": "user_abc", "email": "alice@co.com", "role": "editor", "source": "org_admin" },
        { "user_id": "user_def", "email": "bob@co.com",   "role": "editor", "source": "explicit" },
        { "user_id": "user_ghi", "email": "carol@co.com", "role": "viewer", "source": "explicit" },
        { "user_id": "user_jkl", "email": "dave@co.com",  "role": "viewer", "source": "default" }
    ]
}
```

**Invite endpoint** accepts email and role. Eden doesn't create Eve users —
the invitee must already be an org member. If they're not, return 422 with
a message suggesting they be invited to the org first.

### 5. Frontend: Role-Aware UI

**`useProjectRole()` hook** — fetches the current user's resolved role for
the active project. Returns `'editor' | 'viewer' | null`.

```typescript
// apps/web/src/hooks/useProjectRole.ts
export function useProjectRole() {
    // Derived from /auth/me + /api/projects/:id/members
    // or from a dedicated /api/projects/:id/my-role endpoint
}
```

**UI changes**:

| Component | Editor | Viewer |
|-----------|--------|--------|
| Task cards | Click to edit, show edit icons | Click to view (read-only expanded state) |
| "Add Activity/Step/Task" buttons | Visible | Hidden |
| Source upload zone | Visible | Hidden (show "Request editor access" message) |
| Changeset review modal | Accept/Reject buttons | View-only (no action buttons) |
| Question answer form | Editable textarea + "Evolve Map" button | Read-only answer display |
| Release task assignment | Drag-and-drop enabled | Disabled |
| Chat panel | Send messages (triggers map-chat) | Read-only chat history |
| Member management | "Invite" button, role dropdowns | View member list only |
| Map toolbar | All actions enabled | Export only |

**No separate viewer UI** — the same components render with edit controls
conditionally hidden/disabled based on role. This avoids duplicating
components and keeps the codebase simple.

### 6. Frontend: Settings Panel (Member Management)

Add a "Members" section to the project settings panel:

```
┌─ Project Settings ────────────────────────────────┐
│                                                     │
│ Members                                    [Invite] │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ alice@co.com        Editor    (org admin)    —  │ │
│ │ bob@co.com          Editor ▾  (invited)    [×]  │ │
│ │ carol@co.com        Viewer ▾  (invited)    [×]  │ │
│ │ dave@co.com         Viewer    (default)     —   │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Org admins and owners are always editors.           │
│ Org members are viewers unless promoted.            │
└─────────────────────────────────────────────────────┘
```

- Implicit editors (org admins/owners) show a lock icon — can't be demoted
- Explicit members show a role dropdown and remove button
- Default viewers show "—" for actions — promote them by clicking "Invite"

---

## API Endpoint Summary

| Method | Path | Guard | Purpose |
|--------|------|-------|---------|
| `GET` | `/api/projects/:id/members` | Auth | List all members with resolved roles |
| `POST` | `/api/projects/:id/members` | Auth + Editor | Invite org member to project |
| `PATCH` | `/api/project-members/:memberId` | Auth + Editor | Change member role |
| `DELETE` | `/api/project-members/:memberId` | Auth + Editor | Remove explicit membership |
| `GET` | `/api/projects/:id/my-role` | Auth | Current user's resolved role |

---

## Agent Access

Agents authenticate via service principal tokens, which carry
`type: 'service_principal'` and explicit `scopes`. The `EditorGuard`
treats service principals as editors — agents must be able to create
changesets, questions, and other write operations.

```typescript
// In EditorGuard
if (req.user?.type === 'service_principal') return true;
```

This is consistent with the design principle: "agents and humans use the
same API." Agents propose via changesets; the human editor reviews. The
agent's write access doesn't bypass human approval — it just allows the
agent to create the changeset that the human then accepts or rejects.

---

## Platform Gaps (For Eve Horizon Backlog)

These are enhancements to Eve that would simplify Eden's implementation.
None are blockers — Eden works without them using the local
`project_members` table.

### Gap 1: Project Role in Auth SDK

**What**: `eveUserAuth()` middleware should optionally resolve project
membership and attach `req.eveUser.projectRole` when a project context
is available (e.g. from `X-Eve-Project-Id` header or middleware config).

**Why**: Currently apps must maintain their own project membership tables
and resolution logic. Every app that needs project-level access control
reinvents this.

**Suggested shape**:

```typescript
// In @eve-horizon/auth
app.use(eveUserAuth({
    projectHeader: 'X-Eve-Project-Id',  // or extract from route
}));

// Result: req.eveUser.projectRole = 'owner' | 'admin' | 'member' | null
```

### Gap 2: Project Memberships in JWT or /auth/me

**What**: When a request includes project context, `/auth/me` should
return the user's project-level role alongside org memberships.

**Why**: Avoids per-request API round-trips to Eve for project membership
checks. The frontend needs this to conditionally render edit controls.

**Suggested shape** (additive to existing response):

```json
{
    "user_id": "user_abc",
    "email": "alice@co.com",
    "org_id": "org_xyz",
    "role": "member",
    "memberships": [{ "org_id": "org_xyz", "role": "member" }],
    "project_role": "admin"
}
```

### Gap 3: Custom Project Roles

**What**: Allow apps to define custom role names beyond `owner/admin/member`
at the project level — e.g. `editor` and `viewer`.

**Why**: The three-tier `owner/admin/member` model is fine for Eve platform
operations but doesn't map cleanly to app-specific access tiers. Eden
wants `editor/viewer`, another app might want `approver/contributor/reader`.

**Not a blocker**: Eden maps platform roles to app roles in its middleware.
But a generic solution would reduce boilerplate across all Eve apps.

---

## Migration Path (When Platform Catches Up)

When Eve adds project role support to the Auth SDK:

1. Read project role from `req.eveUser.projectRole` instead of querying
   `project_members` table
2. Map Eve project roles to Eden roles: `owner/admin → editor`,
   `member → viewer`
3. Use Eve's project member management API instead of Eden's
   `/api/projects/:id/members` endpoints
4. Drop the `project_members` table in a migration
5. Remove the `ProjectRoleMiddleware` — the Auth SDK handles it

This is a clean swap because all role checks go through `req.projectRole`,
which is set in one place (the middleware). Controllers and guards don't
know or care where the role came from.

---

## Testing Strategy

### Local Docker

- Migration applies cleanly
- Role resolution logic: org admin → editor, org member → viewer, explicit
  override works
- `EditorGuard` returns 403 for viewers on write endpoints
- `EditorGuard` passes service principals through
- Member management CRUD works
- List endpoint shows implicit + explicit members correctly

### Staging

- Real Eve SSO tokens with org roles flow through correctly
- Org admin sees editor UI, org member sees viewer UI
- Explicit promotion from viewer to editor works end-to-end
- Agent changeset creation still works (service principal bypass)

---

## Delivery Sequence

| Step | What | Depends On |
|------|------|------------|
| 1 | DB migration (`project_members` table) | Phase 2 schema |
| 2 | `ProjectRoleMiddleware` + `EditorGuard` | Step 1 |
| 3 | Apply `EditorGuard` to all write endpoints | Step 2 |
| 4 | Member management API (`/projects/:id/members`) | Step 2 |
| 5 | `useProjectRole()` hook | Step 4 |
| 6 | Conditional UI rendering (hide/disable for viewers) | Step 5 |
| 7 | Members section in project settings | Step 4, 6 |

Steps 2–4 can be done in a single PR. Steps 5–7 in a second PR.
