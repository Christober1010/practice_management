# Reference: API audit

## Report output (`npm run test:test` / `npm run test`)

The Markdown report filters the DB map by tree: **test** reports list only **`backend-test/`** rows; **prod** reports list only **`backend/`** rows.

## prod vs test

Typical deployment layout (adjust to your domain):

- **Prod**: `https://<host>/mahaverse-backend/<script>.php`
- **Test**: `https://<host>/mahaverse-backend-test/<script>.php`

Frontend `NEXT_PUBLIC_BASE_URL` must match the environment you are auditing.

## Interpreting DB map CSV

Columns: `area`, `file`, `host`, `database`, `note`

- **`area`**: `backend` or `backend-test`
- **`note`**: `env` if `getenv`/env-based; `unknown` if no literal found; empty if literals parsed
- If one file shows two hosts (multiple connection blocks), the script may list the **first** match — open the file for full picture

## Automation

- Run maps in CI on every commit to detect accidental prod DB in `backend-test/`.
- Run ping against staging URLs after deploy; fail on `000`, `404`, or mass `500`.
