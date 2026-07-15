# B-Attend — Production Readiness Checklist

Pre-launch checklist for deploying B-Attend to production.

---

## 1. Database

- [ ] Switch from SQLite to PostgreSQL (update `DATABASE_URL` in `.env`)
- [ ] Run `npx prisma db push` against production PostgreSQL
- [ ] Run `npx prisma db seed` for initial data
- [ ] Verify all migrations apply cleanly
- [ ] Confirm indexes exist on `companyId` columns (tenant scoping)
- [ ] Set up automated database backups (daily minimum)
- [ ] Test point-in-time recovery

## 2. Authentication & Security

- [ ] Rotate all default passwords (seed accounts)
- [ ] Set strong `JWT_SECRET` (minimum 256-bit)
- [ ] Verify `SESSION_COOKIE_NAME` is unique per environment
- [ ] Enable HTTPS everywhere (redirect HTTP → HTTPS)
- [ ] Set `Secure` flag on cookies in production
- [ ] Verify `SameSite=Lax` on session cookies
- [ ] Enable rate limiting on `/api/auth/login` (prevent brute force)
- [ ] Enable rate limiting on all Server Actions
- [ ] Audit all Server Actions for input validation (Zod schemas)
- [ ] Verify no secrets are committed to git (check `.env` in `.gitignore`)
- [ ] Run `npm audit` / `yarn audit` — resolve all critical vulnerabilities

## 3. Environment Variables

- [ ] `DATABASE_URL` — PostgreSQL connection string
- [ ] `JWT_SECRET` — strong random secret
- [ ] `NEXTAUTH_URL` — production URL (e.g., `https://app.b-attend.app`)
- [ ] `NODE_ENV=production`
- [ ] `SESSION_COOKIE_NAME` — unique per environment
- [ ] Remove all `console.log` statements from production code
- [ ] Remove all hardcoded demo data references

## 4. Build & Deploy

- [ ] `npm run build` completes without errors
- [ ] `npx tsc --noEmit` passes (0 errors)
- [ ] `npx next lint` passes (0 warnings)
- [ ] Post-build script (`scripts/postbuild.js`) runs successfully
- [ ] Static assets are served from CDN (if applicable)
- [ ] Set up CI/CD pipeline (GitHub Actions, Vercel, or similar)
- [ ] Configure domain and SSL certificate
- [ ] Set up monitoring and alerting (uptime, error rates)

## 5. Subscription & Billing

- [ ] Stripe integration configured (if using Stripe)
- [ ] Subscription webhooks are verified and secure
- [ ] Plan limits enforced correctly (maxBranches, maxEmployees)
- [ ] Feature gates enforced correctly per plan tier
- [ ] Trial period works correctly (14 days)
- [ ] Subscription status transitions work (ACTIVE → SUSPENDED → CANCELLED)
- [ ] Billing page renders correctly
- [ ] Invoice generation works (if applicable)

## 6. Email & Notifications

- [ ] SMTP configured for transactional emails
- [ ] Employee invitation emails send correctly
- [ ] Password reset emails work (if implemented)
- [ ] Support ticket notifications work
- [ ] Email templates render correctly in major email clients

## 7. File Storage

- [ ] File uploads work (documents, profiles)
- [ ] File storage is production-ready (S3, Azure Blob, or similar)
- [ ] File size limits enforced
- [ ] File type validation enforced
- [ ] File access is tenant-scoped (no cross-tenant file access)

## 8. Performance

- [ ] Database queries are indexed (check `companyId` indexes)
- [ ] No N+1 query patterns in critical paths
- [ ] Pagination implemented for large lists
- [ ] Excel export handles 1000+ employees without timeout
- [ ] Dashboard loads in < 2 seconds
- [ ] Static pages are cached (ISR where appropriate)
- [ ] Image optimization enabled (Next.js Image component)

## 9. HR Module (HR-1 through HR-6)

- [ ] All HR models exist in production database
- [ ] HR seed data loaded (Job Titles, Leave Types, Training Courses, Assets)
- [ ] HR permissions enforced (COMPANY_OWNER, HR_ADMIN, BRANCH_MANAGER, EMPLOYEE)
- [ ] HR feature gates enforced (hr_core, hr_leave, hr_training, hr_assets, hr_payroll)
- [ ] HR Excel exports work for all 11 routes
- [ ] HR Reports Hub renders with real DB counts
- [ ] Payroll calculation engine produces correct results
- [ ] Payroll lock protection prevents premature locking
- [ ] Employee self-service pages work (my-training, my-assets, my-warnings)
- [ ] Branch Manager sees only branch-scoped data
- [ ] Employee blocked from all HR management pages

## 10. Monitoring & Logging

- [ ] Application logs are captured (stdout or log service)
- [ ] Audit logs are captured for all mutations
- [ ] Error tracking is set up (Sentry, LogRocket, or similar)
- [ ] Performance monitoring is set up (response times, DB query times)
- [ ] Uptime monitoring is set up
- [ ] Alerting configured for critical errors (500s, DB connection failures)

## 11. Backup & Recovery

- [ ] Automated database backups configured (daily minimum)
- [ ] Backup retention policy defined (30 days minimum)
- [ ] Recovery procedure documented and tested
- [ ] File storage backups configured
- [ ] Disaster recovery plan documented

## 12. Compliance

- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] GDPR compliance verified (data export, data deletion)
- [ ] Data retention policies configured
- [ ] Audit trail for all data access (AuditLog model)

## 13. Testing

- [ ] All tests pass (`npm test` or equivalent)
- [ ] Manual testing completed per TESTING.md checklist
- [ ] Access control matrix verified (all 4 roles × all routes)
- [ ] Excel exports verified for all 14 report types
- [ ] Payroll calculation verified with sample data
- [ ] Cross-browser testing completed (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness verified

## 14. Documentation

- [ ] README.md up to date with all features
- [ ] DEMO.md up to date with demo flows
- [ ] TESTING.md up to date with full access matrix
- [ ] API documentation (if exposing external APIs)
- [ ] Deployment guide documented
- [ ] Environment variable reference documented

---

## Known Limitations (Accept for Launch)

- No Egyptian tax calculation (manual accountant review required)
- No social insurance calculation (manual accountant review required)
- No bank transfer integration
- No payslip PDF generation
- No biometric integration
- No WhatsApp/email notifications
- No AI features
- SQLite used for development (switch to PostgreSQL for production)
