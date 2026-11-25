"""Loads the three supplied model bundles once at start-up and validates them.

Each .pkl is a dict: {"model": estimator, "preprocessor": ColumnTransformer, "features": [..]}.
Nothing is retrained or modified; the only runtime tweak is n_jobs=1 on the forest models,
which is an execution setting (avoids thread-pool overhead for single-row requests) and does
not change predictions.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib
import numpy as np

log = logging.getLogger("ipl.models")

MODEL_FILES = {
    "first_innings": "first_innings_model.pkl",
    "second_innings": "second_innings_model.pkl",
    "win_probability": "win_probability_model.pkl",
}
FORBIDDEN_FEATURES = {"final_score", "winner", "is_winner", "match_won", "result"}  # leakage guards
METRICS_FILE = Path(__file__).with_name("model_metrics.json")


@dataclass
class LoadedModel:
    key: str
    file: str
    model: Any
    preprocessor: Any
    features: list[str]
    cat_cols: list[str] = field(default_factory=list)
    num_cols: list[str] = field(default_factory=list)
    num_means: dict[str, float] = field(default_factory=dict)

    @property
    def algorithm(self) -> str:
        return type(self.model).__name__


class ModelRegistry:
    def __init__(self) -> None:
        self.models: dict[str, LoadedModel] = {}
        self.errors: dict[str, str] = {}
        self.metrics: dict = {}

    # ------------------------------------------------------------------ loading
    def load(self, models_dir: Path) -> None:
        try:
            self.metrics = json.loads(METRICS_FILE.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover
            log.warning("Could not read model_metrics.json: %s", exc)
        for key, fname in MODEL_FILES.items():
            path = models_dir / fname
            try:
                self.models[key] = self._load_one(key, path)
                log.info("Loaded %s (%s)", key, self.models[key].algorithm)
            except Exception as exc:
                self.errors[key] = f"{type(exc).__name__}: {exc}"
                log.error("Failed to load %s: %s", key, self.errors[key])
        if self.models:
            self._check_category_agreement()

    @staticmethod
    def _load_one(key: str, path: Path) -> LoadedModel:
        if not path.exists():
            raise FileNotFoundError(f"model file '{path.name}' not found")
        bundle = joblib.load(path)
        if not isinstance(bundle, dict) or not {"model", "preprocessor", "features"} <= set(bundle):
            raise ValueError("unexpected pickle structure (expected model/preprocessor/features)")
        features = list(bundle["features"])
        pre = bundle["preprocessor"]
        leaked = FORBIDDEN_FEATURES & set(features)
        if leaked:
            raise ValueError(f"target-leakage features present: {sorted(leaked)}")
        used = [c for _, _, cols in pre.transformers_ if cols != "drop" for c in (cols if not isinstance(cols, str) else [cols])]
        if set(used) != set(features):
            raise ValueError("preprocessor columns do not match the stored feature list")
        model = bundle["model"]
        if hasattr(model, "n_jobs") and hasattr(model, "estimators_"):
            model.n_jobs = 1
        lm = LoadedModel(key=key, file=path.name, model=model, preprocessor=pre, features=features)
        for _name, tr, cols in pre.transformers_:
            if cols == "drop" or isinstance(cols, str):
                continue
            if hasattr(tr, "categories_"):
                lm.cat_cols = list(cols)
            elif hasattr(tr, "mean_"):
                lm.num_cols = list(cols)
                lm.num_means = {c: float(m) for c, m in zip(cols, tr.mean_)}
        return lm

    def _check_category_agreement(self) -> None:
        sets = []
        for lm in self.models.values():
            enc = self.encoder(lm)
            sets.append({c: tuple(cats) for c, cats in zip(lm.cat_cols, enc.categories_)})
        if any(s != sets[0] for s in sets[1:]):
            log.warning("Category lists differ between models; using per-model categories")

    # ---------------------------------------------------------------- accessors
    @staticmethod
    def encoder(lm: LoadedModel):
        for _n, tr, cols in lm.preprocessor.transformers_:
            if hasattr(tr, "categories_"):
                return tr
        raise ValueError("no encoder")

    def get(self, key: str) -> LoadedModel:
        if key not in self.models:
            raise RuntimeError(self.errors.get(key, f"model '{key}' is not loaded"))
        return self.models[key]

    def categories(self, key: str = "win_probability") -> dict[str, list[str]]:
        lm = self.get(key)
        enc = self.encoder(lm)
        return {c: [str(x) for x in cats] for c, cats in zip(lm.cat_cols, enc.categories_)}

    @property
    def all_loaded(self) -> bool:
        return len(self.models) == len(MODEL_FILES)

    # --------------------------------------------------------------- inference
    def transform(self, key: str, frame) -> Any:
        lm = self.get(key)
        Xt = lm.preprocessor.transform(frame[lm.features])
        if hasattr(Xt, "toarray"):
            Xt = Xt.toarray()
        return np.asarray(Xt)

    # ------------------------------------------------------------- insights
    def feature_importance(self, key: str) -> list[dict]:
        """Importance aggregated back to the original input features."""
        lm = self.get(key)
        names = list(lm.preprocessor.get_feature_names_out())
        if hasattr(lm.model, "feature_importances_"):
            raw = np.asarray(lm.model.feature_importances_, dtype=float)
            kind = "impurity"
        else:
            raw = np.abs(np.asarray(lm.model.coef_, dtype=float).ravel())
            kind = "abs_coef"
        agg: dict[str, float] = {f: 0.0 for f in lm.features}
        for n, v in zip(names, raw):
            body = n.split("__", 1)[1] if "__" in n else n
            target = None
            for f in lm.features:
                if body == f or body.startswith(f + "_"):
                    if target is None or len(f) > len(target):
                        target = f
            if target:
                agg[target] += float(v)
        total = sum(agg.values()) or 1.0
        rows = [{"feature": f, "importance": v / total, "kind": kind} for f, v in agg.items()]
        return sorted(rows, key=lambda r: -r["importance"])

    def numeric_coefficients(self, key: str) -> list[dict]:
        """Signed coefficients of a linear model for the standardised numeric inputs."""
        lm = self.get(key)
        if not hasattr(lm.model, "coef_"):
            return []
        names = list(lm.preprocessor.get_feature_names_out())
        coef = np.asarray(lm.model.coef_, dtype=float).ravel()
        out = []
        for n, c in zip(names, coef):
            body = n.split("__", 1)[1] if "__" in n else n
            if body in lm.num_cols:
                out.append({"feature": body, "coefficient": float(c)})
        return sorted(out, key=lambda r: -abs(r["coefficient"]))

    def describe(self, key: str) -> dict:
        lm = self.get(key)
        m = lm.model
        params = {}
        for p in ("n_estimators", "max_depth", "min_samples_leaf", "min_samples_split", "max_features", "fit_intercept"):
            if hasattr(m, p):
                v = getattr(m, p)
                params[p] = v if isinstance(v, (int, float, str, bool, type(None))) else str(v)
        return {
            "algorithm": lm.algorithm,
            "input_features": lm.features,
            "encoded_feature_count": int(len(lm.preprocessor.get_feature_names_out())),
            "parameters": params,
        }


registry = ModelRegistry()
