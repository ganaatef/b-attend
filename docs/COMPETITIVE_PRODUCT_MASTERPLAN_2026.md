# B-Attend Competitive Product Masterplan — 2026

**Status:** Product source of truth for competitive direction  
**Baseline date:** 2026-09-10  
**B-Attend code baseline:** `integration/main-reconcile`  
**Technical baseline:** the hardened integration line has passed Prisma validation/generation, TypeScript, lint, i18n, unit tests, production dependency audit, production build, and PostgreSQL runtime-security tests. This does **not** mean production is deployed.

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
| GPS accuracy/risk signal | ✅ trust-v1 | 🟡 | 🟡 | Deterministic server-side signal now active |
| Device identity/risk | 🟡 | ? | ? | Trusted kiosk supported; mobile device integrity next |
| Impossible-travel anomaly | 🟡 engine-ready | ? | ? | Signal contract exists; detector still required |
| Explainable attendance trust score | 🟡 trust-v1 | ? | ? | **Signature B-Attend feature; score + risk + reasons now computed** |
| Attendance history | ✅ | ✅ | ✅ | Keep |
| Late/absence/early-leave logic | ✅ | ✅ | ✅ | Keep and version policies |
| Missing clock-out handling | ✅ | ✅ | ✅ | Keep |
| Overtime calculation | ✅ foundation | ✅ | ✅ | Deepen policy + forecast |
| Manager sign-in on behalf | 🟡 delegated clock foundation | ✅ | ? | Finish with scoped IAM + audit |
| Field check-ins/missions | 🔴 | ✅ | 🟡 | **P0 frontline parity** |
| Office/no-smartphone attendance | ✅ kiosk path | ✅ | ? | Keep |
| Facial authenticity report | 🔴 | ✅ | ? | Include in Trust Engine review UI |

**Trust Engine v1 progress:** mobile-app, mobile-web and trusted-kiosk punches now pass through a deterministic trust assessment. The current evidence set uses server-side geofence state, GPS accuracy when available and registered kiosk trust. The contract already reserves independent signals for mock-location risk, face match, liveness and impossible travel; these are intentionally `UNKNOWN` until a trusted provider/device signal exists. Suspicious scores are review-first by default to avoid false hard-rejections during rollout. Trust score/risk/policy version are returned to the client, written into punch evidence, logged in audit data and surfaced in the live attendance feed. Query-side live attendance access now resolves IAM tenant/branch/department/self scopes server-side instead of relying on hard-coded role filtering.

## 5. Current strengths to protect

- Employee record and login identity are separate concepts.
- Tenant IAM supports custom roles, granular permissions and scoped assignments.
- Authorization and subscription entitlement are separate decisions.
- Secure invitation flow avoids plaintext temporary passwords.
- Live session identity/role refresh prevents stale elevated JWT privileges.
- Ownership transfer is protected with current-owner password re-authentication and immediate sign-out.
- Kiosk credentials and employee PINs use hardened credential flows.
- Mobile API uses separately-audienced bearer tokens and idempotency keys for clock mutations.
- PostgreSQL runtime authorization/isolation tests are part of the CI gate.

## 6. Top-tier execution priorities

### P0 — market-entry quality
1. Production release gate, preflight, rollback and external service configuration.
2. Attendance Trust Engine: normalized evidence model, face-provider abstraction, liveness, mock-location/device integrity and configurable tenant policy.
3. Workforce scheduling depth: rotations, breaks, missions/check-ins, coverage and multi-level approvals.
4. Mobile reliability: offline/retry behavior, device/session control, push abstractions and measurable success-rate SLOs.
5. Hybrid onboarding/billing: shared provisioning core for self-service + sales-assisted + enterprise flows.

### P1 — category leadership
1. Egypt payroll depth, loans/advances, claims and immutable payroll correction history.
2. Live Operations Intelligence: staffing coverage, cost, overtime forecast and ranked anomalies.
3. B-Attend AI Operations Copilot: explain, simulate, confirm and safely execute through domain tools.

### P2 — enterprise moat
1. MFA/passkeys, OIDC/SAML, SCIM, domain verification and enterprise security policies.
2. Privacy/data lifecycle controls, observability, backup/restore verification and explicit SLOs.

## 7. Definition of leadership

B-Attend should not claim to be "the top" because a checklist is long. Leadership requires measurable evidence:

- higher attendance submission success rate and lower p95 latency;
- fewer ambiguous/fraudulent punches through explainable trust decisions;
- safer delegated administration through scoped IAM;
- faster manager resolution of coverage/attendance exceptions;
- reproducible payroll and cost calculations;
- AI answers/actions grounded in deterministic data and protected by the same authorization model;
- enterprise controls that can be demonstrated during a security review.

The target formula is:

> **Mawared breadth + bluworks simplicity + B-Attend Trust Engine + Enterprise IAM + action-capable AI.**
