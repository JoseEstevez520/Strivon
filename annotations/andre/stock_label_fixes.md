# Stock label slips in `eval/labels.json`

How they were found, with no model involved:
- A crate's label jumps for one photo and comes straight back (full, half, full or half, full, half).
- The middle photo looks the same as the photos before and after (DINOv2 similarity of the crate crops).

The benchmark key had 56 such jumps. In 41 of them nothing visibly changed, and the team's own review had already fixed most of those. 11 were still in `eval/labels.json` at 98fe366. André re-checked these 11 in the labeller: 5 are slips, and 6 are real changes that stay as they are.

## Please change these 5 in `eval/labels.json`

| Camera | Image | Time (Lisbon) | Area | Now | Should be | Photo before | Photo after |
|---|---|---|---|---|---|---|---|
| 6383 | 1751029430.jpg | 14:03 | 6383_7 | half | **full** | 12:55 full | 15:04 full |
| 6385 | 1751005283.jpg | 07:21 | 6385_5 | half | **full** | 06:12 full | 08:21 full |
| 6491 | 1751021816.jpg | 11:56 | 6491_7 | full | **half** | 10:54 half | 12:58 half |
| 6491 | 1751021816.jpg | 11:56 | 6491_5 | full | **half** | 10:54 half | 12:58 half |
| 6781 | 1751009927.jpg | 08:38 | 6781_9 | full | **half** | 07:30 half | 09:45 half |

The same list is in `stock_label_fixes.json`.
