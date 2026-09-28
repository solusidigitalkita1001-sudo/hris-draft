# API response contract

One envelope, one error-code catalogue. Frontend and mobile both read these, so
`backend/src/shared/core/api-contract.test.ts` pins them: a controller that
hand-builds a response, or a renamed code, fails a test instead of reaching a
client.

## Success

Every success response is produced by `Result` (`backend/src/shared/core/Result.ts`):

```json
{ "success": true, "message": "Success", "data": { } }
```

- `message` is always present and non-empty. Treat it as operator-facing text,
  not as something to branch on.
- `data` is always present; it is `null` for delete/no-content responses.
- List endpoints that page add `meta`:

```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "meta": { "page": 2, "limit": 10, "total": 25, "totalPages": 3, "hasNextPage": true, "hasPreviousPage": true }
}
```

`totalPages` is `ceil(total / limit)` and is `0` for an empty result, so
`hasNextPage`/`hasPreviousPage` are the safe way to page.

There is no `code` field on a success response. An earlier company-settings
variant emitted `code: "OK"`; no client read it and it is gone.

## Errors

Errors are thrown as `AppError` subclasses and serialised by the global error
handler. Controllers never write an error body by hand — doing so previously
produced 400/403 responses with no `code` at all, which left clients nothing to
branch on.

```json
{ "success": false, "code": "NOT_FOUND", "message": "Resource not found" }
```

`errors` appears only on validation failures:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "required" }]
}
```

| Status | `code` | Exception | Meaning for a client |
|---|---|---|---|
| 400 | `BAD_REQUEST` | `BadRequestError` | Malformed or contradictory input; fix and retry. |
| 401 | `AUTHENTICATION_FAILED` | `AuthError` | Credentials rejected. Re-authenticate. |
| 401 | `TOKEN_EXPIRED` | `TokenExpiredError` | Refresh the access token, then retry. |
| 403 | `FORBIDDEN` | `ForbiddenError` | Authenticated but not permitted, including out-of-scope company or employee. Do not retry. |
| 404 | `NOT_FOUND` | `NotFoundError` | Missing, or outside the caller's tenant/data scope — the two are deliberately indistinguishable. |
| 409 | `CONFLICT` | `ConflictError` | State collision (duplicate, already approved, overlapping dates). |
| 422 | `VALIDATION_ERROR` | `ValidationError` | Schema validation failed; `errors` names the fields. |
| 429 | `TOO_MANY_REQUESTS` | `TooManyRequestsError` | Rate limited or locked out; back off. |
| 500 | `DATABASE_ERROR` | `DatabaseError` | Server fault, not caller error. The only non-operational code. |
| 503 | `SERVICE_UNAVAILABLE` | `ServiceUnavailableError` | Dependency down; retry later. |

Two codes come from the app shell rather than an exception class: an unmatched
route answers `404` with `NOT_FOUND`, and `500 INTERNAL_ERROR` is the fallback
for an unexpected throw.

## Binary responses

CSV export and every private-file download answer with the file itself, not the
envelope, and carry `Content-Disposition` plus `X-Content-Type-Options: nosniff`.
Failures on those routes still use the error envelope above.

## Machine-readable description

`GET /api/v1/meta/openapi.json` returns an OpenAPI 3.1 document generated from
the live Express router at request time, alongside the existing
`GET /api/v1/meta/endpoints` inventory. Both are admin-gated (`rbac:read`): the
surface map is not public.

Because it is derived from the router rather than maintained by hand, it cannot
drift from the server. Each operation carries:

- the real path and method, with `:param` rewritten as `{param}`;
- the request body schema converted from the zod schema the route validates
  with, plus `x-query-schema` / `x-path-schema` for validated query and path
  objects;
- `x-required-permissions`, read from the route's own `authorize()` guard;
- `security: bearerAuth` whenever the route sits behind authentication;
- the envelope responses from this document (success, 401, 403, 404, 422).

Response payload shapes are described only as the shared envelope. Payloads are
assembled in services and Prisma models, which have no single validated
boundary to read a schema from; per-endpoint response schemas are worth adding
only where a client needs more than the envelope.

To fetch it:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://<host>/api/v1/meta/openapi.json > openapi.json
```
