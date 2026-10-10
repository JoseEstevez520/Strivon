# Sensei · Frutas e Legumes — monitorização de gôndolas

Aplicação para o desafio Sensei (JunctionX Lisboa 2026): a partir das câmaras de teto, diz para **cada área do planograma** se tem o produto certo e se está **vazia / a meio / cheia**, e mostra ao staff **o que fazer primeiro**.

- Funciona **sem etiquetas** (CLIP zero-shot + aprendizagem não supervisionada por câmara).
- Decide com a **matriz de pontos do desafio** (sobrestimar stock custa −3, subestimar −2): escolhe o nível com mais pontos esperados, não o mais provável.
- Tem um **dashboard para o staff** (PT-PT) e uma **ferramenta de anotação** que alimenta um avaliador local e uma calibração opcional.

## Arranque rápido

O dataset não está no repositório (é do desafio). Descompactar o zip oficial para que fique `data/planogram.json` e `data/images/<câmara>/<timestamp>.jpg`.

```bash
python -m pip install -r requirements.txt
```

```bash
python -m sensei predict
```

```bash
python -m sensei serve
```

Abrir http://127.0.0.1:8000 (ou duplo clique em `run_app.bat`; usa `--host 0.0.0.0` para a equipa anotar a partir de outros PCs na mesma rede).

A primeira previsão demora ~8 min (descarrega o modelo CLIP, ~600 MB, e extrai features de 181 imagens em CPU). Depois fica em cache em `outputs/cache/` e demora segundos.

## Dia da validação (submissão)

1. Colocar as imagens de validação numa pasta com a mesma estrutura: `<pasta>/<câmara>/<timestamp>.jpg`.
2. Correr (as imagens de treino/teste entram como *contexto* não etiquetado — ajudam o modelo a saber como é cada área vazia/cheia ao longo do dia):

```bash
python -m sensei predict --images CAMINHO/validacao --context data/images --out outputs/submission_validacao.json
```

3. O comando valida o formato (todas as áreas de cada imagem, `stock_value` coerente com `stock_level`, booleanos) e falha com aviso se faltar algo — uma área em falta custa −5.
4. Se a pasta vier sem subpastas por câmara, usar `--camera 6215` por pasta.

## Comandos

| Comando | O que faz |
|---|---|
| `python -m sensei predict` | Prevê todas as áreas de todas as imagens → `outputs/submission.json` (formato oficial) + `outputs/details.json` (probabilidades, para a app) |
| `python -m sensei serve` | Dashboard + anotação |
| `python -m sensei score --gt annotations/team.json` | Pontuação com as regras do desafio |
| `python -m sensei calibrate` | Ajusta um pequeno modelo às anotações da equipa (validação cruzada; só grava se melhorar) |
| `python -m sensei vlm-label` | Opcional: etiqueta imagens com Claude (visão) — precisa de `ANTHROPIC_API_KEY` |
| `python -m sensei predict --no-clip` | Só features clássicas (sem PyTorch) |

## A app

- **Tarefas** — vista de início de turno: 1) *Repor já* (vazias), 2) *Arrumar produto* (planograma não cumprido), 3) *Repor em breve* (a meio). Cada cartão tem o recorte da área, onde fica, desde quando está assim e quantas áreas do mesmo produto estão vazias. "Feito" marca localmente.
- **Gôndolas** — imagem de cada câmara com as áreas coloridas pelo estado; clicar numa área abre o detalhe com a evolução ao longo do dia e o porquê da decisão.
- **Produtos** — stock somado por produto (todas as áreas), do mais crítico para o menos.
- **Relógio** (topo) — ver o estado da loja a qualquer hora do dia.
- **Anotar** — teclado: `1/2/3` vazio/meio/cheio, `X` produto errado, `Enter` aceitar previsão, `←/→` área, `N/P` imagem. Grava em `annotations/team.json` no formato oficial.
- **Avaliação** — pontuação nas áreas anotadas (mesma tabela do enunciado), erros piores primeiro, botão para calibrar e voltar a prever, exportar submissão.

## Como funciona

```
imagem ──► recorte retificado por área (homografia; áreas com coords negativas tratadas com máscara)
       ──► features: histograma HSV, cor/textura, embedding CLIP (ViT-B-16, CPU)
       ──► STOCK: CLIP "vazio/meio/cheio de <produto>"  +  fração de contentor visível
                  (aprende a cor do contentor vazio por câmara a partir dos recortes que o CLIP
                   tem a certeza que estão vazios, e a cor do produto a partir dos mais cheios)
       ──► PRODUTO: texto CLIP por família + protótipos de imagem por família construídos com o
                    próprio planograma como etiqueta fraca; prior de 93% de conformidade;
                    trocas entre famílias visualmente indistinguíveis (Gala vs Fuji) nunca são assinaladas
       ──► DECISÃO: argmax dos pontos esperados (matriz +1/−2/−3)
```

Código: `sensei/` (pipeline), `app/` (servidor FastAPI + frontend sem build).

| Ficheiro | Conteúdo |
|---|---|
| `sensei/catalog.py` | nome PT → família, descrição EN, embalado ou a granel, nome curto |
| `sensei/geometry.py` | retificação dos quadriláteros, clipping |
| `sensei/extract.py` | descoberta de imagens, features, cache |
| `sensei/models.py` | modelo sem etiquetas (stock + conformidade) |
| `sensei/decision.py` | decisão com custos assimétricos |
| `sensei/scoring.py` | avaliador com as regras oficiais |
| `sensei/calibrate.py` | calibração opcional com anotações |
| `sensei/vlm.py` | professor Claude opcional |

## Limitações conhecidas (vistas nas imagens de treino)

- Embalagens cinzentas/transparentes (kiwis 6376, uvas/cerejas 6462) às vezes parecem "vazio" ao CLIP.
- Prateleiras brancas sem caixa (6462 de manhã) nem sempre são reconhecidas como vazias.
- Produtos embalados com rótulos coloridos geram alguns falsos "produto errado" (ex.: 6462_5/6, 6468_5).
- Os limiares foram escolhidos a olho; a calibração com ~300+ áreas anotadas deve corrigir boa parte disto.
