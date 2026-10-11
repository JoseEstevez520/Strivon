# "Full only when surer": forward files for the label-convention check

These are pre-registered by André's agents on 2026-10-11 at about 05:30 (Lisbon). They are not on the leaderboard (this folder is not globbed) and none of them is the submission.

- `R3_s{0,1}_H{k}.json`: the answers of R3 (`agents_R3_s0/s1.json`, the submission's recipe trained without each camera's last 2 photos), with p(full) multiplied by k before the expected-points decision. k ∈ {1, 0.7, 0.5, 0.35, 0.2, 0.1, 0.05}. In the two-class case, full then needs p_f above 0.57 / 0.66 / 0.73 / 0.79 / 0.87 / 0.93 / 0.96. The empty/half boundary does not depend on p_f, so it is untouched. `H1` gives the same answers as `agents_R3_s0/s1.json`. The answers come from the probabilities alone; no label was used.
- `agents_R3mix_s{0,1}.json`: R3 retrained on soft labels, 0.75 team + 0.125 N1 + 0.125 N2 (`lab/silver2`). `agents_R3ctl_s{0,1}.json` is its control from the same harness with team labels only. Its N-view scores are optimistic, because it trained on those passes.

Score one with `python eval/benchmark.py forward eval/benchmark/preds_forward/hedge/<file>`.

Our single forward read (05:37), stock points on 302 rows, s0 / s1, change against H1:

| level | team key 1221ec3 | CN (221 rows) |
|---|---|---|
| H1 (R3) | +183 / +185 | +48 / +43 |
| H0.5 | −18 / −1 | +11 / +17 |
| H0.35 | −38 / −15 | +21 / +34 |
| H0.2 | −62 / −50 | +26 / +25 |
| mix (vs its control) | +1 / +1 | +30 / +28 |

SHA-256 of the files as stored in git (LF line endings). The referee's log holds the hashes of the Windows (CRLF) copies, and they give the same answers.

```
5e08a450f5a6a5972272c61cc2efb3d35cc1db4c3d3df929363102f7735c619c  R3_s0_H0.05.json
d74d1381f82ed08e6dcefbfdea3351b13837ff2456d3a0ce634a9f3f9aeff96f  R3_s0_H0.1.json
04765e124ced7dd733dd13ae70e480b6869fb0cbf0a0d24abbd9af6898e4877b  R3_s0_H0.2.json
976addeeaf97298d740478f7a6b09fd81ef497ff6d81eb797cf11704f5653a41  R3_s0_H0.35.json
aab39a7a052b792bf131796e193d5bc5822ffe4a433213b0f3874adfa82b7339  R3_s0_H0.5.json
34761db947b1d82570de9b400957efdf5b72b63aa4f769f84421b8c00a55538d  R3_s0_H0.7.json
ad48bbdb3c47462c65dc03e5e7e7883e5ffe82a1385016b444253cdeb818cf6e  R3_s0_H1.json
6c9985653f9dca1af808c3ea580807639563d3afb998fe2f7ff68105df159d91  R3_s1_H0.05.json
33f02ed879b4a8de8f6b59dfded35cf06ad09b010c19c54586541d52d3771944  R3_s1_H0.1.json
56e551c581febe203fa06479c146c3b88fd72f7216a7ae18f1ee585c6f60541b  R3_s1_H0.2.json
f8ad8a57ce1360cadbdc04a2133f3a60b7ebbb03c5fb975a75db6f9e2466a229  R3_s1_H0.35.json
1a8a3a5eaede4a6d83af6a5bc93861e9e648f844376e08998dfb95c5125f774e  R3_s1_H0.5.json
ba6eeb6160e02dff97866d95b8a67fa609db99307246512348e8bb059c0a87a6  R3_s1_H0.7.json
c5b9c7af1c2187570a0b8fb93cfc273821f20b4f855e2e92fabda54b0ab672da  R3_s1_H1.json
adf651e4df320b3e57c3ba834a889b47bb9c91dc013a986018b52a57df62ebc1  agents_R3ctl_s0.json
e31ac2bb7382837bb50123fc70a223dd73fb4d9820e328617c460c03a744fbe1  agents_R3ctl_s1.json
234e741f19cf8651d75f4c8b77600878faee44079518ef843c8989eeec0c07cd  agents_R3mix_s0.json
af52aad4441a82ae2f4eff175881570398e68223225a9a0ace7a7d44ecc09ac1  agents_R3mix_s1.json
```
