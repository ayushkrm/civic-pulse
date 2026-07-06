"""Task 4: Google ADK agent + Gemini batch enrichment.

Two ways to use this file:

1. Interactive agent (ADK):   adk run .        (or `adk web`)
   Exposes three tools to a Gemini-powered agent:
     - classify_complaint(text) -> {category, urgency}
     - summarize_cluster(texts) -> summary string
     - sentiment(text)          -> "positive" | "negative" | "neutral"

2. Batch pipeline:            python agent.py [--limit N]
   Reads civic_pulse.complaints_raw from BigQuery, enriches every row with
   Gemini (category, urgency 1-5, sentiment) in chunks of 25 per API call,
   writes civic_pulse.complaints_enriched, and summarizes the top clusters
   into civic_pulse.cluster_summaries.

Fails loudly on missing GOOGLE_API_KEY or GCP credentials. No mocking.
"""

import argparse
import json
import re as _re
import subprocess
import sys
import time

from google import genai
from google.genai import types

import config

CATEGORIES = [
    "pothole", "garbage", "streetlight", "water_supply",
    "drainage", "traffic", "stray_animals", "noise", "other",
]

_client = None


def gemini():
    global _client
    if _client is None:
        if config.USE_VERTEX_AI:
            # Use Vertex AI backend — requires ADC + billing-enabled GCP project.
            # No API key needed; quota comes from the billing account.
            _client = genai.Client(
                vertexai=True,
                project=config.get_project_id(),
                location=config.VERTEX_LOCATION,
            )
        else:
            _client = genai.Client(api_key=config.get_gemini_api_key())
    return _client


def _parse_retry_delay(err) -> float:
    """Extract retryDelay seconds from a 429 error, defaulting to 60s."""
    try:
        # err may be a google.api_core.exceptions.ResourceExhausted with .message
        msg = str(err)
        # look for 'retryDelay': '37s' or similar
        m = _re.search(r"'retryDelay':\s*'(\d+(?:\.\d+)?)s'", msg)
        if m:
            return float(m.group(1)) + 2  # small buffer
    except Exception:
        pass
    return 62.0  # safe default: just over 1 minute


def _generate_json(prompt: str, schema: dict):
    """Call Gemini with enforced JSON output; retry transient failures.

    Handles 429 RESOURCE_EXHAUSTED by sleeping for the server-specified
    retryDelay before retrying, so the batch pipeline self-throttles on
    free-tier quotas instead of failing immediately.
    """
    last_err = None
    for attempt in range(6):
        try:
            resp = gemini().models.generate_content(
                model=config.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.1,
                ),
            )
            return json.loads(resp.text)
        except Exception as e:  # noqa: BLE001 - retry then fail loudly
            last_err = e
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                delay = _parse_retry_delay(e)
                print(f"\n  [rate-limit] quota hit, sleeping {delay:.0f}s before retry {attempt+1}/6 ...",
                      flush=True)
                time.sleep(delay)
            else:
                time.sleep(2 * (attempt + 1))
    sys.exit(f"FATAL: Gemini call failed after 6 attempts: {last_err}")


# ---------------------------------------------------------------- ADK tools

def classify_complaint(text: str) -> dict:
    """Classify a civic complaint into a category and urgency score.

    Args:
        text: The raw complaint text from a citizen.

    Returns:
        dict with 'category' (one of the known civic categories) and
        'urgency' (int 1-5, 5 = immediate public-safety risk).
    """
    return _generate_json(
        f"Classify this civic complaint.\nCategories: {CATEGORIES}\n"
        "Urgency: 1 (cosmetic) to 5 (immediate danger to life/safety).\n"
        f"Complaint: {text!r}",
        {
            "type": "object",
            "properties": {
                "category": {"type": "string", "enum": CATEGORIES},
                "urgency": {"type": "integer", "minimum": 1, "maximum": 5},
            },
            "required": ["category", "urgency"],
        },
    )


def summarize_cluster(texts: list[str]) -> str:
    """Summarize a cluster of related civic complaints into one sentence.

    Args:
        texts: List of complaint texts belonging to one cluster (same
            area/category).

    Returns:
        A one-to-two sentence plain-English summary of the shared problem.
    """
    joined = "\n- ".join(texts[:50])
    out = _generate_json(
        "Summarize the shared civic problem in these complaints in 1-2 "
        f"sentences for a city official:\n- {joined}",
        {"type": "object", "properties": {"summary": {"type": "string"}},
         "required": ["summary"]},
    )
    return out["summary"]


def sentiment(text: str) -> str:
    """Determine the sentiment of a civic complaint.

    Args:
        text: The raw complaint text.

    Returns:
        One of 'positive', 'negative', 'neutral'.
    """
    out = _generate_json(
        f"Sentiment of this civic complaint (positive/negative/neutral): {text!r}",
        {"type": "object",
         "properties": {"sentiment": {"type": "string",
                                      "enum": ["positive", "negative", "neutral"]}},
         "required": ["sentiment"]},
    )
    return out["sentiment"]


# ADK agent definition (used by `adk run` / `adk web`)
try:
    from google.adk.agents import Agent

    root_agent = Agent(
        name="civic_pulse_agent",
        model=config.GEMINI_MODEL,
        description="Analyzes citizen civic complaints.",
        instruction=(
            "You are Civic Pulse, an assistant for city officials. Use your "
            "tools to classify complaints, judge urgency, gauge sentiment, "
            "and summarize clusters of related complaints."
        ),
        tools=[classify_complaint, summarize_cluster, sentiment],
    )
except ImportError:
    root_agent = None  # ADK not installed; batch mode still works


# ------------------------------------------------------------ batch pipeline

CHUNK = 25

BATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "urgency": {"type": "integer", "minimum": 1, "maximum": 5},
                    "sentiment": {"type": "string",
                                  "enum": ["positive", "negative", "neutral"]},
                },
                "required": ["id", "category", "urgency", "sentiment"],
            },
        }
    },
    "required": ["results"],
}


def enrich_chunk(rows: list[dict]) -> list[dict]:
    """One Gemini call enriches up to CHUNK complaints (cheap + fast)."""
    listing = "\n".join(f'{r["complaint_id"]}: {r["text"]}' for r in rows)
    out = _generate_json(
        "For EACH complaint below return id, category, urgency (1=cosmetic, "
        f"5=immediate danger), sentiment.\nCategories: {CATEGORIES}\n\n{listing}",
        BATCH_SCHEMA,
    )
    return out["results"]


def run_batch(limit: int | None):
    import pandas as pd
    from google.cloud import bigquery

    bq = config.bq_client()
    project = config.get_project_id()
    raw = f"{project}.{config.DATASET}.{config.RAW_TABLE}"
    enriched_id = f"{project}.{config.DATASET}.{config.ENRICHED_TABLE}"

    sql = f"SELECT * FROM `{raw}`"
    if limit:
        sql += f" LIMIT {limit}"
    df = bq.query(sql).to_dataframe()
    if df.empty:
        sys.exit(f"FATAL: `{raw}` is empty. Run setup_gcp.sh first.")
    print(f"Loaded {len(df)} complaints from {raw}")

    rows = df.to_dict("records")
    by_id = {}
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        for r in enrich_chunk(chunk):
            by_id[r["id"]] = r
        done = min(i + CHUNK, len(rows))
        print(f"  enriched {done}/{len(rows)}", end="\r", flush=True)
    print()

    df["category_ai"] = df["complaint_id"].map(lambda c: by_id.get(c, {}).get("category", "other"))
    df["urgency"] = df["complaint_id"].map(lambda c: by_id.get(c, {}).get("urgency", 3)).astype(int)
    df["sentiment"] = df["complaint_id"].map(lambda c: by_id.get(c, {}).get("sentiment", "neutral"))

    job = bq.load_table_from_dataframe(
        df, enriched_id,
        job_config=bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE"),
    )
    job.result()
    print(f"Wrote {len(df)} rows to {enriched_id}")

    # Summarize the 5 biggest (area, category) clusters
    top = (
        df.groupby(["area_name", "category_ai"])
        .size().sort_values(ascending=False).head(5).index
    )
    summaries = []
    for area, cat in top:
        texts = df[(df.area_name == area) & (df.category_ai == cat)]["text"].tolist()
        summaries.append({
            "area_name": area,
            "category": cat,
            "n_complaints": len(texts),
            "summary": summarize_cluster(texts),
        })
        print(f"  summarized {area}/{cat}")
    sdf = pd.DataFrame(summaries)
    job = bq.load_table_from_dataframe(
        sdf, f"{project}.{config.DATASET}.cluster_summaries",
        job_config=bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE"),
    )
    job.result()
    print(f"Wrote {len(sdf)} cluster summaries")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None,
                    help="Process only N rows (fast demo, e.g. --limit 500)")
    run_batch(ap.parse_args().limit)
