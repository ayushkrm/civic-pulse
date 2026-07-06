"""Task 6: Civic Pulse dashboard.

Run: streamlit run app.py
Requires: GOOGLE_CLOUD_PROJECT env var + application-default credentials.
All data comes from BigQuery (civic_pulse dataset); nothing is hardcoded.
"""

import json
import os
import sys

import altair as alt
import pandas as pd
import streamlit as st
from google.cloud import bigquery

import config

# Validated palette (dataviz reference instance)
SERIES_BLUE = "#2a78d6"
INK_MUTED = "#898781"
# Sequential blue ramp, steps 250 -> 700 (light -> dark = low -> high risk)
SEQ_RAMP = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5",
            "#2a78d6", "#256abf", "#1c5cab", "#0d366b"]

st.set_page_config(page_title="Civic Pulse", page_icon="🏙️", layout="wide")


@st.cache_resource
def get_client() -> bigquery.Client:
    return config.bq_client()


@st.cache_data(ttl=300, show_spinner="Querying BigQuery ...")
def query(sql: str) -> pd.DataFrame:
    return get_client().query(sql).to_dataframe()


PROJECT = config.get_project_id()
DS = f"{PROJECT}.{config.DATASET}"

st.title("🏙️ Civic Pulse")
st.caption("GenAI-enriched civic complaint triage — GCS → BigQuery → ADK/Gemini → BigQuery → Streamlit")

# ---------------------------------------------------------------- top metrics
col1, col2, col3, col4 = st.columns(4)

try:
    totals = query(f"""
        SELECT COUNT(*) AS n,
               ROUND(AVG(urgency), 2) AS avg_urgency,
               COUNTIF(sentiment = 'negative') / COUNT(*) AS pct_negative
        FROM `{DS}.{config.ENRICHED_TABLE}`
    """).iloc[0]
except Exception as e:
    st.error(
        f"BigQuery query failed: {e}\n\n"
        "Make sure you ran setup_gcp.sh and `python agent.py`, and that "
        "GOOGLE_CLOUD_PROJECT and application-default credentials are set."
    )
    st.stop()

col1.metric("Complaints analyzed", f"{int(totals.n):,}")
col2.metric("Avg urgency (Gemini)", f"{totals.avg_urgency} / 5")
col3.metric("Negative sentiment", f"{totals.pct_negative:.0%}")

# Speedup card from benchmark.py output
speedup_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "speedup.json")
if os.path.exists(speedup_path):
    with open(speedup_path) as f:
        sp = json.load(f)
    if sp.get("speedup"):
        col4.metric("cudf.pandas GPU speedup", f"{sp['speedup']}×",
                    f"CPU {sp['cpu_seconds']}s → GPU {sp['gpu_seconds']}s")
    else:
        col4.metric("cudf.pandas GPU speedup", "n/a",
                    f"CPU-only run: {sp['cpu_seconds']}s", delta_color="off")
else:
    col4.metric("cudf.pandas GPU speedup", "—", "run benchmark.py", delta_color="off")

st.divider()

# ------------------------------------------------- risk table + map (Task 5/6)
risk = query(f"SELECT * FROM `{DS}.{config.RISK_VIEW}` ORDER BY risk_score DESC")

left, right = st.columns([1, 1])

with left:
    st.subheader("Area risk ranking")
    st.dataframe(
        risk[["area_name", "freq", "avg_urgency", "days_since_last_complaint", "risk_score"]],
        column_config={
            "area_name": "Area",
            "freq": "Complaints",
            "avg_urgency": "Avg urgency",
            "days_since_last_complaint": "Days since last",
            "risk_score": st.column_config.ProgressColumn(
                "Risk score", format="%.0f",
                min_value=0.0, max_value=float(risk.risk_score.max()),
            ),
        },
        hide_index=True,
        use_container_width=True,
    )

with right:
    st.subheader("Risk map")
    m = risk.copy()
    # sequential encoding: bin risk_score into the blue ramp (light = low, dark = high)
    m["color"] = pd.cut(
        m["risk_score"], bins=len(SEQ_RAMP), labels=SEQ_RAMP, include_lowest=True
    ).astype(str)
    m["size"] = 150 + 900 * (m["risk_score"] / m["risk_score"].max())
    st.map(m, latitude="lat", longitude="lon", color="color", size="size")
    st.caption("Darker + larger = higher risk score (freq × avg urgency × days since last complaint)")

st.divider()

# -------------------------------------------------------- category breakdown
st.subheader("Complaints by category (Gemini classification)")
cats = query(f"""
    SELECT category_ai AS category, COUNT(*) AS complaints,
           ROUND(AVG(urgency), 2) AS avg_urgency
    FROM `{DS}.{config.ENRICHED_TABLE}`
    GROUP BY category ORDER BY complaints DESC
""")
chart = (
    alt.Chart(cats)
    .mark_bar(color=SERIES_BLUE, cornerRadiusTopLeft=4, cornerRadiusTopRight=4, size=28)
    .encode(
        x=alt.X("category:N", sort="-y", title=None,
                axis=alt.Axis(labelAngle=0, labelColor=INK_MUTED)),
        y=alt.Y("complaints:Q", title="Complaints",
                axis=alt.Axis(labelColor=INK_MUTED, gridColor="#e1e0d9")),
        tooltip=["category", "complaints", "avg_urgency"],
    )
    .properties(height=320)
)
st.altair_chart(chart, use_container_width=True)

# ------------------------------------------------------- cluster summaries
try:
    clusters = query(f"SELECT * FROM `{DS}.cluster_summaries` ORDER BY n_complaints DESC")
    st.subheader("Top hotspots — Gemini cluster summaries")
    for _, row in clusters.iterrows():
        st.markdown(
            f"**{row.area_name} · {row.category}** ({row.n_complaints} complaints) — {row.summary}"
        )
except Exception:
    st.caption("Cluster summaries not available yet (run `python agent.py`).")
