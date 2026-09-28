# File consumer audit — checklist #3

Every upload and download path in the backend, checked by reading the routes and
their serving code rather than by sampling. The earlier passes covered employee
documents, travel receipts, and performance planning evidence; this pass covers
the remaining consumers and the failure paths.

## Consumers and their guards

| Consumer | Upload route | Storage | Serving path |
|---|---|---|---|
| Employee document | `POST /documents` | disk, random UUID name | `GET /documents/:id/file`, `/download`, `/signed-url` — company + owner/access-grant checked before storage is touched |
| Travel receipt | `POST /travel-expenses/claims` | disk, random UUID name | `GET /private-files/receipts/:id` — claim must be the caller's, one they approve, or in-company for HR |
| Leave attachment | `POST /leave` | disk, random UUID name | `GET /private-files/leave-attachments/:id` — same ownership/administrator rule |
| Permission attachment | `POST /permission-requests` | disk, random UUID name | `GET /private-files/permission-attachments/:id` — same rule |
| Performance planning evidence | `POST /performance/planning-targets/:id/evidences` | disk, random UUID name | `GET /private-files/performance-evidence/:id` — assignment employee, reviewer, or approver only |
| Performance result attachment | `POST /performance/results/:id/attachments` | disk, random UUID name | becomes a managed Document, so it inherits the document module's access checks |
| Performance dispute attachment | `POST /performance/result-disputes/:id/attachments` | disk, random UUID name | same managed-Document path |
| Employee face profile | `POST /employees/:id/face-profile` | memory only, never written to disk | not served; only the derived descriptor is stored |
| Employee CSV import | `POST /employees/import` | memory only | not served |

`/uploads` itself is not static-served: `app.ts` answers every request under it
with a rejection, so a guessed filename is unreachable even though names are
random. `resolvePrivatePath` resolves each download inside its own directory, so
a stored path containing `..` cannot escape.

## Findings

| ID | Site | Issue | Fix |
|---|---|---|---|
| F1 | `performance.routes.ts` result and dispute attachment uploads | The only two uploads that never ran `validateFileMagicBytes`. Their multer `fileFilter` trusts the client `Content-Type`, so `payload.exe` renamed `.pdf` with a spoofed type was stored and then handed to other users through the managed-Document download. | Both routes now validate magic bytes against the document allowlist. |
| F2 | `FileValidation.ts` signature detector | The document module advertises Office types, but the detector recognised only JPEG/PNG/GIF/PDF, so every `.docx`/`.xlsx`/`.doc`/`.xls` upload was rejected as "tipe file tidak dikenal" — the allowlist promised what the validator refused. | The detector now knows the ZIP (OOXML) and OLE2 containers. Because one container carries several types, a signature maps to candidate types and the claimed type must be one the route allows; the extension must match that type. A plain `.zip` is still rejected where only `.docx` is allowed. |
| F3 | leave, permission-request, travel-expense, performance uploads | Multer writes to disk before the route runs, so any later rejection — validation, authorization, or a domain rule such as an insufficient leave balance — left an unreferenced file behind. Only document-management cleaned up after itself. | `discardUploadOnFailure()` removes the stored file whenever the request ends in an error status, mounted on every disk-storage upload. |

## Verification

- `npx tsc --noEmit` clean.
- 118 suites / 1082 tests pass, including new cases for the container formats
  (docx accepted through a zip signature, legacy xls through OLE2, a zip
  claiming a disallowed type rejected, a mismatched extension rejected, a
  fake `PK` header rejected) and for orphan cleanup on both an error and a
  success status.
- Unchanged and still covered: anonymous access, cross-company access, guessed
  filename, path traversal, and MIME spoofing on the previously audited
  consumers.

## Not covered here

Malware scanning and object storage with short-lived signed URLs remain open
product/infrastructure decisions; the checklist lists them as "consider", and
neither is implementable inside this repository alone.
