"""Preflight: verify every Civic Pulse component is ready before demo/deploy.

Run: python check_ready.py
Exits 0 with "READY" only if all checks pass.
"""

import json
import os
import sys

import config  # noqa: F401 - loads .env into os.environ

OK, BAD = "  [OK]", "  [MISSING]"
problems = []


def check(label: str, ok: bool, hint: str = ""):
    print(f"{OK if ok else BAD} {label}" + ("" if ok else f"  ->  {hint}"))
    if not ok:
        problems.append(label)


print("Local artifacts")
check("complaints.csv", os.path.exists("complaints.csv"), "python generate_data.py")

if os.path.exists("speedup.json"):
    sp = json.load(open("speedup.json"))
    mode = f"{sp['speedup']}x GPU" if sp.get("speedup") else "CPU-only (n/a)"
    check(f"speedup.json ({mode})", True)
else:
    check("speedup.json", False, "python benchmark.py --allow-no-gpu")

print("\nCredentials")
project = os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("GCLOUD_PROJECT")
check(f"GOOGLE_CLOUD_PROJECT ({project or 'not set'})", bool(project),
      "setx GOOGLE_CLOUD_PROJECT civic-pulse-501608, then open a NEW terminal")
check("GOOGLE_API_KEY", bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")),
      "setx GOOGLE_API_KEY <key>, then open a NEW terminal")

bq = None
if project:
    try:
        from google.cloud import bigquery
        bq = bigquery.Client(project=project)
        list(bq.query("SELECT 1").result())
        check("BigQuery auth (ADC)", True)
    except Exception as e:
        bq = None
        check("BigQuery auth (ADC)", False,
              f"gcloud auth application-default login  ({str(e)[:100]})")

print("\nBigQuery data")
if bq:
    for table, hint in [
        ("complaints_raw", "bash setup_gcp.sh " + project),
        ("complaints_enriched", "python agent.py --limit 1000"),
        ("cluster_summaries", "python agent.py --limit 1000"),
        ("area_risk", 'sed "s/PROJECT_ID/%s/g" risk_score.sql | bq query --use_legacy_sql=false' % project),
    ]:
        try:
            n = list(bq.query(
                f"SELECT COUNT(*) AS n FROM `{project}.civic_pulse.{table}`").result())[0].n
            check(f"{table} ({n:,} rows)", n > 0, hint)
        except Exception:
            check(table, False, hint)
else:
    print("  [SKIPPED] no BigQuery access - fix credentials above first")
    problems.append("BigQuery data checks skipped")

print()
if problems:
    sys.exit(f"NOT READY - {len(problems)} issue(s): " + "; ".join(problems))
print("READY - launch with: cd dashboard && npm run dev")
