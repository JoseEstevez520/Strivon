"""Label-free estimators for stock level and planogram compliance.

Everything here works without annotations:

* **Stock** combines (a) CLIP zero-shot "empty / half / full" prompts for the
  expected product with (b) a *container-visibility* score: we learn what an
  empty gondola looks like in each camera from the crops CLIP is most sure are
  empty, learn what the product looks like from the crops it is most sure are
  full, and measure how much of the current crop looks like bare container.
* **Compliance** compares the crop with (a) text prompts of every product
  family on that camera and (b) image prototypes of each family built from the
  whole store, using the planogram itself as (noisy) weak labels.

When team annotations exist, `calibrate.py` fits a small model on top of the
same features and the pipeline uses it instead of the hand-set rules.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from . import clip_backend as cb
from .extract import AreaFeatures
from .planogram import Planogram

Key = tuple[str, str, str]  # camera, image, area_id

# Families that a ceiling camera cannot reliably tell apart: a swap inside a group
# is never flagged as a planogram mismatch (a false alarm costs -2).
CONFUSABLE_GROUPS = [
    {"apple_red", "apple_russet", "stone_fruit", "pepper_red", "tomato"},
    {"apple_green", "pear", "guava", "lime", "chayote", "melon"},
    {"citrus_orange", "lemon", "pumpkin", "papaya", "mango"},
    {"banana", "plantain"},
    {"potato", "sweet_potato", "ginger", "onion", "garlic"},
    {"onion_red", "red_cabbage", "eggplant", "passion_fruit", "grape_red", "cherry"},
    {"cabbage", "cauliflower", "leafy", "broccoli"},
    {"cucumber", "pepper_green", "green_beans", "avocado", "watermelon"},
]


def group_of(family: str) -> set[str]:
    for g in CONFUSABLE_GROUPS:
        if family in g:
            return g
    return {family}


@dataclass
class Observation:
    key: Key
    family: str
    p_stock: np.ndarray  # [empty, half, full]
    container_frac: float
    p_stock_zeroshot: np.ndarray
    p_compliant: float
    family_probs: dict[str, float]
    observed_family: str
    extra: dict = field(default_factory=dict)


def _norm(v: np.ndarray) -> np.ndarray:
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)


class LabelFreeModel:
    def __init__(self, planogram: Planogram, feats: dict[Key, AreaFeatures]):
        self.pg = planogram
        self.F = feats
        self.has_clip = all(f.emb is not None and f.emb.size for f in feats.values()) and len(feats) > 0

    # -- stock ----------------------------------------------------------------
    def _zero_shot_stock(self) -> dict[Key, np.ndarray]:
        out = {}
        if not self.has_clip:
            return out
        ls = cb.logit_scale()
        cache: dict[str, np.ndarray] = {}
        for k, f in self.F.items():
            a = self.pg.area(k[2])
            noun = a.info.prompt_noun
            if noun not in cache:
                P = cb.stock_prompts(noun)
                cache[noun] = _norm(np.stack([cb.embed_texts(P[x]).mean(0) for x in ("empty", "half", "full")]))
            out[k] = cb.softmax(ls * cache[noun] @ f.emb)
        return out

    def _heuristic_stock(self, k: Key) -> np.ndarray:
        """Fallback without CLIP: bare-container colours vs produce colours."""
        s = self.F[k].scalars
        bare = np.clip(s[3] + s[4] + 0.5 * s[5] - 0.5 * s[6], 0, 1)
        return np.array([bare**2, 2 * bare * (1 - bare), (1 - bare) ** 2]) + 1e-3

    def _container_fraction(self, zs: dict[Key, np.ndarray]) -> dict[Key, float]:
        keys = list(self.F)
        if zs:
            p_empty = {k: zs[k][0] for k in keys}
            p_full = {k: zs[k][2] for k in keys}
        else:
            h = {k: self._heuristic_stock(k) for k in keys}
            p_empty = {k: h[k][0] / h[k].sum() for k in keys}
            p_full = {k: h[k][2] / h[k].sum() for k in keys}
        hist = {k: self.F[k].hist for k in keys}
        glob_empty = [hist[k] for k in keys if p_empty[k] > 0.9]
        C_glob = np.mean(glob_empty, 0) if glob_empty else None
        out: dict[Key, float] = {}
        by_cam: dict[str, list[Key]] = {}
        for k in keys:
            by_cam.setdefault(k[0], []).append(k)
        for cam, ck in by_cam.items():
            cam_empty = [hist[k] for k in ck if p_empty[k] > 0.9]
            if cam_empty and C_glob is not None:
                wcam = min(1.0, len(cam_empty) / 4)
                C = wcam * np.mean(cam_empty, 0) + (1 - wcam) * C_glob
            else:
                C = C_glob
            by_area: dict[str, list[Key]] = {}
            for k in ck:
                by_area.setdefault(k[2], []).append(k)
            for aid, ak in by_area.items():
                area_empty = [hist[k] for k in ak if p_empty[k] > 0.9]
                Ca = C
                if area_empty:
                    Ca = 0.5 * np.mean(area_empty, 0) + 0.5 * (C if C is not None else np.mean(area_empty, 0))
                full = [hist[k] for k in ak if p_full[k] > 0.6] or [hist[k] for k in sorted(ak, key=lambda x: -p_full[x])[:3]]
                P = np.mean(full, 0)
                for k in ak:
                    if Ca is None:
                        out[k] = float(1 - p_full[k])
                        continue
                    w = Ca / (Ca + P + 1e-6)
                    out[k] = float((hist[k] * w).sum())
        return out

    @staticmethod
    def stock_probs(zs: np.ndarray, c: float) -> np.ndarray:
        """Fuse zero-shot probabilities with the container-visible fraction c."""
        # Container fraction -> soft class evidence (thresholds set by eye on train images,
        # re-fitted by calibrate.py once annotations exist).
        e = 1 / (1 + np.exp(-(c - 0.72) / 0.06))
        f = 1 / (1 + np.exp((c - 0.30) / 0.06))
        cont = np.array([e, max(1e-3, 1 - e - f), f])
        cont /= cont.sum()
        p = 0.45 * zs + 0.55 * cont
        return p / p.sum()

    # -- compliance -------------------------------------------------------------
    def _family_probs(self) -> dict[Key, dict[str, float]]:
        out: dict[Key, dict[str, float]] = {}
        if not self.has_clip:
            return out
        ls = cb.logit_scale()
        fam_info = {}
        for a in self.pg.areas:
            fam_info.setdefault(a.info.family, a.info)
        fams = sorted(fam_info)
        T = _norm(np.stack([cb.embed_texts(cb.family_prompts(fam_info[f].description, False)).mean(0) for f in fams]))
        text_p = {k: cb.softmax(ls * T @ f.emb) for k, f in self.F.items()}
        # Image prototypes per family, weighted by how much the text agrees with the planogram.
        fi = {f: i for i, f in enumerate(fams)}
        protos = {}
        for fam in fams:
            ks = [k for k in self.F if self.pg.area(k[2]).info.family == fam]
            w = np.array([text_p[k][fi[fam]] for k in ks]) + 1e-3
            E = np.stack([self.F[k].emb for k in ks])
            protos[fam] = _norm((E * w[:, None]).sum(0))
        Pm = np.stack([protos[f] for f in fams])
        for k, f in self.F.items():
            cam_fams = sorted({a.info.family for a in self.pg.cameras[k[0]]})
            idx = [fi[x] for x in cam_fams]
            tp = cb.softmax(np.log(text_p[k][idx] + 1e-9))
            pp = cb.softmax(25.0 * (Pm[idx] @ f.emb))
            p = 0.5 * tp + 0.5 * pp
            out[k] = {fam: float(v) for fam, v in zip(cam_fams, p)}
        return out

    # -- main -------------------------------------------------------------------
    def run(self) -> dict[Key, Observation]:
        zs = self._zero_shot_stock()
        cont = self._container_fraction(zs)
        fam = self._family_probs()
        out = {}
        for k in self.F:
            a = self.pg.area(k[2])
            z = zs.get(k)
            if z is None:
                h = self._heuristic_stock(k)
                z = h / h.sum()
            p = self.stock_probs(z, cont[k])
            fp = fam.get(k, {a.info.family: 1.0})
            grp = group_of(a.info.family)
            p_exp = sum(v for f, v in fp.items() if f in grp)
            observed = max(fp, key=fp.get)
            # Empty area: nothing wrong is on display.
            p_comp = p[0] * 1.0 + (1 - p[0]) * self._compliance_from(p_exp)
            out[k] = Observation(k, a.info.family, p, cont[k], z, float(p_comp), fp, observed)
        return out

    @staticmethod
    def _compliance_from(p_expected_group: float) -> float:
        # Prior: the brief's example implies ~93% of areas are compliant.
        prior = 0.93
        lr = (p_expected_group + 0.02) / (1 - p_expected_group + 0.02)
        # p_expected_group of ~0.5 is uninformative when the camera has 2 groups.
        odds = prior / (1 - prior) * lr**1.5
        return float(odds / (1 + odds))
