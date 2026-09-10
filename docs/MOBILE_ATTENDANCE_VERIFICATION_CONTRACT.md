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

When a provider is available, `challenge` contains `id`, `value` and `expiresAt`. The value is single-use and expires after five minutes.

## 2. Android: Google Play Integrity standard request

When the challenge endpoint reports:

```json
{
  "provider": "google_play_integrity",
  "capabilities": ["DEVICE_INTEGRITY"]
}
```

the Android employee app must use the Google Play Integrity **standard request** flow.

The request must be content-bound to B-Attend's one-time challenge:

1. UTF-8 encode `challenge.value`.
2. Compute SHA-256.
3. Encode the digest as base64url without padding.
4. Pass that value to Play Integrity as `requestHash`.
5. Submit the opaque integrity token to B-Attend as `deviceIntegrityToken` together with the unchanged B-Attend challenge ID/value.

Equivalent definition:

```text
requestHash = base64url_no_padding(SHA256(UTF8(challenge.value)))
```

Do not decode, interpret or replace Google's verdict on the device. B-Attend's server exchanges its Google service-account assertion for an OAuth access token, calls Google's `decodeIntegrityToken` endpoint, validates the request/package/timestamp binding and then evaluates the signed verdict.

The current production adapter requires at least:

- request package name = configured employee Android package;
- `requestHash` = hash of the exact B-Attend challenge;
- token timestamp within the configured freshness window;
- app verdict `PLAY_RECOGNIZED`;
- app-integrity package = configured package;
- a matching signing-certificate digest when certificate pinning is configured;
- `MEETS_DEVICE_INTEGRITY`;
- `LICENSED` by default;
- optionally `MEETS_STRONG_INTEGRITY` when the stricter deployment flag is enabled.

A correctly decoded negative verdict is not treated as an upstream outage. It produces `deviceTrusted=false` and is passed into the Attendance Trust Engine, which decides `ACCEPTED`, `NEEDS_APPROVAL` or `REJECTED` according to policy.

## 3. Submit clock punch

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

For `google_play_integrity`, send `deviceIntegrityToken`; the other two token fields are currently unused.

Only provider tokens are accepted. Fields such as `deviceTrusted`, `faceMatchScore`, `livenessPassed`, `isMockLocation`, or any equivalent client-calculated verdict are not part of the API contract.

The server validates the challenge and provider proof, normalizes trusted signals, runs the Attendance Trust Engine, consumes the challenge and creates the punch in one atomic database transaction.

## 4. Important response/errors

- `401 UNAUTHORIZED`: mobile session/employee is invalid.
- `400 INVALID_REQUEST`: malformed clock request.
- `400 VERIFICATION_CHALLENGE_INVALID`: challenge does not match its binding.
- `409 VERIFICATION_CHALLENGE_ALREADY_USED`: replay attempt.
- `410 VERIFICATION_CHALLENGE_EXPIRED`: challenge expired.
- `422 VERIFICATION_REQUIRED`: tenant policy requires proof but the request omitted it.
- `422 VERIFICATION_NOT_SUPPORTED`: proof was submitted while no provider is configured.
- `503 VERIFICATION_PROVIDER_UNAVAILABLE`: tenant requires a capability the provider cannot satisfy.
- `503 VERIFICATION_PROVIDER_MISCONFIGURED`: deployment points at an unknown adapter or required provider environment is missing/invalid.
- `503 VERIFICATION_PROVIDER_FAILED`: OAuth/upstream/cryptographic-binding verification failed; no punch is created.

A successful punch may return `ACCEPTED`, `NEEDS_APPROVAL`, or `REJECTED` according to the server trust policy. It also returns the normalized trust score/risk/decision. Raw provider tokens are never echoed back or persisted.

## 5. Retry semantics

`idempotencyKey` remains the network retry key. A retry of a punch that was already committed returns the existing punch even though its verification challenge has already been consumed. Reusing the same idempotency key for a different punch type is rejected.

The mobile app should request a new verification challenge only for a new attendance operation, not for replaying the same successfully committed request.

## 6. Provider integration rule

All Android/iOS/biometric adapters must satisfy `src/lib/attendance/verification-provider.ts`. Deployment must keep `ATTENDANCE_VERIFICATION_PROVIDER=none` until the selected adapter, its encrypted credentials and the corresponding native mobile implementation are release-tested.

`google_play_integrity` is now a real server-side adapter for Android `DEVICE_INTEGRITY` only. It does **not** advertise `FACE_MATCH`, `LIVENESS` or `MOCK_LOCATION`. Tenant administrators therefore remain fail-closed and cannot enable those requirements until separate server-verifiable providers are implemented.
