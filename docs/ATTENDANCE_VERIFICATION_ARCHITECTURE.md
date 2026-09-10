# B-Attend Attendance Verification Architecture

## Purpose

Attendance verification is a server-side trust boundary, not a client-side checkbox. The mobile app may collect location or provider artifacts, but it cannot declare itself trusted, declare a face match, or declare liveness. Only a configured server-side verification adapter may turn opaque provider evidence into normalized trust signals.

## Trust pipeline

1. The authenticated employee requests `POST /api/mobile/clock/challenge`.
2. B-Attend loads the tenant attendance policy and the configured verification provider.
3. If the tenant requires a capability the provider does not support, the API fails closed with `VERIFICATION_PROVIDER_UNAVAILABLE`.
4. If verification is applicable, B-Attend creates a cryptographically random one-time challenge with a five-minute TTL. Only the SHA-256 hash is stored.
5. The challenge is bound to tenant, employee, user and provider.
6. The mobile client obtains opaque provider artifacts and submits them with the punch request. Raw client booleans or scores are never accepted as proof.
7. The server adapter verifies the provider artifacts and returns normalized signals: device integrity, mock-location risk, face-match score and liveness.
8. The Attendance Trust Engine combines those signals with geofence/GPS evidence and the versioned tenant policy.
9. The challenge is consumed in the same database transaction that creates the punch. Concurrent replay therefore cannot create a second verified punch.
10. Only sanitized provider metadata and references are persisted with the normalized trust assessment and audit record. Raw provider tokens and raw biometric media are not persisted in the attendance trust record.

## Data model

`AttendanceVerificationChallenge` stores the anti-replay state: tenant, employee, user, provider, challenge hash, requested capabilities, expiry and consumption timestamp.

`AttendanceTrustAssessment` stores the normalized, explainable decision: policy version, score, risk, decision, signal list, review state and sanitized evidence metadata. It remains linked one-to-one with the punch.

`CompanySettings` controls the tenant policy. The sensitive switches are `trustRequireDeviceIntegrity`, `trustRequireFace`, `trustRequireLiveness` and `trustBlockCriticalRisk`. B-Attend will not let an administrator enable a required capability that the currently configured provider cannot satisfy.

## Channel rules

Native device integrity, face matching and liveness apply to `MOBILE_APP`. They do not automatically penalize `KIOSK` or `MOBILE_WEB`, because those channels have different trust mechanisms. Kiosk device credentials remain independent.

A hard-rejected punch is retained as forensic/audit evidence but does not advance the employee's valid CLOCK_IN/CLOCK_OUT sequence. A punch awaiting review does remain part of the sequence until a manager resolves it.

## Provider adapter contract

The provider abstraction lives in `src/lib/attendance/verification-provider.ts`. Production adapters must:

- verify opaque artifacts server-side;
- bind provider verification to the B-Attend challenge where the upstream platform supports a nonce/challenge;
- validate app/package/bundle identity and environment;
- reject stale, malformed or replayed provider artifacts;
- return only normalized signals and non-secret references;
- never accept client-supplied `deviceTrusted`, `faceMatchScore`, `livenessPassed` or equivalent claims as authoritative.

The safe default provider is `none`. As of this architecture revision, B-Attend does not claim that Google Play Integrity, Apple App Attest/DeviceCheck, or a face/liveness vendor is connected. A real adapter and its production credentials must be added and tested before any tenant can require those capabilities.

## Privacy and retention

Biometric verification should use provider-issued verification artifacts or short-lived server-side references whenever possible. Raw face images/video must not be written into `Punch.deviceInfo`, `AttendanceTrustAssessment.evidenceJson`, audit logs, or application logs. Tenant biometric-retention policy is represented by `biometricRetentionHours`; provider-specific retention/deletion jobs must enforce it when an adapter that stores temporary media is introduced.

## Failure policy

Provider misconfiguration or missing required capability is a service/configuration failure, not an attendance rejection. The API responds with an explicit 5xx/4xx error and does not create a punch. A verified adverse signal, by contrast, flows through the Trust Engine and may become review or rejection according to the tenant policy.

## Release gate

Before enabling a real verification provider in production, the release must cover provider signature/token verification, nonce binding, replay, wrong tenant/user/employee, expiry, invalid score ranges, upstream timeout/failure, no raw-token persistence, migration rollback planning and mobile compatibility. Production DB migration and provider activation are separate controlled release actions.
