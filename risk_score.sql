-- Task 5: area risk view.
-- risk_score = freq * avg_urgency * days_since_last_complaint
-- Apply with:
--   sed "s/PROJECT_ID/$GOOGLE_CLOUD_PROJECT/g" risk_score.sql | bq query --use_legacy_sql=false
--
-- Note: days_since_last_complaint is floored at 1 so an area with a complaint
-- filed today doesn't zero out its entire risk score.

CREATE OR REPLACE VIEW `PROJECT_ID.civic_pulse.area_risk` AS
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
  FROM `PROJECT_ID.civic_pulse.complaints_enriched`
  GROUP BY area_name
)
SELECT
  area_name,
  lat,
  lon,
  freq,
  avg_urgency,
  days_since_last_complaint,
  ROUND(freq * avg_urgency * days_since_last_complaint, 2) AS risk_score
FROM per_area;
