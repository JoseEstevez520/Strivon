# What Sensei told us

Notes from the talk with Sensei on 10/10 and a later message from them.

## Stock levels

In the talk:

- `empty` is when you would go and restock. Their example was having one or two units left.

In their own words, later:

> The "easiest" way to see it is: would someone be willing to buy the remaining products (if not is empty)? Would a staff take the time to replenish the shelf (if not is half empty)? In case of doubt it is better to under estimate rather than over estimate.

How we read it:

- `empty`: nobody would buy what is left.
- The second question has a typo. The only reading that gives three levels is: if a member of staff would take the time to replenish, it is `half`; if they would not bother, it is `full`.
- In case of doubt, choose the lower level.
- So `full` is a shelf that staff would leave alone, not necessarily one filled to the brim.

The labelling tool says "full is completely full; one unit missing is already half". That sentence is the team's wording, it is not in what Sensei wrote above.

## Later answers on Discord (10/10, evening)

- **Only the image under analysis.** "You should only consider information from the image under analysis." We get the timestamp, but the model should learn from the image itself, not from the time of day. So the submission model may not look at the photos taken before or after.
- **An empty area is compliant.** Yes.
- **stock_level vs stock_value.** Redundant; either can be compared.
- **Cost is now judged.** Score is 80% performance and 20% processing cost ("cheaper is always better, but it should work"). Give an estimate of the cost per analysed image in the pitch. UI/UX still breaks ties.
- **The app must be shown** during the 3-minute presentation and Q&A.

## Answers on Discord (11/10, morning)

- **Validation images.** "The validation images will be provided after the submission, and they are images from the same cameras." So whatever we submit must already be set to the option we want: nobody sees a validation image before the choice is made.
- **Labels and compliance.** Asked whether we may calibrate on our AI-made labels, Sensei answered: "The labels you use should match the products in the planogram; otherwise, you won't get compliance." They added that they were not sure what "calibration" meant. That is neither a yes nor a no for AI-made labels.
- **Items that are not on the planogram** are "not planogram compliant".
- **Products that look the same apart from the label or the name** must still be told apart: "You have to train it." And: "You don't control what the retailer puts on each shelf or how they name each product. These are real labels from a real store." So a different variety or SKU in a crate counts as the wrong product, as the team already labels it.
