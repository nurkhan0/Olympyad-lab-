# Backend

## Test Case ZIP Upload

Admin endpoint: `POST /api/v1/admin/problems/<slug>/tests/upload/`

Upload a `.zip` archive (max 10 MB) with numbered input/output pairs. Files may appear in any order inside the archive.

| File pattern | Type | Visible to users |
|--------------|------|------------------|
| `1.in` + `1.out` | Regular test | No (`is_sample=False`) |
| `2.in` + `2.out` | Regular test | No |
| `sample_1.in` + `sample_1.out` | Sample test | Yes (`is_sample=True`) |

Rules:

- Each pair shares the same stem before the extension (e.g. `1.in` ↔ `1.out`).
- Stems prefixed with `sample_` are stored as sample tests.
- Incomplete pairs (only `.in` or only `.out`) are skipped and listed in the `errors` field of the response.
- `order` is assigned sequentially (0, 1, 2, …) in the order pairs are processed.

Example archive contents:

```
1.in
1.out
2.in
2.out
sample_1.in
sample_1.out
```

Successful response:

```json
{
  "created": 3,
  "samples": 1,
  "errors": []
}
```
