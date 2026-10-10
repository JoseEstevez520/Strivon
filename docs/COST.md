# Cost per analysed image

Sensei added processing cost to the judging: 80% performance, 20% cost ("cheaper is always better,
but it should work"). The pitch must give a cost per analysed image. This is how we get ours.

## Method

Cost per image = seconds of compute per photo × price of that compute per second.

- Measure seconds end to end on one photo (crops + model + decision), after the model is loaded,
  e.g. `python backend/timing.py` for the CLIP models.
- Price a CPU second from a small cloud VM: 2 vCPUs at about $0.09 per hour (e.g. AWS c7i.large,
  on demand, eu-west), so $0.000025 per second of the whole machine. A GPU second from an NVIDIA T4
  VM at about $0.53 per hour, so $0.00015 per second.
- A photo covers 6 to 16 areas (11 on average), so divide by 11 for a cost per area.

## Candidates (benchmark labels_v1, only the photo under analysis)

| Model | Score / 3858 | ≈ / 578 | Seconds per photo | Cost per image | Per 1000 photos |
|---|---:|---:|---|---:|---:|
| Lab ensemble (Jose): pixel features + slot references + small MobileNetV3 | 3341 | 501 | about 0.2 CPU | about $0.000005 | about $0.005 |
| One DINOv2-small pass (André), stock + product | 3349 | 502 | 0.82 CPU (4 threads) | about $0.00002 | about $0.02 |
| CLIP ViT-B-32 on the crate (Miguel) | 3255 | 488 | 0.9-1.4 CPU | about $0.00003 | about $0.03 |
| Fine-tuned DINOv2-base stock + DINOv2-small product (André) | 3393 | 508 | 6.7 CPU, or 0.26 GPU | about $0.00017 CPU, $0.00004 GPU | about $0.17 / $0.04 |

For scale: a vision LLM API call per photo costs roughly $0.001 to $0.01, 50 to 2000 times more.
None of our candidates needs a GPU or an API.

## A store

14 cameras, one photo a minute, 14 hours a day = about 11,800 photos a day.
With the lab ensemble: about $0.06 a day. With the DINOv2-base model on CPU: about $2 a day.

## Pitch line

"Each photo costs about two thousandths of a cent to analyse on a plain CPU, no GPU and no API: a
whole store, every minute, all day, for a few cents."
(Use the row of the model we actually submit.)
