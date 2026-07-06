"""Shared config for Civic Pulse. Fails loudly on missing credentials/config."""

import os
import sys


def _load_dotenv():
    """Load KEY=VALUE pairs from .env (next to this file) into os.environ.

    Real environment variables take precedence over .env values.
    """
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.split("#", 1)[0].strip().strip("'\"")
            if key and value:
                os.environ.setdefault(key, value)


_load_dotenv()

DATASET = "civic_pulse"
BUCKET = "civic-pulse-data"
RAW_TABLE = "complaints_raw"
ENRICHED_TABLE = "complaints_enriched"
RISK_VIEW = "area_risk"
GEMINI_MODEL = "gemini-2.0-flash"
USE_VERTEX_AI = True        # set True when billing is enabled; uses ADC instead of API key
VERTEX_LOCATION = "us-central1"


def get_project_id() -> str:
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
    if not project:
        sys.exit(
            "FATAL: GCP project ID not set.\n"
            "Set it with:  export GOOGLE_CLOUD_PROJECT=<your-project-id>\n"
            "(Also run:  gcloud auth application-default login)"
        )
    return project


def get_gemini_api_key() -> str:
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit(
            "FATAL: Gemini API key not set.\n"
            "Set it with:  export GOOGLE_API_KEY=<your-gemini-api-key>\n"
            "Get one at https://aistudio.google.com/apikey"
        )
    return key


def bq_client():
    """Return a BigQuery client, failing loudly if ADC are missing."""
    from google.auth.exceptions import DefaultCredentialsError
    from google.cloud import bigquery

    try:
        return bigquery.Client(project=get_project_id())
    except DefaultCredentialsError as e:
        sys.exit(
            f"FATAL: no Google Cloud credentials found ({e}).\n"
            "Run:  gcloud auth application-default login"
        )
