# B-Attend Competitive Product Masterplan — 2026

**Status:** Product source of truth for competitive direction  
**Baseline date:** 2026-09-10  
**B-Attend code baseline:** `integration/main-reconcile` at `f27182980bbed6c4baba0d5694b6c7d1ab27edaa` before this document commit  
**Technical baseline:** CI run #49 passed Prisma validation/generation, TypeScript, lint, i18n, tests, production dependency audit, production build, and PostgreSQL runtime-security tests. This does **not** mean production is deployed.

## 1. Product decision

B-Attend will not enter the market as another attendance app or a feature-for-feature HRMS clone.

**Category:** **Workforce Operating System for frontline and multi-location businesses.**

The first market wedge is:

> **Trusted Attendance + Workforce Operations + Live Intelligence + Enterprise-grade Control**

Then B-Attend expands into full HR/payroll depth without sacrificing the simplicity of the operational product.

The rule for roadmap decisions is:

> **Parity where customers expect it. Superiority where customers choose us.**

We do not delay every release until every incumbent feature exists. We do refuse to claim leadership where B-Attend is still shallow.

## 2. Competitive reference set

### Mawared HR
Public product material currently documents employee management, GPS + facial-recognition attendance, AI anti-spoofing, mock-location detection, fixed/rotational shifts, breaks, request rules, multi-level approvals, overtime calculations, office-account attendance, check-ins, sign-in on behalf, assignments, payroll, loans, bonuses, deductions, claims, petty cash, company expenses, documents, employee self-service, notifications and reporting.

Public sources:
- https://www.mawaredhr.com/
- https://www.mawared-hr.com/features
- https://www.linkedin.com/company/mawaredhrsystem

Mawared publicly claims 1,200+ clients, 19,500+ locations, 135,000+ activated users and 46M+ sign-in/out records in recent company posts. Treat these as vendor claims, not independently audited metrics.

### bluworks
Public product material documents scheduling, GPS/geofenced attendance, facial recognition, live coverage, payroll automation, Egyptian tax/social insurance, leave, employee records, loans/advances, incentives/penalties, reports, employee app and an Arabic/English AI Assistant over workforce data.

Public sources:
- https://bluworks.io/overview/
- https://bluworks.io/payroll-automation/
- https://bluworks.io/incentives-penalties/
- https://bluworks.io/ai-assistant/

For enterprise IAM/security capabilities not explicitly documented on competitor public pages, this document uses **?** rather than claiming the feature is absent.

## 3. Legend

- **✅** = implemented in current B-Attend code / publicly documented by competitor
- **🟡** = partial, foundation exists, or not yet at competitive depth
- **🔴** = not found as a complete capability in current B-Attend baseline
- **?** = competitor capability not prominently documented publicly; do not infer absence

## 4. Master feature matrix

### 4.1 Attendance, verification and time

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Mobile clock-in/out | ✅ | ✅ | ✅ | Keep as core |
| GPS/geofence verification | ✅ | ✅ | ✅ | Keep; make policy/scoping stronger |
| Kiosk/device attendance | ✅ | ✅ office-account path | 🟡 public material emphasizes mobile | Keep as multi-channel strength |
| Facial recognition | 🔴 | ✅ | ✅ | **P0 parity** |
| Liveness / anti-spoofing | 🔴 | ✅ | ? | **P0 parity + better evidence model** |
| Mock-location detection | 🔴 | ✅ | ? | **P0 parity** |
| GPS accuracy/risk signal | 🟡 | 🟡 | 🟡 | Promote to explicit trust signal |
| Device identity/risk | 🟡 | ? | ? | Build as differentiator |
| Impossible-travel anomaly | 🔴 | ? | ? | Build as differentiator |
| Explainable attendance trust score | 🔴 | ? | ? | **Signature B-Attend feature** |
| Attendance history | ✅ | ✅ | ✅ | Keep |
| Late/absence/early-leave logic | ✅ | ✅ | ✅ | Keep and version policies |
| Missing clock-out handling | ✅ | ✅ | ✅ | Keep |
| Overtime calculation | ✅ foundation | ✅ | ✅ | Deepen policy + forecast |
| Manager sign-in on behalf | 🟡 delegated clock foundation | ✅ | ? | Finish with scoped IAM + audit |
| Field check-ins/missions | 🔴 | ✅ | 🟡 | **P0 frontline parity** |
| Office/no-smartphone attendance | ✅ kiosk path | ✅ | ? | Keep |
| Facial authenticity report | 🔴 | ✅ | ? | Include in Trust Engine review UI |

### 4.2 Scheduling, breaks and requests

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Fixed schedules | ✅ | ✅ | ✅ | Keep |
| Rotational/recurring shift templates | 🟡 | ✅ | ✅ | **P0 parity** |
| Bulk scheduling | ✅ foundation | ✅ | ✅ | Harden conflict handling |
| Employee work calendar | ✅ | ✅ | ✅ | Keep mobile-first |
| Leave conflict detection | ✅ foundation | ✅ | ✅ | Keep |
| Break policy duration | 🟡 model fields | ✅ | ? | Add real break sessions |
| Break start/end sessions | 🔴 | ✅ | ? | **P0 parity** |
| Permissions/remote-work requests | ✅ foundation | ✅ | 🟡 | Expand types and UX |
| Multi-level approval chains | 🟡 | ✅ | ✅ configurable cycles | **P0 parity** |
| Auto approve/deny rules | 🔴 | ✅ | ? | Add rules engine where explainable |
| Request comments/attachments | 🟡 | ✅ | 🟡 | Complete |
| Delegation/escalation/SLA | 🔴 | ? | ? | Enterprise differentiator |
| Live coverage gaps | 🟡 dashboard foundation | 🟡 | ✅ | **P0/P1 major differentiator** |

### 4.3 Employee records and HR operations

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Employee master record | ✅ | ✅ | ✅ | Keep |
| Employee record separate from login identity | ✅ | ? | ? | **B-Attend architecture advantage** |
| Departments/job titles | ✅ | ✅ | ✅ | Keep |
| Contracts | ✅ | ✅ | ✅ | Keep |
| Employee documents | ✅ | ✅ | ✅ | Keep; add expiry workflows |
| Leave types/balances/requests | ✅ | ✅ | ✅ | Keep/deepen policy |
| Warnings/disciplinary records | ✅ | 🟡 penalties | 🟡 penalties | Keep |
| Training | ✅ | ? | ? | Keep as HR depth advantage |
| Skills | ✅ foundation | ? | ? | Use later for smart scheduling |
| Assets | ✅ | ✅ | ? | Keep |
| Onboarding/offboarding | ✅ | 🟡 | ? | Keep |
| General task management | 🟡 HR onboarding tasks only | ✅ | ? | Not launch-critical |
| Announcements | 🔴 | 🟡/public historic material | ? | Add through employee communications later |

### 4.4 Payroll and employee financials

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Payroll profile/run foundation | ✅ | ✅ | ✅ | Keep |
| Attendance → payroll input | ✅ foundation | ✅ | ✅ | Make deterministic/auditable |
| Bonuses/deductions/adjustments | ✅ foundation | ✅ | ✅ | Deepen rule linkage |
| Egypt tax/social insurance | 🟡 not yet a verified compliance engine | 🟡 public payroll | ✅ explicitly documented | **P1 must become effective-dated engine** |
| Loans/salary advances | 🔴 | ✅ | ✅ | **P1 parity** |
| Installment auto-deduction | 🔴 | ✅ | ✅ | **P1 parity** |
| Claims/reimbursements | 🔴 | ✅ | ? | P1 |
| Petty cash | 🔴 | ✅ | ? | P1/P2 based on customer demand |
| Company expenses | 🔴 | ✅ | ? | Keep separate from core payroll accounting |
| Multi-branch/cost-center payroll | 🟡 | ✅ | ✅ analytics | P1 |
| Payslips | 🟡 payroll foundation | ✅ | ✅ | Complete employee/mobile UX |
| Bank-transfer export | 🔴/not verified | ✅ file exports | ✅ bank transfer files | P1 |
| Government/statutory reports | 🔴/not verified | 🟡 | ✅ | P1 after compliance verification |
| Immutable finalized payroll + correction workflow | 🟡 | ? | ✅ audit messaging | Build as trust differentiator |

### 4.5 Mobile employee and manager experience

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Native/mobile API auth | ✅ | ✅ app | ✅ app | Keep |
| Mobile clock | ✅ | ✅ | ✅ | Harden retries/idempotency |
| Mobile schedule | ✅ API | ✅ | ✅ | Keep |
| Mobile requests | ✅ API | ✅ | ✅ | Expand |
| Attendance history | ✅ web/core; mobile depth partial | ✅ | ✅ | P0 UX |
| Payslip access | 🟡 | ✅ | ✅ | P0/P1 |
| Manager mobile approvals | 🟡 | ✅ | ✅ | P0 |
| Push notifications | 🟡 notification foundation | ✅ | 🟡 | P0 abstraction |
| Session/device management | 🔴 | ? | ? | P0/P2 security advantage |
| Offline/poor-network idempotency | 🟡 | ? | ? | **P0 reliability differentiator** |
| Arabic-first RTL | ✅ broad localization foundation | ✅ | ✅ Arabic-first | Keep parity as non-negotiable |

### 4.6 Identity, permissions and enterprise control

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Multi-tenant isolation | ✅ | ✅ expected SaaS | ✅ expected SaaS | Runtime-test continuously |
| Protected platform admin vs tenant boundary | ✅ | ? | ? | Keep |
| Custom roles | ✅ | ? | ? | **Lead with it** |
| Capability permissions | ✅ | ? | ? | **Lead with it** |
| Branch/department/self scopes | ✅ | ? | ? | **Lead with it** |
| Secure invite + set own password | ✅ | ? | ? | Keep |
| No plaintext temporary password | ✅ | ? | ? | Keep |
| Live role refresh / immediate demotion | ✅ | ? | ? | Security differentiator |
| Protected owner lifecycle | ✅ backend | ? | ? | Finish UI in P0 |
| Audit trail | ✅ | ✅ parts | ✅ payroll/HR | Keep/deepen |
| Entitlements separate from authorization | ✅ foundation | ? | ? | **SaaS architecture differentiator** |
| MFA | 🔴 | ? | ? | P2 enterprise |
| Passkeys/WebAuthn | 🔴 | ? | ? | P2 enterprise |
| Session/device registry | 🔴 | ? | ? | P0/P2 |
| Google/Microsoft OIDC | 🔴 | ? | ? | P2 |
| SAML SSO | 🔴 | ? | ? | P2 |
| SCIM | 🔴 | ? | ? | P2 |
| Domain verification | 🔴 | ? | ? | P2 |
| IP allowlist/security policies | 🔴 | ? | ? | P2 |

### 4.7 Analytics and AI

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Operational dashboard | ✅ foundation | ✅ | ✅ | Turn into command center |
| Reports/export foundation | ✅ | ✅ | ✅ | Keep |
| Employee AI coach | ✅ B-Coach | ? | ? | Keep as differentiated employee value |
| Daily briefing/coaching | ✅ foundation | ? | ? | Reuse infrastructure |
| Natural-language workforce Q&A | 🔴 | AI-powered marketing, public depth unclear | ✅ | **P1 parity** |
| Arabic/English assistant | 🔴 general assistant | ? | ✅ | P1 |
| Explain calculation/source | 🟡 deterministic app metrics | ? | ✅ assistant "shows its work" | P1 |
| AI action execution | 🔴 | ? | 🟡 action links shown publicly | **Signature B-Attend feature** |
| Schedule/cost simulation | 🔴 | ? | ? | **Signature B-Attend feature** |
| Overtime/payroll forecast | 🔴/🟡 | ✅ payroll projections | 🟡 analytics | P1 |
| Risk/anomaly ranking | 🔴 | 🟡 reports | 🟡 live visibility | P1 |

### 4.8 SaaS commercial platform

| Capability | B-Attend now | Mawared HR | bluworks | B-Attend decision |
|---|---:|---:|---:|---|
| Public marketing/pricing architecture | ✅ | demo-led | demo-led/no fixed public pricing | Keep SMB advantage |
| Self-service signup foundation | ✅ | demo/contact | demo/contact | Keep but harden |
| Sales-assisted onboarding | ✅ platform foundation | ✅ | ✅ | First-class, not workaround |
| Enterprise provisioning | 🔴 | ? | ? | P2 via SSO/SCIM |
| Trial/subscription states | ✅ | ? | ? | Keep |
| Plan entitlement engine | ✅ foundation | ? | ? | Keep/deepen |
| Manual invoice/bank-transfer path | ✅ | sales-assisted likely | sales-assisted likely | Keep for Egypt B2B |
| Recurring online gateway | 🟡 provider placeholders; no live credentials | ? | ? | P0 for public self-service |
| Signed/idempotent billing webhooks | 🟡 architecture required | ? | ? | P0 |
| Support tickets | ✅ | support | support | Keep |

## 5. Where B-Attend should win

### 5.1 Attendance Trust Engine
Mawared already makes simple facial recognition + GPS insufficient as a market differentiator. B-Attend must combine location, liveness, device, network and anomaly signals into an explainable **Trust Score** with auditable policy decisions.

### 5.2 Enterprise-grade permissions without enterprise-grade complexity
B-Attend already has the correct architectural direction: Employee ≠ User, custom Role + Permission + Scope, protected owner, secure invitations and live identity state. Productize this visibly instead of hiding it as backend plumbing.

### 5.3 Mobile reliability
Reliability is product strategy. Every mobile mutation needs idempotency, clear error classes, safe retry behavior and measurable success/error latency. A pretty employee app with ambiguous attendance state is not acceptable.

### 5.4 Live Operations Intelligence
The manager's home screen should answer: who is missing, where coverage is weak, what overtime is building, what it will cost, and what action can fix it.

### 5.5 AI that executes safely
bluworks has raised the baseline with workforce Q&A. B-Attend should not stop at chat. The target is:

**Detect/Ask → Explain → Recommend → Simulate → Confirm → Execute → Audit**

The LLM never bypasses domain services, IAM or entitlements.

## 6. Launch wedge vs full-suite roadmap

### Launch wedge — must feel category-leading
- Production-safe release pipeline and hybrid onboarding
- IAM + scoped permissions + protected owner flow
- Highly reliable mobile clock/schedule/request experience
- Attendance Trust Engine v1: face/liveness + mock-location/device risk + explainable trust decision
- Rotational scheduling, real break sessions and strong approvals
- Live coverage/anomaly command center v1

### Expansion — must close HR/payroll breadth
- Egypt payroll compliance engine
- Loans/advances, claims, robust bonuses/deductions
- Payslip/bank exports/statutory outputs
- richer workforce analytics and cost forecasting

### Enterprise leadership
- MFA/passkeys/session devices
- Google/Microsoft OIDC, SAML, SCIM, domain verification
- privacy/retention/biometric governance
- action-capable AI Copilot with simulations and strong evaluation suite

## 7. Product scorecard

A feature is not "done" because a page exists. For a module to be production-complete it must satisfy:

1. Correct tenant isolation and scope authorization
2. Entitlement gating where commercial plans apply
3. Auditability for sensitive mutations
4. Idempotency/concurrency safety for critical writes
5. Arabic/English UX parity where user-facing
6. Mobile behavior where relevant
7. Observability and actionable errors
8. Automated tests, including negative/security cases
9. Migration/rollback safety for schema changes
10. Documentation and operator runbook when the feature affects production operations

## 8. GitHub execution epics

- #3 — P0 Production release gate and launch foundation
- #4 — P0 Attendance Trust Engine
- #5 — P0 Workforce scheduling, breaks and operational approvals
- #6 — P0 Mobile & employee self-service reliability
- #12 — P0 Hybrid onboarding, subscriptions and billing platform
- #7 — P1 Egypt payroll and employee financial workflows
- #8 — P1 Live Operations Intelligence
- #9 — P1 AI Operations Copilot
- #10 — P2 Enterprise identity, SSO, SCIM and security policy
- #11 — P2 Privacy, compliance, data lifecycle and production observability

## 9. Guardrails

- GitHub code is B-Attend source of truth; this document does not override current code behavior.
- Competitor columns mean **publicly documented**, not independently verified implementation quality.
- Never claim a competitor lacks an enterprise capability solely because it is absent from public pages.
- Never weaken authorization or runtime gates for roadmap speed.
- No production merge, deployment, secret change or production DB migration is implied by this roadmap.