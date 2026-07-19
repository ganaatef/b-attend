# Plan: Replace Hardcoded English Strings with t() Calls

## Context
All three files contain hardcoded English strings that need to be internationalized using `next-intl`. The translation keys already exist in `messages/en.json` under `hrDocuments` and `hrContracts` namespaces. No new keys need to be added to en.json.

## File 1: `src/app/(tenant)/hr/documents/[id]/page.tsx`
**Type:** Server component (async function) → use `getTranslations` from `next-intl/server`

### Changes:
1. Add import: `import { getTranslations } from "next-intl/server";`
2. Add at top of function: `const t = await getTranslations("hrDocuments");`
3. Replace strings:
   - `"← Documents"` → `{t("backToDocuments")}`
   - `"This document expires on {date} — renew soon."` → `{t("expiresSoonWarning", { date: ... })}`
   - `"Document Number"` → `{t("documentNumber")}`
   - `"Branch"` → `{t("branchLabel")}`
   - `"Issue Date"` → `{t("issueDate")}`
   - `"Expiry Date"` → `{t("expiryDate")}`
   - `"Expiring soon"` → `{t("expiringSoonBadge")}`
   - `"Notes"` (CardTitle) → `{t("notesCard")}`
   - `"Actions"` (CardTitle) → `{t("actionsCard")}`
   - `"Approve (Valid)"` → `{t("approveValid")}`
   - `"Mark Expired"` → `{t("markExpired")}`
   - `"Mark Missing"` → `{t("markMissing")}`

## File 2: `src/app/(tenant)/hr/documents/new/page.tsx`
**Type:** Client component ("use client") → use `useTranslations` from `next-intl`

### Changes:
1. Add import: `import { useTranslations } from "next-intl";`
2. Add at top of component: `const t = useTranslations("hrDocuments");` and `const tc = useTranslations("common");`
3. Replace strings:
   - `"← Documents"` → `{t("backToDocuments")}`
   - `"Add Document"` (h1) → `{t("addDocument")}`
   - `"Document Details"` → `{t("documentDetails")}`
   - `"Employee ID *"` → `{t("employeeIdLabel")}`
   - `"Employee ID"` (placeholder) → `{t("employeeIdPlaceholder")}`
   - `"Document Type *"` → `{t("documentTypeLabel")}`
   - `"National ID"` → `{t("nationalId")}`
   - `"Passport"` → `{t("passport")}`
   - `"Work Permit"` → `{t("workPermit")}`
   - `"Health Certificate"` → `{t("healthCertificate")}`
   - `"Food Safety Certificate"` → `{t("foodSafety")}`
   - `"Contract"` (select option) → `{t("contract")}`
   - `"Insurance Form"` → `{t("insurance")}`
   - `"Medical Certificate"` → `{t("medical")}`
   - `"Other"` (select option) → `{t("other")}`
   - `"Document Number"` (label) → `{t("docNumberLabel")}`
   - `"Optional"` (placeholder) → `{t("optionalPlaceholder")}`
   - `"Issue Date"` (label) → `{t("issueDate")}`
   - `"Expiry Date"` (label) → `{t("expiryDate")}`
   - `"Notes"` (label) → `{tc("notes")}`
   - `"Optional notes"` → `{t("optionalPlaceholder")}`
   - `"Cancel"` → `{tc("cancel")}`
   - `"Adding..."` → `{t("adding")}`
   - `"Add Document"` (button) → `{t("addDocumentBtn")}`

## File 3: `src/app/(tenant)/hr/contracts/page.tsx`
**Type:** Server component (async function) → use `getTranslations` from `next-intl/server`

### Changes:
1. Add import: `import { getTranslations } from "next-intl/server";`
2. Add at top of function: `const t = await getTranslations("hrContracts");`
3. Replace strings:
   - `"HR Module requires Growth plan or higher"` → `{t("featureGateTitle")}`
   - `"Upgrade to access HR features."` → `{t("upgradeMessage")}`
   - `"Contracts"` (h1) → `{t("contractsTitle")}`
   - `"total"` → `{t("totalLabel")}`
   - `"active"` (stat text) → `{t("activeLabel")}`
   - `"expiring within 30 days"` → `{t("expiringWithin30")}`
   - `"Export Excel"` → `{t("exportExcel")}`
   - `"New Contract"` → `{t("newContractBtn")}`
   - `"Active contracts"` → `{t("activeContracts")}`
   - `"Expiring in 30 days"` → `{t("expiringIn30")}`
   - `"Expired"` (stat) → `{t("expiredLabel")}`
   - `"No contracts"` → `{t("noContracts")}`
   - `"Create your first employee contract"` → `{t("createFirst")}`
   - `"Open"` → `{t("openLabel")}`
   - `"Expiring soon"` → `{t("expiringSoonBadge")}`

## Verification
- Run `npx tsc --noEmit` to verify TypeScript compilation
- Check for any missing import errors
