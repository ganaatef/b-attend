# B-Attend Staff Mobile API Contract

The B-Attend Staff app calls only the `/api/mobile/*` namespace. Browser cookies are not accepted for these endpoints. After login, every request must include `Authorization: Bearer <token>`, where the token is a seven-day JWT whose audience is `battend-staff-mobile`.

| Method and route | Purpose | Access control |
|---|---|---|
| `POST /api/mobile/auth/login` | Authenticates an active employee with an assigned employee profile and returns a bearer token. | Email/password, active employee, active tenant subscription. |
| `GET /api/mobile/dashboard` | Returns the employee profile summary, assigned branch, today's schedule, next attendance action, and last ten punches. | Employee bearer token, tenant and employee ownership checks. |
| `POST /api/mobile/clock` | Records a verified `CLOCK_IN` or `CLOCK_OUT` with location and accuracy. | Employee bearer token, subscription, mobile-clock setting, shift policy, sequencing, and geofence checks. |
| `GET /api/mobile/schedule` | Returns up to 31 days of the authenticated employee's schedule. | Employee bearer token and ownership filters. |
| `GET /api/mobile/requests` | Returns current-year leave balances and the employee's own leave requests. | Employee bearer token and ownership filters. |

The attendance mutation validates position server-side against the employee branch and stores mobile operations with source `MOBILE_APP`. Operations outside the allowed geofence become `NEEDS_APPROVAL` when the company setting requires approval. The client sends a UUID idempotency key; the server stores it in the audited device metadata and its state machine rejects duplicate same-day clock sequences.

## Required deployment variables

The web backend requires `SESSION_SECRET` with a production-grade value and an active PostgreSQL connection. The mobile binary receives only `EXPO_PUBLIC_BATTEND_API_URL`, which must be an HTTPS base URL and is not a secret.
