#!/bin/sh
set -eu

SERVER="${NATS_URL:-nats://nats:4222}"
STREAM="${NATS_STREAM_NAME:-FLOWFORGE}"

SUBJECTS="workspace.ai.task.>,workspace.source.>,workspace.research.>,workspace.canvas.>,workspace.concept.>,workspace.asset.>,workspace.export.>,worker.>,ai.tasks.>,workflow.events.*,session.events.*,system.health.*,ai.context.*,document.>,dead.flowforge.>,dead.ppp.>"

add_stream() {
  nats --server="$SERVER" stream add "$STREAM" \
    --subjects "$SUBJECTS" \
    --storage file \
    --retention limits \
    --max-msgs 100000 \
    --max-age 24h \
    --max-msg-size 4MB \
    --discard old \
    --replicas 1 \
    --defaults
}

update_stream() {
  nats --server="$SERVER" stream update "$STREAM" \
    --subjects "$SUBJECTS" \
    --max-msgs 100000 \
    --max-age 24h \
    --max-msg-size 4MB \
    --discard old \
    --replicas 1 \
    --force
}

# Broad wildcard subjects intentionally cover their single-level variants;
# NATS rejects overlapping subjects inside one stream.
if ! nats --server="$SERVER" stream info "$STREAM" >/dev/null 2>&1; then
  add_stream
else
  update_stream
fi

echo "$STREAM stream ready"
