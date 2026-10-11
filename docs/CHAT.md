# The chat

The chat answers questions about the store with a screen: a sentence, a chart, a list of tasks, a
photo of a gondola. This page says what the model does, what it does not do, and how to change it.

## What the model does and does not do

The model does not draw anything and does not read the data. It gets a catalogue of parts the app
already has and writes a short program that picks some of them, in an order, with their arguments:

```
root = Answer([
  Text("These gondolas spent the most time with empty shelves."),
  Ranked("gondolas", 5),
  Tasks("restock", 3)
])
```

The app reads that program and draws the parts. Each part works out its own numbers from the store,
so the model never writes a figure. Most parts also lead somewhere: a row of tasks opens its gondola
with the area marked, and a block title opens the page of its product.

So the model composes a new screen for each question, but only from parts that exist. It cannot
invent a chart type, a number or a button that is not in the catalogue. It chooses and arranges, and
the app does everything else.

## The parts

| Part | Shows | Arguments |
|---|---|---|
| `Text` | One or two plain sentences | the text |
| `Callout` | A short note that stands apart: a caveat, or the one thing to act on | the text |
| `Metrics` | Headline figures for the store: time empty, right product in place, to restock, to move back | which of the four |
| `Ranked` | A ranking by how long things were empty, as bars | products or gondolas, how many |
| `Bars` | Columns comparing several products or gondolas on one scale | the ids to compare, or the worst |
| `Table` | Time empty, half full and wrong product for each product or gondola | products or gondolas, how many |
| `Trend` | A line over the hours of the day | a product and/or a gondola, or the whole store |
| `Mix` | How the time split between empty, half full and full | a product and/or a gondola, or the whole store |
| `Heat` | Products by hour, shaded by how much was empty | product keys, or the worst |
| `Tasks` | Rows of what to do now, each opening its gondola | restock or moveBack, how many |
| `Walk` | The round: the first gondolas to go to, in order, with what to carry, and a button that starts it on the phone | how many stops |
| `Where` | The gondolas that hold a product, with their photos | a product key |
| `Gondola` | The photo tile of one gondola and what it needs | a camera id |
| `Answer` | The whole answer: its parts, in reading order | the list of parts |

The parts live in `frontend/src/components/chat/library.tsx`.

## How a question travels

1. The chat sends the conversation and a system prompt to `/api/chat`.
2. The Vite dev server relays it to the model, so the key stays on the server.
3. The model streams back the program, and the chat draws each part as it arrives.
4. If the model cannot be reached, or answers nothing, the chat shows one plain sentence saying so.

The system prompt is built in `systemPromptFor` from the part catalogue, a handful of examples, the
rules below and the context of the store.

## What the model is told

The rules, in short:

- Answer in the language of the question and write as a colleague who has looked at the data, without
  naming parts or the app.
- Write no digit and no percentage, not even in a sentence. The parts carry the figures.
- Use two to four parts. Start with a sentence and, if it helps, end with a callout holding the one
  thing to act on.
- When an answer shows figures, charts or a ranking, end it with a note that it is estimated from
  about one photo an hour.
- Refer to products and gondolas by the keys listed. If the question names something that is not
  listed, say so and offer what exists. If it is not about the store, say so and suggest a question
  that is.

The context: every product key with its name, every gondola id with what is on it, which gondolas
hold each product, and the products and gondolas that were empty the longest.

## The model and what it costs

Any OpenAI-compatible endpoint works. Set it in `frontend/.env` (git-ignored):

```
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-flash
LLM_API_KEY=...
```

Measured on 11 October 2026 with `deepseek-flash`: one question uses about 3,100 tokens, around 2,900
going in (the prompt is most of it) and 190 coming out. Part of the prompt is cached by the provider
between questions. The price in money depends on the provider and was not worked out.

Dictation and reading aloud are separate and use `OPENAI_API_KEY`; see `frontend/README.md`.

## Limits to know about

- **Only in the dev server.** The relay is a Vite plugin that runs with `npm run dev`. The deployed
  landing does not have the chat; it shows a recorded clip. Without a key the chat button does not
  appear, and there are no offline answers.
- **The answer varies.** It is a language model. Asking what to restock first gave the old task list
  once and the round the next time. Try the demo questions a few times before presenting.
- **One day of data.** Everything comes from the photos of one day, about one an hour, so every figure
  is an estimate and the chat says so.
- **The panel is small.** A long answer scrolls inside it. The wide mode shows more.

## Questions to try

- What should I restock first?
- Give me the report of the day
- Which gondolas need attention?
- How are the bananas doing?
- Compare avocado and onion

## Adding a part

1. Define it in `library.tsx` with `defineComponent`: a name, a description the model reads, a `zod`
   schema of its arguments and the component. Take references (a key, an id), never a figure.
2. Add it to `parts` and to the `components` list of `createLibrary`. Missing from the second, it
   parses but draws nothing.
3. Do not name it like a function of the answer language. A part called `Round` came out as the
   number `3`, because `Round` rounds a number there.
4. Say when to use it in the part-choosing rule of `systemPromptFor`, and add an example if the model
   keeps choosing another part.
5. Try it with a real model on three or four phrasings of the question.
