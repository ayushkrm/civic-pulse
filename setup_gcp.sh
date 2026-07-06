#!/usr/bin/env bash
# Task 2: GCS bucket + BigQuery dataset/table from complaints.csv
# Usage: ./setup_gcp.sh <PROJECT_ID> [LOCATION]
set -euo pipefail

PROJECT="${1:?Usage: ./setup_gcp.sh <PROJECT_ID> [LOCATION]}"
LOCATION="${2:-US}"
BUCKET="civic-pulse-data"
DATASET="civic_pulse"

[ -f complaints.csv ] || { echo "FATAL: complaints.csv not found. Run: python generate_data.py" >&2; exit 1; }

gcloud config set project "$PROJECT"

# Bucket (bucket names are global; suffix with project id if the bare name is taken)
if ! gsutil ls -b "gs://$BUCKET" >/dev/null 2>&1; then
  gsutil mb -p "$PROJECT" -l "$LOCATION" "gs://$BUCKET" || {
    BUCKET="civic-pulse-data-$PROJECT"
    echo "Bucket name taken globally; using gs://$BUCKET"
    gsutil ls -b "gs://$BUCKET" >/dev/null 2>&1 || gsutil mb -p "$PROJECT" -l "$LOCATION" "gs://$BUCKET"
  }
fi

gsutil cp complaints.csv "gs://$BUCKET/complaints.csv"

bq --location="$LOCATION" mk --dataset --force "$PROJECT:$DATASET"

bq load --source_format=CSV --skip_leading_rows=1 --replace \
  "$PROJECT:$DATASET.complaints_raw" \
  "gs://$BUCKET/complaints.csv" \
  complaint_id:STRING,text:STRING,category:STRING,lat:FLOAT64,lon:FLOAT64,area_name:STRING,timestamp:TIMESTAMP,source:STRING

echo "Done. Verify:"
bq query --use_legacy_sql=false "SELECT COUNT(*) AS rows FROM \`$PROJECT.$DATASET.complaints_raw\`"
