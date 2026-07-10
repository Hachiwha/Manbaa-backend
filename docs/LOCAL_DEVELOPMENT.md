# Local development

Copy `.env.example` to `.env`, replace every `replace-me` value, then run `docker compose up app-db redis nats minio`. Ollama is enabled with `--profile ai`. `DEV_BYPASS_AUTH` defaults to `false`.

Run `pnpm migration:run`, `pnpm start:dev`, and verify `/api/health/live` and `/api/health/ready`. Docker/Testcontainers require access to `/var/run/docker.sock`.
