"""Task 3: CPU pandas vs GPU cudf.pandas benchmark on the cleaning pipeline.

Run: python benchmark.py
  - Times the pipeline with plain pandas (CPU).
  - Re-invokes itself under `python -m cudf.pandas` to time the GPU run
    (script equivalent of `%load_ext cudf.pandas` in Jupyter).
  - Writes speedup.json.

Fails loudly if cudf / an NVIDIA GPU is unavailable. Pass --allow-no-gpu to
record a CPU-only result instead (speedup reported as null).
"""

import json
import re
import subprocess
import sys
import time

CSV = "complaints.csv"
OUT = "speedup.json"
REPEATS = 5  # amplify workload so timings are stable

PUNCT_RE = re.compile(r"[^\w\s]")
WS_RE = re.compile(r"\s+")


def pipeline():
    import pandas as pd  # imported here so cudf.pandas proxy can intercept it

    df = pd.read_csv(CSV)
    for _ in range(REPEATS):
        d = df.copy()
        # normalize
        d["text_clean"] = (
            d["text"].str.lower()
            .str.replace(PUNCT_RE.pattern, " ", regex=True)
            .str.replace(WS_RE.pattern, " ", regex=True)
            .str.strip()
        )
        d["area_name"] = d["area_name"].str.strip().str.title()
        # dedupe near-duplicates on normalized text + location
        d = d.drop_duplicates(subset=["text_clean", "area_name", "lat", "lon"])
        # representative analytics ops
        d["timestamp"] = pd.to_datetime(d["timestamp"], format="mixed")
        agg = (
            d.groupby(["area_name", "category"])
            .agg(n=("complaint_id", "count"), latest=("timestamp", "max"))
            .reset_index()
            .sort_values("n", ascending=False)
        )
        merged = d.merge(agg, on=["area_name", "category"], how="left")
    return len(merged), len(df) - len(d)


def timed_run():
    t0 = time.perf_counter()
    rows, dupes = pipeline()
    return time.perf_counter() - t0, rows, dupes


def gpu_engine_active() -> bool:
    import pandas as pd
    return "cudf" in type(pd.DataFrame()).__module__


def main():
    if "--child-gpu" in sys.argv:
        # We are running under `python -m cudf.pandas`
        if not gpu_engine_active():
            print("FATAL: cudf.pandas did not activate in child process", file=sys.stderr)
            sys.exit(1)
        secs, rows, dupes = timed_run()
        print(json.dumps({"gpu_seconds": secs, "rows": rows, "dupes_removed": dupes}))
        return

    print(f"[CPU] running pipeline x{REPEATS} with plain pandas ...")
    cpu_secs, rows, dupes = timed_run()
    print(f"[CPU] {cpu_secs:.3f}s  ({rows} rows out, {dupes} duplicates removed)")

    print("[GPU] re-running under `python -m cudf.pandas` ...")
    proc = subprocess.run(
        [sys.executable, "-m", "cudf.pandas", __file__, "--child-gpu"],
        capture_output=True, text=True,
    )

    result = {
        "cpu_seconds": round(cpu_secs, 4),
        "gpu_seconds": None,
        "speedup": None,
        "rows_processed": rows,
        "duplicates_removed": dupes,
        "repeats": REPEATS,
        "gpu_available": False,
    }

    if proc.returncode == 0:
        child = json.loads(proc.stdout.strip().splitlines()[-1])
        result["gpu_seconds"] = round(child["gpu_seconds"], 4)
        result["speedup"] = round(cpu_secs / child["gpu_seconds"], 2)
        result["gpu_available"] = True
        print(f"[GPU] {result['gpu_seconds']:.3f}s  ->  speedup {result['speedup']}x")
    else:
        msg = (
            "FATAL: GPU run failed (cudf missing or no NVIDIA GPU).\n"
            f"stderr:\n{proc.stderr.strip()}\n"
            "Install with: pip install cudf-cu12 --extra-index-url=https://pypi.nvidia.com\n"
            "Or rerun with --allow-no-gpu to record a CPU-only result."
        )
        if "--allow-no-gpu" not in sys.argv:
            print(msg, file=sys.stderr)
            sys.exit(1)
        print("[GPU] unavailable, recording CPU-only result (--allow-no-gpu)")

    with open(OUT, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
