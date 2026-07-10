# NATS subjects

`contracts/nats-subjects.json` is canonical and has a parity test against `src/core/messaging/subjects.ts`. New messages use `DomainEvent`. Transactional mutations create outbox rows; publishing uses the outbox ID as JetStream message ID and records publication only after acknowledgement.

AI lifecycle subjects are `workspace.ai.task.requested|started|progress|completed|failed` and `workspace.ai.task.cancel.requested`. Legacy mappings remain temporary adapters.
