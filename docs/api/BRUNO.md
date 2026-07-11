# Bruno API Collection

This directory contains a [Bruno](https://www.usebruno.com/) API collection for testing the Manbaa backend.

## Running Tests

### Desktop App
Open Bruno, click **Open Collection**, and select `ppp-backend/bruno/manbaa-api`.

### CLI
```bash
# Run all requests against local backend
npm run bruno:test

# Run against Docker stack
npm run bruno:docker

# Run specific folder
npx bru run bruno/manbaa-api/requests/00-Health --env local

# Output results
npx bru run bruno/manbaa-api --env local --output bruno-report.json
```

## Adding New Requests

1. Create a `.bru` file in the appropriate folder under `requests/`
2. Add `meta` block with `name`, `type: http`, and `seq` (ordering)
3. Add the HTTP method block with `url` and `body`
4. Add `auth: inherit` to use collection auth
5. Add `headers` and `assert` blocks

## Environments

| File | `baseUrl` | Notes |
|---|---|---|
| `environments/local.bru` | `http://localhost:3000/api` | Backend on host port 3000 |
| `environments/docker.bru` | `http://localhost/api` | Behind Caddy on port 80 |
| `environments/remote.example.bru` | `https://api.manbaa.example.com/api` | Template for production |

## Folder Structure

```
bruno/manbaa-api/
├── bruno.json              # Collection config
├── README.md               # This file
├── environments/           # Environment variables
│   ├── local.bru
│   ├── docker.bru
│   └── remote.example.bru
├── fixtures/               # Test fixture files
│   └── brand-guide.md
├── openapi/                # OpenAPI companion spec
│   └── manbaa.openapi.yaml
└── requests/               # API request files
    ├── 00-Health/
    ├── 01-Auth/
    ├── 02-Organizations/
    ├── 03-Workspaces/
    ├── 04-Projects/
    ├── 05-Sessions/
    │   └── Messages/
    ├── 06-Sources/
    ├── 07-Canvas/
    ├── 08-AI-Tasks/
    ├── 09-Suggestions/
    ├── 10-Assets/
    ├── 11-Applications/
    ├── 12-Admin/
    ├── 90-Negative-Tests/
    └── 99-Full-Workflow/
```
