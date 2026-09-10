# B-Attend Mobile Attendance Verification Contract

This contract extends the native employee clock flow without trusting device-side verdicts.

## 1. Request verification challenge

`POST /api/mobile/clock/challenge`

Authentication: employee mobile bearer token.

The server returns the configured provider, supported capabilities, whether the tenant policy currently requires verification, and—when a real provider adapter is active—a one-time challenge.

Example shape when no provider is connected and no capability is required:

```json
{
  "verificationRequired": false,
  "provider": "none",
  "capabilities": [],
  "challenge": null,
  "ttlSeconds": 300
}
```

If the tenant requires verification but the active provider cannot satisfy the policy, the endpoint returns HTTP 503 with `VERIFICATION_PROVIDER_UNAVAILABLE` and `missingCapabilities`. The app must not attempt to fabricate a local verdict.

When a provider is available, `challenge` contains `id`, `value` and `expiresAt`. The value must be passed to the native/provider attestation flow and returned unchanged to B-Attend. It is single-use and expires after five minutes.

## 2. Submit clock punch

`POST /api/mobile/clock`

Existing fields remain:

```json
{
  "type": "CLOCK_IN",
  "latitude": 30.0444,
  "longitude": 31.2357,
  "accuracyMeters": 8,
  "idempotencyKey": "4e7fa4fb-f55f-4f44-9344-07abf501c8d0"
}
```

When verification is required/applicable, add:

```json
{
  "verification": {
    "challengeId": "challenge-row-id",
    "challenge": "one-time-server-challenge",
    "deviceIntegrityToken": "opaque-provider-token",
    "locationIntegrityToken": "opaque-provider-token",
    "biometricToken": "opaque-provider-token"
  }
}
```

Only provider tokens are accepted. Fields such as `deviceTrusted`, `faceMatchScore`, `livenessPassed`, `isMockLocation`, or any equivalent client-calculated verdict are not part of the API contract.

The server validates the challenge and provider proof, normalizes trusted signals, runs the Attendance Trust Engine, consumes the challenge and creates the punch in one atomic database transaction.

## 3. Important response/errors

- `401 UNAUTHORIZED`: mobile session/employee is invalid.
- `400 INVALID_REQUEST`: malformed clock request.
- `400 VERIFICATION_CHALLENGE_INVALID`: challenge does not match its binding.
- `409 VERIFICATION_CHALLENGE_ALREADY_USED`: replay attempt.
- `410 VERIFICATION_CHALLENGE_EXPIRED`: challenge expired.
- `422 VERIFICATION_REQUIRED`: tenant policy requires proof but the request omitted it.
- `422 VERIFICATION_NOT_SUPPORTED`: proof was submitted while no provider is configured.
- `503 VERIFICATION_PROVIDER_UNAVAILABLE`: tenant requires a capability the provider cannot satisfy.
- `503 VERIFICATION_PROVIDER_MISCONFIGURED`: deployment points at an unknown adapter.
- `503 VERIFICATION_PROVIDER_FAILED`: upstream/server verification failed; no punch is created.

A successful punch may return `ACCEPTED`, `NEEDS_APPROVAL`, or `REJECTED` according to the server trust policy. It also returns the normalized trust score/risk/decision. Raw provider tokens are never echoed back.

## 4. Retry semantics

`idempotencyKey` remains the network retry key. A retry of a punch that was already committed returns the existing punch even though its verification challenge has already been consumed. Reusing the same idempotency key for a different punch type is rejected.

The mobile app should request a new verification challenge only for a new attendance operation, not for replaying the same successfully committed request.

## 5. Provider integration rule

A future Android/iOS/biometric adapter must satisfy `src/lib/attendance/verification-provider.ts`. Deployment must keep `ATTENDANCE_VERIFICATION_PROVIDER=none` until such an adapter and its encrypted credentials are installed and release-tested. Tenant administrators cannot enable required device/face/liveness capabilities before that provider advertises them.
