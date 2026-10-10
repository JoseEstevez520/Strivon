"""Local re-implementation of the challenge scoring rules (see brief, p.4-5)."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from . import config


@dataclass
class ScoreReport:
    id_correct: int = 0
    id_wrong: int = 0
    stock_correct: int = 0
    stock_below: int = 0
    stock_above: int = 0
    missing: int = 0
    rows: list[dict] = field(default_factory=list)

    @property
    def n_areas(self) -> int:
        return self.id_correct + self.id_wrong

    @property
    def total(self) -> int:
        return (
            self.id_correct * config.SCORE_ID_CORRECT
            + self.id_wrong * config.SCORE_ID_WRONG
            + self.stock_correct * config.SCORE_STOCK_CORRECT
            + self.stock_below * config.SCORE_STOCK_BELOW
            + self.stock_above * config.SCORE_STOCK_ABOVE
        )

    @property
    def maximum(self) -> int:
        return 2 * self.n_areas

    def to_json(self) -> dict:
        return {
            "total": self.total,
            "maximum": self.maximum,
            "n_areas": self.n_areas,
            "missing": self.missing,
            "table": [
                {"case": "Identification correct", "areas": self.id_correct, "each": config.SCORE_ID_CORRECT},
                {"case": "Identification wrong", "areas": self.id_wrong, "each": config.SCORE_ID_WRONG},
                {"case": "Stock level correct", "areas": self.stock_correct, "each": config.SCORE_STOCK_CORRECT},
                {"case": "Stock level below the real stock", "areas": self.stock_below, "each": config.SCORE_STOCK_BELOW},
                {"case": "Stock level above the real stock", "areas": self.stock_above, "each": config.SCORE_STOCK_ABOVE},
            ],
            "rows": self.rows,
        }

    def __str__(self) -> str:
        lines = [f"{'Case':36} {'Areas':>6} {'Each':>5} {'Points':>7}"]
        for r in self.to_json()["table"]:
            lines.append(f"{r['case']:36} {r['areas']:6d} {r['each']:+5d} {r['areas'] * r['each']:+7d}")
        lines.append(f"{'Total':36} {'':6} {'':5} {self.total:+7d}   (max {self.maximum}, missing {self.missing})")
        return "\n".join(lines)


def score(predictions: dict, annotations: dict) -> ScoreReport:
    """Compare predictions with annotations, both in the submission format
    {camera: {image: {area_id: {planogram_compliant, stock_level, stock_value}}}}."""
    rep = ScoreReport()
    for cam, imgs in annotations.items():
        for img, areas in imgs.items():
            for area_id, gt in areas.items():
                pred = predictions.get(cam, {}).get(img, {}).get(area_id)
                row = {"camera": cam, "image": img, "area_id": area_id, "gt": gt, "pred": pred}
                if pred is None:
                    rep.missing += 1
                    rep.id_wrong += 1
                    rep.stock_above += 1
                    row.update(id_ok=False, stock="missing", points=config.SCORE_ID_WRONG + config.SCORE_STOCK_ABOVE)
                    rep.rows.append(row)
                    continue
                pts = 0
                if bool(pred["planogram_compliant"]) == bool(gt["planogram_compliant"]):
                    rep.id_correct += 1
                    pts += config.SCORE_ID_CORRECT
                    row["id_ok"] = True
                else:
                    rep.id_wrong += 1
                    pts += config.SCORE_ID_WRONG
                    row["id_ok"] = False
                pv, gv = float(pred["stock_value"]), float(gt["stock_value"])
                if abs(pv - gv) < 1e-6:
                    rep.stock_correct += 1
                    pts += config.SCORE_STOCK_CORRECT
                    row["stock"] = "correct"
                elif pv < gv:
                    rep.stock_below += 1
                    pts += config.SCORE_STOCK_BELOW
                    row["stock"] = "below"
                else:
                    rep.stock_above += 1
                    pts += config.SCORE_STOCK_ABOVE
                    row["stock"] = "above"
                row["points"] = pts
                rep.rows.append(row)
    return rep


def score_files(pred_path: Path | str, ann_path: Path | str) -> ScoreReport:
    return score(json.loads(Path(pred_path).read_text()), json.loads(Path(ann_path).read_text()))
