# Stock model options, and the label question with examples

Written on Sunday 11/10 at about 10:00 Lisbon, before the freeze. It puts in one place what the team and the lab found overnight, so the choice can be made from one page.

Numbers are stock points on the forward split (the last two photos of each camera: 28 photos, 302 areas), with models trained without those photos. Two label keys are used throughout. "Current" is `eval/labels.json`, the team labels. "Reader" is one person's reading of Sensei's rule on 166 of the 302 areas, extrapolated to all 302; it carries about +-20 points of noise and it is one reader. Identification is left out: both the lab and R3 get the product right on 301 or 302 of the 302 areas.

## Where things stand

The submission is R3 (`ld6ee`) with no flags, decided at 02:20. The lab model is the cheap backup.

The open question is how Sensei separates empty, half and full. The team labels and a literal reading of Sensei's rule agree on about 79% of the forward areas and differ on the rest, always in the same direction: where they differ, the reader answers a lower level. That difference decides how much R3 leads the lab (58 points under the current labels, about 27 under the reader's) and whether a cautious option pays.

Cost is 20% of the grade and nobody knows how it is scored. André chooses between the R3 options at 09:00 Lisbon, ideally after Sensei shows two example photos per level.

## The options

Stock points on the forward split, current key / reader key (two numbers = two seeds). CPU is per photo, one thread, measured on this laptop.

| Option | How | CPU | Current | Reader | Notes |
|---|---|---|---|---|---|
| R3 as shipped | no flag | about 1.0 s | +246 / +231 | +69 / +68 | the default |
| R3 with p(full) x 0.7 | `--stock-tilt 0.7` | same | +242 / +233 | +72 / +70 | nearly free, nearly no effect |
| R3 with p(full) x 0.5 | `--stock-tilt 0.5` | same | +221 / +226 | +72 / +84 | costs about 20 under the current key |
| R3 retrained on a label mix (0.75 team, 0.25 AI passes) | `--stock-model mix` | same | +214 / +220 | +93 / +92 | against its control (+241 / +230 and +64 / +67): -27 / -10 current, +29 / +25 reader. Not with `--stock-tilt` |
| R3 and lab averaged, then p(full) x 0.7 | not on main: p = 0.7 p(R3) + 0.3 p(lab) | about 1.1 s | +240 | +84 | proposal, forward only, reproduced twice |
| Cascade: lab first, R3 only where the lab is unsure | prototype `lab/r3fast/cascade.py`, needs changes in `agents/` | 0.58 to 0.64 s at tau 0.9; 0.38 to 0.43 s at tau 0.8 | +246 / +231 at 0.9; +238 / +227 at 0.8 | +69 / +68 at 0.9; +61 / +64 at 0.8 | same stock answers as R3 on 304 of 304 areas at tau 0.9. Identification would come from the lab on the areas R3 skips: a decision for André |
| Lab alone | `python lab/predict_fast.py predict ...` | about 0.1 s | +188 | +42 | needs `lab/models/lane_i_ens.pkl`, not in git |
| Lab with `--full-weight 0.5` | same, plus the flag | about 0.1 s | +183 | +72 | on the five folds it costs about 3 points per 289 areas |
| CLIP crate model and R3, the lower of the two | row `combo_min_crate_R3` | 1.7 to 2.2 s | +214 | +86 | not adopted by the team |
| Label-free U7 | `--label-free` | see `agents/README.md` | -28 | -184 | for a new store that has no labels yet |

## What the grade does

A paired bootstrap over the 28 forward photos (26 per draw, 5000 draws) and five guesses about how the cost is scored (a linear budget of 2 s or 5 s, a ratio to the cheapest team at 0.1 s or 0.5 s, and pass or fail at 1.5 s). The guesses are ours and the identification part is held at R3's forward value.

- R3 beats the lab on points with probability 1.00 under the current key and 0.96 under the reader's.
- Under the current key the cascade at tau 0.9 had the best grade in four of the five cost guesses and tied R3 under pass or fail. The lab alone won when cost is a ratio to a cheapest team at 0.1 s, in a coin flip with the lab at k 0.5.
- Under the reader's key the lab with `--full-weight 0.5` had the best grade in all five, narrowly under pass or fail.
- Whether the retrained mix beats its control and whether `--full-weight 0.5` beats the plain lab are decided by which label convention is true, not by noise.
- A validation set that follows our last photos should score about 60 points below the five-fold figure per 289 areas, whatever the option: the models answer one level too high near the end of each camera's restock cycle.

## Once Sensei answers

| | Cost does not separate the options (pass or fail at 1.5 s) | Cost counts (a linear budget, or a ratio to the cheapest team) |
|---|---|---|
| Levels as the team labelled them | R3 as shipped, or the cascade | the cascade; the lab alone if the cheapest team is as cheap as the lab |
| Levels as the written rule reads | `--stock-model mix` | the lab with `--full-weight 0.5` |

The cells follow the grade simulation above; they are a guide, since the cost guesses are ours.

With no answer, André's pre-registered pick is `--stock-model mix`. From the lab side the numbers say it costs about 18 points if Sensei labels like the team and gains about 27 if Sensei labels like the written rule, so it pays when the chance of the second case is above about 40%. Nothing here has been checked against Sensei's own labels.

## The label difference, with examples

Sensei's rule as the team has it: full means leave it, half means staff would take the time to replenish it, empty means nobody would buy or one or two units are left, and in doubt the lower level.

One person read the 121 forward areas where the team labels and two AI passes with Sensei's wording disagreed, and 45 areas drawn at random from the 181 where they agree. Where they disagreed, the reader sided with the team on 75 of 121. Of the 74 areas the team called full, 42 stay full and 32 become half; of the 25 called empty, 14 stay empty and 11 become half. The reader never answered full where the team had not. On the 45 random areas the reader agreed with the team on 41. Extrapolated, about 62 of the 302 forward answers (21%, range 52 to 84) would differ. A sub-agent that read the same crops blind, with the rule only, agrees with the reader on 72% of the disputed areas.

How the reading was applied: the level is judged on what is physically in the area, whatever the product. If only one more piece or bag would fit, and squeezed in, it is full. If several are missing and the floor shows, it is half. A few units in a large empty tray are empty when in doubt.

Fifteen examples. The first nine are areas where the team, the reader and the AI passes agree; the last six are the two kinds of difference. "n/a" means the AI pass did not cover that photo. R3 and lab are the forward answers of `agents_R3_s0` and `lab_image_only_ensemble`.

| group | area (camera_slot, photo) | product | team | reader | AI pass 1 / 2 | R3 | lab |
|---|---|---|---|---|---|---|---|
| clear full | 6373_4, 1751044463 | Maça Golden Nacional 75/85 Kg | full | full | full / full | full | full |
| clear full | 6376_6, 1751044933 | Lima Cnt Kg | full | full | full / full | full | full |
| clear full | 6385_6, 1751051814 | Maca Fuji Cnt Cal. 73/85 Kg Imp | full | full | full / full | full | full |
| clear empty | 6462_1, 1751047858 | Morango Emb. 500 Gr | empty | empty | empty / empty | empty | empty |
| clear empty | 6215_8, 1751045755 | Banana Cat I Cnt Kg | empty | empty | empty / n/a | empty | empty |
| clear empty | 6462_5, 1751047858 | Uva Branca S/Grainha Cnt 500 G | empty | empty | empty / half | empty | empty |
| clear half | 6462_3, 1751043841 | Manga Cnt Kg | half | half | half / half | half | half |
| clear half | 6468_9, 1751048837 | Mamao Inteiro Cnt Kg | half | half | half / half | half | half |
| clear half | 6371_7, 1751044440 | Meloa Cantalupe/Charentais Inteir Cnt Kg | half | half | half / n/a | half | half |
| team full, reader half | 6462_7, 1751043841 | Uva Red Globe Cnt Kg | full | half | half / half | full | full |
| team full, reader half | 6376_2, 1751049028 | Meloa Galia Inteira Cnt Kg | full | half | half / half | full | half |
| team full, reader half | 6215_7, 1751041465 | Citrinos Do Algarve Igp Laranja 70/95 Kg | full | half | half / n/a | full | full |
| team empty, reader half | 6376_7, 1751049028 | Citrinos Algarve Igp Laranja 6/7/8 3Kg | empty | half | empty / half | half | full |
| team empty, reader half | 6443_11, 1751040209 | Tomate Chucha Cnt Kg | empty | half | empty / n/a | empty | empty |
| team empty, reader half | 6468_10, 1751044824 | Papaia De Avião Inteira Cnt Kg | empty | half | empty / half | empty | empty |

Three recurring kinds of difference: room for one more bag that would have to be squeezed in (the team says full, the reader says full or half depending on how many fit); a third of a basket empty (team full, reader half); a few units left in a big bin (team empty, reader half). In the last group the models disagree with each other, as in `6376_7`, where R3 says half and the lab says full.

The crops are on Jose's laptop in `lab/handoff/`: `PARA_EL_EQUIPO.html` puts this page and the examples together in Spanish. `ejemplos_sensei.html` shows the fifteen without labels, with the key closed at the bottom, to put in front of Sensei, and `dos_criterios.html` shows all 166 readings against the team labels. Photos stay out of git.

## Where everything is

- `lab/STATE.md`: the lab's hand-off, with how to run the backup predictor and what was tried.
- `lab/EXPERIMENT_LOG.md`: the reasoning for every closed front and tonight's numbers.
- `lab/labels_reader166.json`: the 166 readings (camera, photo, area, level).
- `docs/BOARD.md`: the 06:40, 06:50, 07:15, 07:55 and 08:25 entries and André's 05:35, 05:40, 05:58 and 07:58 replies.
- `docs/DECISION_BRIEF.md` and `docs/VALIDATION_DAY.md`: the choice and the commands.
- `agents/README.md`: the R3 flags `--stock-tilt` and `--stock-model`.

## What is not known

How Sensei's annotators decide; how the cost is scored; whether the hidden photos follow ours in time. The reader is one person and 45 of the 166 readings are a random sample extrapolated, so differences of 20 points between options are inside the noise. The cascade was timed on 28 photos and one thread, not on four threads, a GPU or another laptop. The lab has looked at these labels more than 150 times, so small gains in `lab/EXPERIMENT_LOG.md` should be read as upper bounds.
