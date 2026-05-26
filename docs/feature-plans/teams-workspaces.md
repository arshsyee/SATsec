# Feature Plan: Teams & Workspaces

**Effort:** 5-7 days
**Phase:** 3 (Growth Features)
**Dependencies:** Pricing tiers (Business plan: up to 5 members)

---

## Problem
Currently all audits are per-user. Agencies and dev teams want to share audit history,
dashboards, and scheduled monitors across a team — the #1 request that drives B2B deals.

---

## Data Model

### New tables
```python
class Workspace(Base):
    __tablename__ = "workspaces"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    id = Column(Integer, primary_key=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role = Column(String, default="member")   # "owner" | "admin" | "member"
    invited_at = Column(DateTime, default=datetime.utcnow)
```

Audit results and schedules get a `workspace_id` FK (nullable — personal audits stay personal).

---

## New Endpoints
- `POST /workspaces` — create workspace (Business plan only)
- `GET /workspaces` — list user's workspaces
- `POST /workspaces/{id}/invite` — send invite email to new member
- `DELETE /workspaces/{id}/members/{user_id}` — remove member
- Audit/schedule routes: accept optional `workspace_id` param to scope results

---

## Frontend Changes
- Workspace switcher in navbar (Personal / Workspace A / Workspace B)
- Team settings page: member list, invite by email, roles
- Dashboard scoped to selected workspace

---

## Invite Flow
1. Owner enters email → backend generates invite token, sends email
2. Invitee clicks link → redirected to `/join?token=...`
3. If not registered: signup page pre-filled with email
4. On accept: `WorkspaceMember` row created

---

## MVP Simplification
Ship without roles first — all members are equal, only owner can delete workspace.
Add admin role in a follow-up after validating demand.
