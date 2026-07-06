"""Task 1: Generate 10K synthetic civic complaints -> complaints.csv

Deliberately messy (casing, whitespace, punctuation, ~8% near-duplicates) so the
cleaning benchmark in benchmark.py has real work to do.

Run: python generate_data.py
"""

import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

SEED = 42
N = 10_000
OUT = "complaints.csv"

random.seed(SEED)
rng = np.random.default_rng(SEED)

# Bengaluru wards: (area_name, lat, lon)
AREAS = [
    ("Koramangala", 12.9352, 77.6245),
    ("Indiranagar", 12.9719, 77.6412),
    ("Whitefield", 12.9698, 77.7500),
    ("Jayanagar", 12.9250, 77.5938),
    ("Malleshwaram", 13.0031, 77.5643),
    ("HSR Layout", 12.9116, 77.6473),
    ("BTM Layout", 12.9166, 77.6101),
    ("Rajajinagar", 12.9915, 77.5554),
    ("Hebbal", 13.0358, 77.5970),
    ("Electronic City", 12.8399, 77.6770),
    ("Yelahanka", 13.1007, 77.5963),
    ("Banashankari", 12.9255, 77.5468),
    ("Marathahalli", 12.9591, 77.6974),
    ("KR Puram", 13.0077, 77.6906),
    ("Basavanagudi", 12.9422, 77.5760),
]

# category -> complaint text templates
TEMPLATES = {
    "pothole": [
        "Huge pothole on the main road near {lm}, two-wheelers are skidding",
        "Road caved in near {lm}, needs urgent repair",
        "Potholes everywhere on the stretch from {lm}, axle-breaking craters",
        "Deep pothole filled with water near {lm}, invisible at night",
    ],
    "garbage": [
        "Garbage not collected for {n} days near {lm}, stray dogs tearing bags",
        "Illegal dumping of construction debris near {lm}",
        "Overflowing garbage bin at {lm}, terrible smell in the whole street",
        "Black spot forming near {lm}, people dumping waste at night",
    ],
    "streetlight": [
        "Street lights not working near {lm} for {n} days, very unsafe at night",
        "Entire stretch near {lm} is pitch dark, lights dead",
        "Streetlight pole leaning dangerously near {lm}",
        "Flickering street light near {lm} for weeks",
    ],
    "water_supply": [
        "No water supply in our block near {lm} for {n} days",
        "Cauvery water pipe leaking near {lm}, water flooding the road",
        "Contaminated water coming from taps near {lm}, smells like sewage",
        "Very low water pressure near {lm} since last week",
    ],
    "drainage": [
        "Open drain overflowing near {lm}, sewage on the road",
        "Storm water drain blocked near {lm}, road floods every rain",
        "Drain cover missing near {lm}, dangerous for pedestrians",
        "Sewage backing up into houses near {lm}",
    ],
    "traffic": [
        "Traffic signal not working at {lm} junction, chaos during peak hours",
        "Illegal parking near {lm} blocking half the road",
        "No traffic police at {lm} junction despite heavy congestion",
        "Wrong-side driving rampant near {lm}, accidents waiting to happen",
    ],
    "stray_animals": [
        "Pack of stray dogs near {lm} chasing bikes, someone was bitten",
        "Stray cattle sitting in the middle of the road near {lm}",
        "Aggressive stray dogs near {lm} park, children scared to play",
    ],
    "noise": [
        "Construction work near {lm} running past midnight, unbearable noise",
        "Loudspeakers at {lm} blasting music beyond permitted hours",
        "Industrial unit near {lm} making constant noise all night",
    ],
}

LANDMARKS = [
    "the bus stop", "the metro station", "the market", "the government school",
    "the temple", "the hospital", "the park entrance", "the flyover",
    "the railway crossing", "the community hall", "the post office", "the lake",
]

SOURCES = ["citizen_app", "phone_helpline", "twitter", "web_portal"]
SOURCE_W = [0.45, 0.25, 0.18, 0.12]

# category weights (potholes & garbage dominate, like real civic data)
CATS = list(TEMPLATES)
CAT_W = [0.22, 0.20, 0.13, 0.12, 0.12, 0.10, 0.06, 0.05]


def messy(text: str) -> str:
    """Inject realistic noise: casing, whitespace, stray punctuation."""
    r = random.random()
    if r < 0.15:
        text = text.upper()
    elif r < 0.30:
        text = text.lower()
    if random.random() < 0.25:
        text = "  " + text.replace(" ", "  ", 2) + " "
    if random.random() < 0.20:
        text += random.choice(["!!!", "...", " pls fix ASAP", " @BBMP please act", "??"])
    return text


def make_row():
    cat = random.choices(CATS, CAT_W)[0]
    area, lat, lon = random.choice(AREAS)
    text = random.choice(TEMPLATES[cat]).format(
        lm=random.choice(LANDMARKS), n=random.randint(2, 15)
    )
    ts = datetime(2026, 7, 5) - timedelta(
        days=random.randint(0, 180),
        hours=random.randint(0, 23),
        minutes=random.randint(0, 59),
    )
    return {
        "complaint_id": None,  # filled after dedup injection
        "text": messy(text),
        "category": cat,  # ground-truth label (agent re-classifies independently)
        "lat": round(lat + rng.normal(0, 0.008), 6),
        "lon": round(lon + rng.normal(0, 0.008), 6),
        "area_name": area,
        "timestamp": ts.isoformat(),
        "source": random.choices(SOURCES, SOURCE_W)[0],
    }


def main():
    n_dupes = int(N * 0.08)
    rows = [make_row() for _ in range(N - n_dupes)]
    # near-duplicates: same complaint reported again with different noise/source
    for _ in range(n_dupes):
        base = dict(random.choice(rows))
        base["source"] = random.choices(SOURCES, SOURCE_W)[0]
        base["text"] = messy(base["text"])
        rows.append(base)
    random.shuffle(rows)
    df = pd.DataFrame(rows)
    df["complaint_id"] = [f"CP{100000 + i}" for i in range(len(df))]
    df.to_csv(OUT, index=False)
    print(f"Wrote {len(df)} rows to {OUT}")
    print(df["category"].value_counts())


if __name__ == "__main__":
    main()
