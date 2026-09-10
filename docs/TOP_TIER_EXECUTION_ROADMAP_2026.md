# B-Attend Top-Tier Execution Roadmap — 2026

**Purpose:** convert the competitive masterplan into an ordered engineering/product execution plan.  
**Companion document:** `docs/COMPETITIVE_PRODUCT_MASTERPLAN_2026.md`

## 1. North Star

B-Attend becomes a **Workforce Operating System for frontline and multi-location businesses**, not another attendance/HRMS clone.

The product must combine:

- trusted attendance
- scheduling and frontline operations
- employee/HR lifecycle
- payroll and workforce cost
- enterprise identity/access control
- real-time operational intelligence
- an AI operations layer that can safely simulate and execute approved actions

## 2. Execution law

Every roadmap item follows four constraints:

1. **Server is source of truth.** Client checks are UX, never authorization.
2. **Permission and entitlement are separate decisions.** A permitted user cannot use a feature the tenant did not buy.
3. **Critical writes are idempotent, transactional and audited.**
4. **AI never bypasses domain services, IAM or human confirmation for high-impact actions.**

## 3. Wave 0 — Stabilize the release candidate

**Epic:** #3

This wave happens before production go-live.

### Required work

- Keep `integration/main-reconcile` as the current hardened source branch until a reviewed release branch/PR is ready.
- Wire ownership-transfer UI to the existing re-authenticated backend flow.
- Remove one-off refactor/migration workflows and marker files after their generated code is permanently committed.
- Keep CI fail-closed.
- Keep PostgreSQL runtime-security tests as a mandatory release gate.
- Finalize production preflight and migration ownership.
- Verify invitation-email path and secure fallback.
- Produce release and rollback runbooks.

### Exit gate

No production go-live until all of the following are true:

- Prisma migrations apply cleanly to a production-like database.
- TypeScript, lint, i18n, tests, production dependency audit and build pass.
- Cross-tenant authorization runtime tests pass.
- Production configuration contains no dev fallback secrets.
- Billing/onboarding mode is explicit.
- Rollback procedure is documented and testable.

## 4. Wave 1 — Category-leading launch wedge

The objective is not to ship the largest HR suite. The objective is to enter with a product that is clearly better at frontline workforce operations.

### 4.1 Hybrid onboarding and subscriptions

**Epic:** #12

Build one provisioning domain service used by:

- self-service SMB signup
- sales-assisted tenant setup
- future enterprise/SCIM provisioning

Manual B2B billing remains valid for sales-assisted customers. Public self-service must require a real payment provider and signed/idempotent webhook processing.

### 4.2 Mobile/ESS reliability

**Epic:** #6

Required before aggressive acquisition:

- retry-safe/idempotent attendance mutations
- clear weak-network behavior
- schedule/calendar
- requests and balances
- attendance history
- manager approvals for authorized scopes
- push-notification abstraction
- device/session revocation foundation
- Arabic-first RTL and English parity
- latency/error/success-rate telemetry

**Product metric:** attendance submission success rate is a first-class KPI, not a support anecdote.

### 4.3 Scheduling, breaks and approvals

**Epic:** #5

Required competitive depth:

- recurring/rotational shifts
- real break sessions
- field missions/check-ins
- multi-level approval chains
- conflict detection
- live coverage by branch/role/shift
- policy-based overtime and approval rules

### 4.4 Attendance Trust Engine v1

**Epic:** #4

This is the main launch differentiator.

#### Inputs

- geofence distance
- GPS accuracy
- facial verification
- liveness/anti-spoofing
- mock-location/developer-mode risk where available
- device identity/history
- IP/network context
- time/location anomaly signals

#### Output

Every attendance event gets an explainable assessment:

- Trust Score 0–100
- risk level
- individual signal results
- policy version
- decision: verified / review required / blocked

The score is not an opaque AI guess. It must be deterministic from recorded signals and versioned policy.

### Wave 1 market-entry gate

B-Attend may market itself as a top-tier frontline workforce platform only when:

- clock-in reliability is measurable
- face/liveness and mock-location risk are handled
- rotational scheduling and breaks are operational
- scoped IAM protects manager views/actions
- suspicious attendance has an explainable review flow
- onboarding/billing can support the chosen commercial motion

## 5. Wave 2 — Workforce command center

**Epic:** #8

Turn dashboards into a real operations surface.

### Required intelligence

- live coverage gaps
- no-shows and late arrivals
- missing clock-outs
- overtime accumulation
- planned vs actual staffing
- workforce cost by branch/department/role
- payroll/overtime forecast
- ranked operational anomalies

Every metric must show calculation context and be reproducible from deterministic data.

### UX principle

A manager should move from signal → explanation → authorized action in no more than two interactions.

Example:

> Giza evening shift is short by 3 employees. Projected overtime impact: EGP X. Open scheduling / review alternatives.

## 6. Wave 3 — Egypt payroll depth

**Epic:** #7

The current payroll foundation is extended into a compliance-conscious operational payroll engine.

### Required work

- effective-dated tax and social-insurance rules
- attendance close/lock
- policy-linked overtime/allowances/deductions
- loans/advances + installment schedules
- claims/reimbursements
- payslips
- bank-transfer output
- multi-branch/cost-center allocation
- immutable finalized runs and correction/reopen flow

### Non-negotiable accounting rule

Historical payroll cannot change because a current tax rule or employee configuration changed. Every calculation needs the effective rule/version used at finalization.

## 7. Wave 4 — AI Operations Copilot

**Epic:** #9

B-Coach remains valuable for employee coaching, but the company-level AI product is different.

### Target interaction

**Detect/Ask → Explain → Recommend → Simulate → Confirm → Execute → Audit**

### Phase A: read-only intelligence

- Arabic/English workforce Q&A
- live attendance/schedule/leave/payroll queries
- structured tables/cards
- source/evidence panel
- export

### Phase B: simulation

- staffing coverage alternatives
- overtime reduction
- payroll impact
- shift swap impact
- branch/role cost changes

### Phase C: safe execution

Examples:

- draft schedule changes
- start an approval
- create a draft warning
- prepare payroll-review actions
- open/prepare an export

High-impact changes require explicit confirmation; ownership, billing, security and financial finalization may require re-authentication.

### AI release gate

The Copilot cannot ship action execution until red-team/evaluation tests prove:

- no cross-tenant data retrieval
- no scope bypass
- no privilege escalation
- no unconfirmed high-impact mutation
- prompt injection from employee documents cannot override system/tool policy
- numerical answers use deterministic calculations

## 8. Wave 5 — Enterprise identity and governance

**Epics:** #10 and #11

### Identity/security

- MFA
- passkeys/WebAuthn
- session/device registry
- revoke-one/revoke-all
- Google Workspace OIDC
- Microsoft Entra ID OIDC
- SAML 2.0
- SCIM 2.0
- domain verification
- IP/trusted-network policy
- role anti-escalation
- break-glass recovery

### Privacy/governance

- PII classification
- employee/location/biometric transparency
- configurable retention
- export/anonymize/delete workflows where legally appropriate
- AI data retention boundaries
- backup/restore verification
- incident-response playbook
- production SLOs and alerting

## 9. What is deliberately not P0

The following are useful but should not distract from the launch wedge unless a signed customer requires them:

- broad generic task/project management
- full company expense ERP
- recruitment/ATS
- deep performance-management suites
- accounting/general-ledger replacement

B-Attend can integrate with specialist systems instead of becoming an unfocused ERP.

## 10. Architecture boundaries

### Identity

`Employee` is an HR/workforce record. `User` is a login identity. They may be linked, but neither substitutes for the other.

### Authorization

Use **Role + Permission + Scope**. Legacy role strings remain compatibility hints only while migration is in progress.

### Commercial access

Use **Entitlements** independently of permissions.

### Attendance verification

Attendance domain logic owns the trust decision. Face/GPS/device vendors are adapters.

### Payroll

Payroll is deterministic domain logic. AI can explain or simulate but cannot invent payroll values.

### AI

LLM = planner/interface. Domain tools = data and actions. Authorization is checked at each tool call, not once at chat entry.

## 11. Definition of Done for every production feature

A production feature is done only if it has:

- tenant isolation
- permission + scope checks
- entitlement check where applicable
- validation and concurrency/idempotency protection
- audit event for sensitive mutations
- Arabic/English user-facing parity where applicable
- error states that tell the operator what happened
- automated success + negative/security tests
- migration/rollback safety for schema changes
- metrics/logging for operationally important flows
- documentation for support/operations when needed

## 12. Current GitHub epics

| Priority | Issue | Outcome |
|---|---|---|
| P0 | #3 | production release gate |
| P0 | #12 | hybrid onboarding/subscriptions/billing |
| P0 | #6 | mobile/ESS reliability |
| P0 | #5 | scheduling/breaks/approvals |
| P0 | #4 | Attendance Trust Engine |
| P1 | #8 | live operations command center |
| P1 | #7 | Egypt payroll/financial workflows |
| P1 | #9 | action-capable AI Operations Copilot |
| P2 | #10 | enterprise IAM/SSO/SCIM |
| P2 | #11 | privacy/compliance/observability |

## 13. Release strategy

Do not perform a big-bang rewrite. Deliver vertical slices that preserve the green security baseline.

Recommended slice order:

1. Release/ownership UI cleanup
2. Hybrid provisioning/billing service
3. Mobile idempotency/telemetry
4. Rotational scheduling + break sessions
5. Trust Engine data model/policy → face/liveness adapter → risk UI
6. Live coverage command center
7. Payroll compliance/financial workflows
8. AI read tools → simulations → controlled execution
9. Enterprise identity/governance

Every slice must leave CI green before the next slice lands.

## 14. Production guardrail

This roadmap authorizes engineering work on isolated branches and PRs. It does **not** authorize a production deploy, production DB migration, production secret change or merge into `main` without explicit go-live approval.