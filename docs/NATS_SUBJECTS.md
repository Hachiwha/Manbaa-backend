# NATS subjects

`contracts/nats-subjects.json` is canonical and has a parity test against `src/core/messaging/subjects.ts`. New messages use `DomainEvent`. Transactional mutations create outbox rows; publishing uses the outbox ID as JetStream message ID and records publication only after acknowledgement.

AI lifecycle subjects are `workspace.ai.task.requested|started|progress|completed|failed` and `workspace.ai.task.cancel.requested`. Legacy mappings remain temporary adapters.

`infra/nats-stream-bootstrap.sh` bootstraps and updates the `FLOWFORGE` stream with canonical `workspace.*` subjects plus legacy compatibility subjects. The final isolated deployment validation confirmed AI task outbox events publish on the canonical `workspace.ai.task.*` subjects.
