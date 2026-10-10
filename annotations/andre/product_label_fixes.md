# Product labels where André and `eval/labels.json` disagree

André's 511 reviewed areas overlap the team's `eval/labels.json` (commit 6caa1bc). On the product question they disagree on 31.
The photos were checked again by eye. Every photo is listed in `product_label_fixes.json` (camera, image file, time, area).

## Clear mistakes in `eval/labels.json` (13): please mark them wrong product

| Camera | Area | Planned product | What is in the crate | Photos (Lisbon time) | Team | André |
|---|---|---|---|---|---|---|
| 6376 | 6376_4 | KIWI ZESPRI 500 GR (kiwis, 500 g pack) | bags of lemons | 06:12, 07:29, 08:29, 09:38, 10:50, 11:59, 13:00, 14:10 | right product | wrong product |
| 6376 | 6376_5 | KIWI CNT BIO 400 G (organic kiwis, 400 g pack) | bags of lemons | 07:29 | right product | wrong product |
| 6594 | 6594_2 | BATATA VERMELHA EMB. 5 KG (red potatoes, 5 kg bag) | onions | 06:13, 07:22, 08:22, 09:31 | right product | wrong product |

## Waiting on a rule (18)

These depend on two questions the team hasn't settled (worth asking Sensei):

- **Variety**: is a different variety of the same fruit or vegetable the wrong product? (yellow vs red potatoes, plain vs sweet onions, another apple vs Gala)
- **Bagged vs loose**: are onions in mesh bags a different product from loose onions?

| Camera | Area | Planned product | What is in the crate | Photos (Lisbon time) | Team | André | Rule |
|---|---|---|---|---|---|---|---|
| 6373 | 6373_2 | MAÇÃ GALA CNT 60/70 1 KG IMP (Gala apples, 1 kg bag) | bags of yellow-green apples | 16:11 | wrong product | right product | variety |
| 6594 | 6594_13 | CEBOLA DOCE CNT EMB 1 KG (sweet onions, 1 kg bag) | onions in orange mesh bags | 06:13, 07:22, 08:22, 09:31 | right product | wrong product | variety |
| 6594 | 6594_3 | BATATA VERMELHA CNT EMB. 3KG (red potatoes, 3 kg bag) | bags of yellow potatoes | 06:13, 07:22, 08:22, 09:31 | right product | wrong product | variety |
| 6594 | 6594_6 | CEBOLA NOVA CNT KG (new onions, loose) | onions in orange mesh bags | 10:41, 11:47, 12:52, 14:02, 15:11, 16:22, 17:28, 18:30, 19:42 | right product | wrong product | bagged vs loose |

The team marks 6373_2 as wrong product in 12 of its 13 photos; André reviewed only the 16:11 one.

In the benchmark answer key (`eval/benchmark/labels_v1.json`, see `LEADERBOARD.md`) the clear mistakes are fixed and the photos waiting on a rule are not scored until the team decides.
