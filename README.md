<p align="center">
  <img src="assets/partners/junctionx.png" alt="JunctionX Lisbon" height="64">
  &nbsp;&nbsp;&nbsp;
  <img src="assets/partners/sensei.png" alt="Sensei" height="64">
</p>

<h1 align="center">Strivon</h1>

<p align="center">
  <strong>Strivon looks at a shelf of fruit and vegetables and tells store staff which areas hold the wrong product and which ones need restocking.</strong>
</p>

<p align="center">
  Built for the Sensei challenge at JunctionX Lisbon 2026.
</p>

## What is Strivon?

Given an image from a ceiling camera and the store planogram, Strivon checks each shelf area: is
it holding the product it should, and how full is it?

## Layout

- `backend/` Python: the pipeline that writes the predictions.
- `frontend/` React and shadcn/ui: the view for store staff.
- `eval/` the scoring script and our own test labels.
- `assets/` logos and README images.
- `data/` and `outputs/` challenge images and generated predictions. Not committed.

## Credits

JunctionX Lisbon and Sensei logos belong to their owners and are used here to credit the event
and the challenge.
