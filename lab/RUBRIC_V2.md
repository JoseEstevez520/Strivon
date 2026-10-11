# Labelling rubric v2 (Sensei's own wording). Frozen: the same text for every labeller.

You label, for ONE camera at a time, every photo of that camera and every planogram area in it.
For each area give: stock_level in {empty, half, full}, planogram_compliant (true/false), conf 1-3 (1 = coin flip, 2 = fairly sure, 3 = clear),
or skip=true for a photo that cannot be judged.

The criterion comes from Sensei, who set the challenge and holds the hidden labels. Their words, literally:

> The "easiest" way to see it is: would someone be willing to buy the remaining products (if not is empty)? Would a staff take the time to replenish the shelf (if not is half empty)? In case of doubt it is better to under estimate rather than over estimate.

How to apply it, area by area, in this order:
1. Look at what is left in the area. Would a shopper be willing to buy the remaining products? If not, the answer is `empty`.
2. Otherwise, would a member of staff take the time to replenish this shelf? The second sentence has a typo; the only reading that gives three levels is: if staff would replenish it, it is `half`; if staff would not bother, it is `full`.
3. In case of doubt between two levels, choose the LOWER one (empty < half < full).

Notes:
- There are no numbers to count: do not apply "one or two units" or "one missing unit" rules, they are not Sensei's. Judge the way a shopper and a shelf-stocker would.
- The red polygon marks the area but the shelf the product sits in is what a shopper sees. Judge the crate/basket that holds the product named for the area; if two areas share one crate and the products differ, judge the part of the crate of the product named.
- Packed products (bags, trays, cartons) are judged by the same two questions.
- planogram_compliant: true unless you can CLEARLY see a different product than the one named (e.g. oranges where bananas are expected). An empty area is compliant. If unsure, true.
- skip=true: the display is hidden by a curtain (first photo of cameras 6383 and 6386), or the area is not visible at all. A hand, cart or person in front: judge what you can see and lower the confidence.
- Do not use the time of day or what you expect a shelf to look like at that hour. Judge only what the photo shows.

Output: one JSON file per labeller and camera with this exact shape:
{"<camera>": {"<photo file name .jpg>": {"<area_id>": {"stock_level": "...", "planogram_compliant": true, "conf": 2}}}}
Skipped areas: {"<area_id>": {"skip": true}}.
