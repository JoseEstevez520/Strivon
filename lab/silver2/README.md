# Labels that follow Sensei's own wording

Two independent labelling passes over all 181 photos, made by AI labellers that read each photo and followed `lab/RUBRIC_V2.md`, which is
Sensei's description of the three stock levels (see `docs/SENSEI_INFO.md`). Neither pass saw the team's labels or the other pass.

- `p3_<camera>.json`: pass N1 (Sonnet), photos in time order.
- `p4_<camera>.json`: pass N2 (Opus), photos in reverse order.
- Format: `{camera: {image: {area_id: {stock_level, planogram_compliant, conf}}}}`. `conf` is 1 to 3. Areas the labeller could not judge carry `skip`.
- CN, the "agreement" label, is the level the two passes give when they agree; where they differ there is no CN label.

How far to trust them: against the team's human labels they agree on 77 to 81% of the areas (the strict first rubric agreed on 47 to 65%), and they call about
47 to 59% of the areas `full` against about 70% for the team. They are not the truth; they are a second reading of Sensei's rule. On the forward
split the team labels and CN differ on 21% of the areas, almost all of them `full` (team) against `half` (CN), which is why they are here: a model trained only on
the team labels can lose a lot of points if Sensei's annotators follow the wording more strictly.

Use at training time only, for example as a weighted second label (the lab used 0.75 team + 0.25 these labels, see `docs/BOARD.md`). Nothing here is derived from pixels.
