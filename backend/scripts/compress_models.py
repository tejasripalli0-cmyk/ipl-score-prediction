"""OPTIONAL: write losslessly compressed copies of the model files and prove predictions are identical.

The originals are never modified. first_innings_model.pkl is ~114 MB, above GitHub's 100 MB file limit;
the compressed copy is ~28 MB and loads with the same joblib.load() call.

    python scripts/compress_models.py
Output goes to saved_models_compressed/ - copy those files over saved_models/ for deployment if you want.
"""
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

root = Path(__file__).resolve().parents[1]
src, dst = root / "saved_models", root / "saved_models_compressed"
dst.mkdir(exist_ok=True)
rng = np.random.default_rng(0)

for f in sorted(src.glob("*.pkl")):
    b = joblib.load(f)
    out = dst / f.name
    joblib.dump(b, out, compress=("zlib", 6))
    c = joblib.load(out)
    cats = {col: list(cats) for col, cats in zip(
        [c_ for _, tr, cols in b["preprocessor"].transformers_ if hasattr(tr, "categories_") for c_ in cols],
        [x for _, tr, _ in b["preprocessor"].transformers_ if hasattr(tr, "categories_") for x in tr.categories_])}
    n = 200
    X = pd.DataFrame({col: rng.choice(cats[col], n) if col in cats else rng.uniform(0, 100, n) for col in b["features"]})
    fn = "predict_proba" if hasattr(b["model"], "predict_proba") else "predict"
    a = getattr(b["model"], fn)(b["preprocessor"].transform(X))
    z = getattr(c["model"], fn)(c["preprocessor"].transform(X))
    ok = np.allclose(a, z)
    print(f"{f.name}: {f.stat().st_size/1e6:.1f} MB -> {out.stat().st_size/1e6:.1f} MB, predictions identical: {ok}")
    if not ok:
        sys.exit("Mismatch - do not use the compressed copy.")
