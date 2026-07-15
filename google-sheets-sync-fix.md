# Google Sheets Sync Fix

## Goal
Resolve synchronization failures between the internal system and Google Sheets by enabling proper CORS response verification and resetting table synchronization statuses.

## Tasks
- [x] Task 1: Update `googleSheetsService.ts` to use `text/plain` content type, remove `no-cors`, and parse response → Verify: `npm run lint` passes.
- [x] Task 2: Update `syncScheduler.ts` to use `text/plain` content type, remove `no-cors`, and parse response → Verify: `npm run lint` passes.
- [x] Task 3: Update `driveSync.ts` to use `text/plain` content type, remove `no-cors`, and parse response → Verify: `npm run lint` passes.
- [x] Task 4: Execute SQL in Supabase to set `sync_status = 'pending'` and `sync_error = null` on all records in `personnel`, `personnel_vacations`, `b1_courses`, `fleet`, and `training_schedule` → Verify: SQL executes successfully.
- [x] Task 5: Run verification tests and build validation → Verify: `npm run build` succeeds and linting checks out.

## Done When
- [x] CORS is bypassed using simple POST requests with proper response verification.
- [x] All previously unsynced data records in Supabase are scheduled for synchronization.
- [x] Build and TypeScript compilation pass cleanly.
