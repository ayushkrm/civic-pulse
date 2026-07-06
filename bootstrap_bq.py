"""Bootstrap BigQuery tables so Streamlit can run before Gemini enrichment finishes.

Creates:
  civic_pulse.complaints_enriched  (seeded from complaints_raw, urgency=3, sentiment='neutral')
  civic_pulse.area_risk            (view from risk_score.sql)

Run: python bootstrap_bq.py
"""

import os, sys
import config
from google.cloud import bigquery

PROJECT = config.get_project_id()
DS = config.DATASET

def main():
    bq = config.bq_client()

    # 1. Seed complaints_enriched from complaints_raw with placeholder values
    print("Seeding complaints_enriched …")
    seed_sql = f"""
    CREATE OR REPLACE TABLE `{PROJECT}.{DS}.{config.ENRICHED_TABLE}` AS
    SELECT
      complaint_id,
      text,
      category AS category_ai,
      lat, lon, area_name, timestamp, source,
      3         AS urgency,
      'neutral' AS sentiment,
      category
    FROM `{PROJECT}.{DS}.{config.RAW_TABLE}`
    """
    bq.query(seed_sql).result()
    cnt = bq.query(
        f"SELECT COUNT(*) AS n FROM `{PROJECT}.{DS}.{config.ENRICHED_TABLE}`"
    ).to_dataframe().iloc[0]["n"]
    print(f"  -> {int(cnt):,} rows in complaints_enriched")

    # 2. Create the area_risk view (from risk_score.sql)
    print("Creating area_risk view …")
    view_sql = f"""
    CREATE OR REPLACE VIEW `{PROJECT}.{DS}.area_risk` AS
    WITH per_area AS (
      SELECT
        area_name,
        AVG(lat)  AS lat,
        AVG(lon)  AS lon,
        COUNT(*)  AS freq,
        ROUND(AVG(urgency), 2) AS avg_urgency,
        GREATEST(
          TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), MAX(timestamp), DAY), 1
        ) AS days_since_last_complaint
      FROM `{PROJECT}.{DS}.{config.ENRICHED_TABLE}`
      GROUP BY area_name
    )
    SELECT
      area_name, lat, lon, freq, avg_urgency,
      days_since_last_complaint,
      ROUND(freq * avg_urgency * days_since_last_complaint, 2) AS risk_score
    FROM per_area
    """
    bq.query(view_sql).result()
    risk_rows = bq.query(
        f"SELECT COUNT(*) AS n FROM `{PROJECT}.{DS}.area_risk`"
    ).to_dataframe().iloc[0]["n"]
    print(f"  -> area_risk view ready ({int(risk_rows)} area rows)")

    print("\nOK: Bootstrap complete -- you can now run: streamlit run app.py")

if __name__ == "__main__":
    main()
