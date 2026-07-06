# Civic Pulse — Architecture

```mermaid
flowchart LR
    A[generate_data.py<br/>10K synthetic complaints] -->|complaints.csv| B[(Cloud Storage<br/>gs://civic-pulse-data)]
    B -->|bq load| C[(BigQuery<br/>civic_pulse.complaints_raw)]

    subgraph GPU["NVIDIA cudf.pandas"]
        K[benchmark.py<br/>CPU pandas vs GPU] --> L[speedup.json]
    end
    A -.->|same CSV| K

    subgraph ADK["Google ADK agent (agent.py)"]
        D[classify_complaint<br/>category + urgency 1-5]
        E[sentiment<br/>pos / neg / neutral]
        F[summarize_cluster]
    end

    C --> ADK
    ADK <-->|structured JSON| G[Gemini 2.5 Flash]
    ADK --> H[(BigQuery<br/>civic_pulse.complaints_enriched)]
    ADK --> M[(BigQuery<br/>civic_pulse.cluster_summaries)]

    H -->|risk_score.sql<br/>freq × avg_urgency × days_since_last| I[(BigQuery VIEW<br/>civic_pulse.area_risk)]

    subgraph WEB["Next.js dashboard (dashboard/, deployed on Render)"]
        J[API routes<br/>/api/area-risk · /api/categories<br/>/api/summaries · /api/stats] --> N[React UI<br/>stat cards · risk table<br/>Mapbox map · Recharts]
    end

    I --> J
    H --> J
    M --> J
    L -.->|speedup metric card| J
```

## Flow

1. **Ingest** — synthetic complaints CSV lands in GCS, loaded into BigQuery `complaints_raw`.
2. **Accelerate** — `benchmark.py` runs the identical cleaning/dedup pipeline on plain pandas (CPU) and `cudf.pandas` (NVIDIA GPU), emitting the speedup ratio.
3. **Enrich** — the Google ADK agent batch-calls Gemini with structured-output schemas to classify category, score urgency (1–5), and tag sentiment per complaint → `complaints_enriched`; top hotspots get LLM cluster summaries.
4. **Score** — `risk_score.sql` builds the `area_risk` view: `freq × avg_urgency × days_since_last_complaint` per area.
5. **Visualize** — the Next.js dashboard (`dashboard/`, deployed on Render) reads everything live from BigQuery through its API routes: ranked risk table, Mapbox bubble map, category breakdown with click-to-filter, Gemini hotspot summaries, and the GPU speedup metric.
