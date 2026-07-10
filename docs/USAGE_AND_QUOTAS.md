# Usage and quotas

`UsageService.reserveUsage` requires an idempotency key and optionally a limit. Reservations become `committed`, `released`, or `expired`. AI task creation reserves inside the task/outbox transaction. Completion commits actual usage; failure and cancellation release it.
