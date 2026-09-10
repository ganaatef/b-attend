# B-Attend Biometric Identity & Face Liveness Architecture

Status: design contract for implementation on the biometric integration branch.

## Security objective

Biometric attendance must prove two separate facts: the capture is live, and the live person matches the employee's enrolled biometric identity. A static selfie, employee profile photo, client-calculated score, or raw client boolean is never authoritative.

## Data-minimization rules

- `Employee.photoUrl` is presentation data and is never used as a biometric enrollment source.
- B-Attend does not persist selfie video, liveness audit images, reference-image bytes, or provider tokens in its operational database.
- Enrollment stores only provider-side face/vector identifiers plus lifecycle metadata and consent/audit facts.
- Liveness sessions store provider session identifiers, normalized result metadata, timestamps, and status; raw media remains provider-transient according to the configured provider policy.
- Provider credentials remain deployment secrets.

## Enrollment lifecycle

1. An authorized HR/security administrator requests biometric enrollment for an employee.
2. The employee must have an active linked user identity and explicitly consent to the current biometric notice/version.
3. The server creates a short-lived provider liveness session with purpose `ENROLLMENT`.
4. The native app performs the provider's liveness capture.
5. The server retrieves the liveness result directly from the provider. Client scores are ignored.
6. Enrollment fails if liveness is below the configured threshold.
7. The server checks the live reference face for a high-confidence duplicate against already enrolled identities before indexing it.
8. If safe, the provider indexes a face vector and returns an opaque face identifier. Raw reference bytes are discarded after the provider call.
9. B-Attend atomically activates the enrollment, records provider references and policy/version, and writes an audit event.
10. Re-enrollment revokes/deletes the previous provider face reference before the replacement becomes active, with recovery/error handling that never silently leaves two active employee identities.

## Attendance lifecycle

1. The employee requests the normal B-Attend one-time attendance verification challenge.
2. If policy requires face/liveness, the app requests a liveness session bound to that employee/user/challenge.
3. The native app completes Face Liveness using the provider session id.
4. The mobile clock request submits only the opaque biometric session reference plus any separate device-integrity token.
5. Server-side verification retrieves liveness results, verifies the session binding and one-time state, searches the enrolled biometric identity, and produces normalized `faceMatchScore` and `livenessPassed`.
6. The Attendance Trust Engine combines those signals with device integrity, GPS/geofence, accuracy, anomaly and policy signals.
7. Session/challenge consumption and attendance mutation remain atomic/idempotent.

## AWS Rekognition target adapter

The first biometric adapter target is Amazon Rekognition Face Liveness plus Rekognition face collections. The backend owns `CreateFaceLivenessSession` and `GetFaceLivenessSessionResults`; the native detector owns only the provider capture stream. Enrollment uses the liveness reference image transiently to index/search a face vector. Attendance uses the liveness reference image transiently to search for the expected enrolled employee.

Server-side release configuration must include region, collection strategy/id, thresholds and AWS credentials/role. The mobile application should receive only the minimal region/session data and short-lived permission required to run the provider liveness capture; it must never receive server IAM credentials.

## Required persistence

### BiometricEnrollment

Tenant-scoped employee biometric identity with:
- provider key
- provider face id / external subject id
- status and version
- consent version/time
- enrolled/revoked timestamps
- last verified timestamp
- no raw biometric material

### BiometricVerificationSession

Short-lived tenant-scoped record with:
- employee/user binding
- purpose (`ENROLLMENT` or `ATTENDANCE`)
- provider + provider session id
- optional attendance challenge binding
- status, expiry and one-time consumption
- normalized liveness/face-match metadata only

## Mandatory controls

- Cross-tenant employee/session lookup is impossible at every query boundary.
- Session ids are single-use for attendance and cannot be replayed across employees/users/challenges.
- Enrollment and re-enrollment require explicit permission and audit.
- Revoking/terminating an employee invalidates biometric use.
- Face/liveness policy cannot be enabled unless a real provider advertises both capabilities.
- Similarity/liveness thresholds are server configuration/policy, not client input.
- Duplicate biometric enrollment is detected at a stricter threshold than attendance matching.
- Any upstream ambiguity/failure is fail-closed and never converted to a successful biometric verdict.

## Privacy and governance

Biometric data is sensitive identity data. Production rollout requires a customer-facing biometric notice/consent flow, a retention/deletion procedure, provider data-processing review, access logging, and a documented non-biometric fallback for workers where policy or law requires it. Revocation/deletion must remove provider-side face vectors as well as local references.
