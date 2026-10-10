# Tarefas por pessoa

Deadline: domingo. Score = soma por área (máx 578). Ver `docs/PLAN.md` para a estratégia.
Regra de ouro: trabalhar em branch própria (`nome/tema`), PR para `main`, commits com a conta de cada um.

## Estado atual (já feito)
- `backend/crops.py`: recorte por homografia de cada área.
- `backend/baseline.py`: stock por cor (calibrado por área ao longo do dia) + compliant=true.
- `eval/score.py`: scorer com as regras do PDF.
- `backend/debug_view.py`: desenha o stock previsto numa imagem.
- Limites conhecidos: produtos pouco coloridos (ananás) saem "empty"; em algumas câmaras (ex. 6468)
  aparece produto diferente do planograma, por isso compliant não pode ser sempre true.

## Miguel — pipeline de IA (core do score)
1. Classificador de produto por área (VLM ou CLIP/SigLIP) para `planogram_compliant`. Depende de a organização permitir APIs externas.
2. Estimador de stock melhorado (vazio/meio/cheio) e decisão com a matriz de custos (viés para baixo).
3. Tratamento de imagens com cortina/oclusões por mãos.
4. Gerar o ficheiro final de submissão no formato exigido.

## José — app e integração
1. `backend/`: API (FastAPI) que lê `outputs/predictions.json` e serve por câmara/imagem/área.
2. `frontend/`: vista para staff: lista priorizada "repor primeiro / mover para o sítio / ok", mapa da gondola com as áreas coloridas sobre a imagem. É o desempate, mas tem de ser clara em 5 segundos.
3. Deploy (Vercel) e link para a demo.

## André — avaliação e dados (segundo cérebro técnico)
1. Ferramenta de anotação rápida (script ou página simples): mostra o recorte + produto esperado e grava `empty/half/full` e `compliant` em `eval/labels.json`. A Leonor usa-a.
2. Corre o scorer sobre `eval/labels.json` e mostra score por câmara e por tipo de erro (above/below/ident) — onde se perdem pontos.
3. Ajuste de thresholds do baseline (`EMPTY_BELOW`, `HALF_BELOW` em `baseline.py`) com essas labels.
4. Investigar as imagens: lista de imagens com cortina, oclusão por pessoas, e câmaras onde o planograma não bate certo.

## Leonor — anotação, produto e pitch (sem código pesado)
1. Anotar ~40-60 áreas à mão com a ferramenta do André: variadas por câmara e hora, incluindo casos difíceis. É a nossa "validação" e vale pontos diretos.
2. Escrever o pitch (problema, solução, impacto: menos desperdício, menos ruturas, auditoria sem pessoas) e o guião da demo (2-3 min).
3. Design: protótipo (Figma ou papel) do ecrã do staff para o José implementar; logo/nome Strivon e slides.
4. README final e vídeo da demo.

## Prazos sugeridos
- Sábado manhã: labels da Leonor + app a ler predictions.json.
- Sábado noite: classificador de produto integrado e score medido nas labels.
- Domingo manhã: congelar modelo, gerar submissão, ensaiar pitch. Nada novo depois disto.
