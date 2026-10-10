# Sensei Challenge — Plano (JunctionX Lisboa 2026)

Deadline: domingo. Objetivo: maximizar pontos na validação (máx 578) + melhor UI/UX para desempate.

## O que é avaliado (por área do planograma, 289 áreas)
| Campo | Certo | Errado |
|---|---|---|
| `planogram_compliant` | +1 | -2 |
| `stock_value` (0 / 0.5 / 1) | +1 | -2 se abaixo do real, **-3 se acima do real** |

Área em falta no output = -2 e -3. **Responder SEMPRE todas as áreas.**

### Consequência estratégica
- Sobrestimar stock custa mais (-3) que subestimar (-2): em caso de dúvida, escolher o nível mais baixo.
- Exemplo do PDF: ~93% compliant → default `planogram_compliant = true` só se houver evidência de erro dizer false.
- Decisão ótima por área: escolher a classe que minimiza a perda esperada, não a mais provável.

## Dados
- 14 câmaras, ~13 imagens/câmara (train+test, sem anotações), 1280x720, um dia inteiro de operação.
- `planogram.json`: 152 áreas com 4 cantos (quadriláteros em perspetiva, podem ter coords negativas).
- Validação escondida: 26 imagens, 289 áreas. Output no formato `{cam: {img.jpg: {area_id: {planogram_compliant, stock_level, stock_value}}}}`.

## Abordagem (sem labels)
1. **Recorte por área**: homografia (warp) de cada quadrilátero para retângulo; clamp a zonas fora da imagem.
2. **Classificação do produto** (compliant): zero-shot (CLIP/SigLIP ou VLM) comparando o crop com `product_name`.
3. **Nível de stock**: 
   - Calibração não supervisionada por área: ao longo do dia cada área tem imagens vazias/cheias → usar o crop mais "vazio" (fundo preto da gondola visível) e o mais "cheio" como âncoras; normalizar.
   - Features: fração de pixels que não são fundo/gondola, embeddings, contagem de blobs.
   - Opcional: VLM (Claude/Gemini) a classificar crop em empty/half/full.
4. **Otimização da decisão** com a matriz de custos (viés para baixo no stock).
5. **Pseudo-validação**: anotar à mão ~30-40 áreas (equipa) para medir o score com o scorer próprio.
6. **App/UI**: dashboard para staff (o que repor primeiro, o que mover) — critério de desempate.

## Tarefas / dono (a confirmar)
- [ ] Repo + estrutura (José)
- [ ] Pipeline de recortes por área + visualização dos polígonos (Miguel)
- [ ] Scorer local replicando as regras do PDF (Miguel)
- [ ] Anotação manual de ~40 áreas para pseudo-validação (Leonor + todos)
- [ ] Classificador de produto zero-shot (André)
- [ ] Estimador de stock (Miguel/José)
- [ ] UI/dashboard (José/Leonor design)
- [ ] Pitch + demo + README (Leonor/Miguel)
- [ ] Submissão no formato exigido (todos revêm antes)

## Notas do dataset
- Algumas imagens (ex.: a primeira de 6383, de madrugada) têm o expositor tapado por uma cortina: os crops são parede lisa. Precisamos de detetar "tapado" e decidir o output (provavelmente empty / compliant=true) — confirmar com imagens da validação se existirem.
- Alinhamento dos polígonos verificado visualmente em 6383 e 6468: bom.
