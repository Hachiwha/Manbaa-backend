#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
for bucket in \
  "${MINIO_BUCKET_DOCUMENTS:-documents}" \
  "${MINIO_BUCKET_EXPORTS:-exports}" \
  "${MINIO_BUCKET_SOURCES:-workspace-sources}" \
  "${MINIO_BUCKET_PREVIEWS:-workspace-previews}" \
  "${MINIO_BUCKET_ASSETS:-workspace-assets}" \
  "${MINIO_BUCKET_WORKSPACE_EXPORTS:-workspace-exports}" \
  "${MINIO_BUCKET_SNAPSHOTS:-workspace-snapshots}" \
  "${MINIO_BUCKET_TEMP:-workspace-temp}"
do
  mc mb --ignore-existing "local/$bucket"
  mc anonymous set none "local/$bucket"
done

echo "MinIO buckets ready"
