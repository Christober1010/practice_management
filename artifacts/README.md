# Deploy artifacts

Static export zips created by `npm run build` and `npm run build:test`.

| Path | Created by | Upload to |
|------|------------|-----------|
| `artifacts/prod/out.zip` | `npm run build` | Production static host |
| `artifacts/test/out-test.zip` | `npm run build:test` | Test static host |

When a new zip is built, the previous one is renamed to `out-old-YYYYMMDD-HHMMSS.zip` or `out-test-old-…` in the same folder. The script keeps at most **5** archived copies per environment (`MAX_OLD_ARTIFACTS`).

This directory is gitignored — artifacts stay on your machine only.
