# Shared contracts

TypeScript contracts are under `src/core/messaging`, JSON Schema and fixtures under `contracts`, and Pydantic models under `contracts/python`. Run `pnpm test:contracts` after any change. Subject and `eventType` must match; organization, workspace, user and correlation scope must be retained.
