<p align="center">
  <img src="assets/logo.svg" alt="Strivon" width="104">
</p>

<h1 align="center">Strivon</h1>

<p align="center">
  <strong>Strivon turns ceiling-camera photos of the fruit and vegetable shelves into a list of work for store staff: what to restock and what to put back.</strong>
</p>

<p align="center">
  For a store with ceiling cameras and a shelf planogram.
</p>

<p align="center">
  <a href="https://strivon-landing.vercel.app"><img src="https://img.shields.io/badge/Website-strivon--landing.vercel.app-c4452f?style=flat-square&logo=googlechrome&logoColor=white" alt="Strivon website"></a>
  <a href="docs/APP.md"><img src="https://img.shields.io/badge/Docs-Read-1d1d1d?style=flat-square&logo=readthedocs&logoColor=white" alt="Strivon documentation"></a>
</p>

<p align="center">
  <a href="#run-it-locally">Run locally</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <img src="assets/readme/photo-to-tasks.png" alt="Three ceiling-camera photos with the shelf areas marked, on the left, and on the right a small store in 3D with four gondolas and the list of stops of the round, with what is wrong in each" width="100%">
</p>

<p align="center"><sub>Photos from the ceiling cameras in, a list of work out. The marks are the model's answers for the last photo of each camera.</sub></p>

## What is Strivon?

Fresh produce is where the state of a shelf matters most. An empty gondola is a lost sale, an
overstocked one ends in waste, and a product in the wrong place gets the wrong price. Today the
staff check this by walking the store.

A ceiling camera already sees every gondola, but loose, piled fruit with no barcode is hard for a
computer to read, and shoppers and staff hide it with their hands. Strivon takes the photo and the
store's planogram and checks each shelf area: does it hold the product it should, and how full is
it? What comes out is a list of work for the staff.

It was built for the Sensei challenge at JunctionX Lisbon 2026, with a day of photos from 14
cameras in an autonomous store in Leiria. We placed third in the Sensei challenge. On the test set Sensei gave us, our model scored
525 of 578 points.

## How it works

<p align="center">
  <img src="assets/presentation/graphics/diagrams/pipeline-en.png" alt="From a camera photo and the store planogram, each shelf area is checked with two questions, and the answers become tasks for the staff that show up in the plan, the round and the chat" width="100%">
</p>

For every shelf area in a photo, the pipeline answers two questions, and the app turns the answers
into tasks.

| Question | Answer | Task for the staff |
|---|---|---|
| Is the right product there? | yes or no | **Move back** when it is the wrong one |
| How full is the area? | empty, half full or full | **Restock** when empty, **Later** when half full, nothing when full |

The tasks are grouped by gondola so a round can be planned: the plan marks where the problems are,
and the list says what to carry to each stop. The challenge scores every area, so the pipeline is
tuned for those points as well as for the tasks. The scoring is in [`docs/PLAN.md`](docs/PLAN.md).

## What you can do today

- **See the round** for the whole store: which gondolas need something, in what order, and what to carry.
- **Open a gondola** to see its photo with what is wrong marked, and **play the day** to watch it change.
- **Look at the store** as a plan, a 3D model or photos, by product, or in the insights page.
- **Ask the store a question** and get a screen back. It needs a model key on the server.
- **Calibrate each product**: two handles set where empty ends and where full starts.
- **Check a validation set**, see [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md).
- **Predict and score a folder of photos** from the command line.

> **Status.** Without `outputs/predictions.json`, which `agents/predict.py` writes, the app shows simulated shelves.

## See it

The landing is at [strivon-landing.vercel.app](https://strivon-landing.vercel.app).

### The app for staff

Open the first page and the plan of the store shows which gondolas need something. The list beside
it gives the order of the round and what to bring to each stop. Press a gondola to see its shelf
with what is wrong marked, or play the day to watch both change.

### Generative UI

The chat answers with a screen. The model writes the layout of the answer out of the app's own
parts (charts, tables, tasks, a map of the day, photo cards) and the app draws it, so you can open
the answer and follow it to the shelf it talks about. It needs a model key on the server
(`LLM_API_KEY` in `frontend/.env`); without one the chat is hidden.

<p align="center">
  <img src="assets/video/chat-to-gondola.gif" alt="Someone asks where the bananas are. The chat answers with a chart of how the shelves emptied through the day and a card. Opening the card shows the gondola's photo with its shelf areas marked." width="80%">
</p>

The shelf states in the clip are sample data. The [full clip](assets/video/chat-to-gondola.mp4) and more are in [`assets/video`](assets/video).

## Run it locally

The app, with Node 20 or higher:

```bash
cd frontend
npm install
npm run dev
```

With the challenge data in `data/`, it shows the real photos and shelf areas. Without it, it draws
made-up shelves.

The pipeline, from `backend/`. Add `--no-clip` to skip PyTorch and use the classical features only:

```bash
python -m pip install -r requirements.txt
python -m sensei predict
python -m sensei score
```

By default `predict` reads `data/images` and writes `outputs/predictions.json`, and `score` checks
that file against `eval/labels.json`.

The steps for the day of the submission are in [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md).

## Documentation

Read more in the [`docs`](docs) folder, which covers the app, the chat, the scoring and the
validation day. The design of the interface is in [`frontend/DESIGN.md`](frontend/DESIGN.md), the
results are in [`LEADERBOARD.md`](LEADERBOARD.md) and the rules for contributing are in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Prior code

Written during the hackathon, except:

- `frontend/src/model/catalog.ts` ports the product family rules of `backend/sensei/catalog.py`.
- The models start from pretrained weights and libraries we did not write: DINOv2 (R3), CLIP (the backend crate model), SigLIP2 (the label-free mode) and MobileNetV3-small through `timm` (the lab model), on top of PyTorch, timm, NumPy, OpenCV and scikit-learn. The code that fine-tunes, fits and combines them was written here.
- The interface uses React, Vite, Tailwind CSS, shadcn/ui, Base UI, OpenUI, Lucide and
  country-flag-icons, all MIT. Versions are in `frontend/package.json`.

Built at JunctionX Lisbon 2026, for the Sensei challenge.

<p align="center">
  <img src="assets/partners/junctionx.png" alt="JunctionX Lisbon" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="assets/partners/sensei.png" alt="Sensei" height="56">
</p>

The code is under the [MIT license](LICENSE). The challenge photos and the JunctionX Lisbon and Sensei logos are not covered by it and belong to their owners.
