<p align="center">
  <img src="assets/logo.svg" alt="Strivon" width="104">
</p>

<h1 align="center">Strivon</h1>

<p align="center">
  <strong>Strivon convierte las fotos de las cámaras de techo de las estanterías de fruta y verdura en una lista de trabajo para el personal de la tienda: qué reponer y qué devolver a su sitio.</strong>
</p>

<p align="center">
  Para una tienda con cámaras de techo y un planograma de estanterías.
</p>

<p align="center">
  <a href="https://strivon-landing.vercel.app"><img src="https://img.shields.io/badge/Web-strivon--landing.vercel.app-c4452f?style=flat-square&logo=googlechrome&logoColor=white" alt="Strivon"></a>
  <a href="docs/APP.md"><img src="https://img.shields.io/badge/Docs-Leer-1d1d1d?style=flat-square&logo=readthedocs&logoColor=white" alt="Docs"></a>
</p>

<p align="center">
  <a href="#ejecutarlo-en-local">Ejecutar en local</a> ·
  <a href="README.md">English</a> · <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <img src="assets/readme/photo-to-tasks.png" alt="Foto de una cámara de techo de una góndola de plátanos con sus zonas de estantería marcadas, y a su lado la lista de tareas que recibe el personal: tres zonas para reponer y dos para revisar más tarde" width="100%">
</p>

<p align="center"><sub>Una foto entra, una lista de trabajo sale. Los estados de las estanterías en esta imagen son simulados.</sub></p>

## ¿Qué es Strivon?

En una tienda nadie puede mirar todas las estanterías todo el día. Una se queda vacía, un producto acaba en el sitio de otro y el personal se entera cuando un cliente pregunta. Las cámaras de techo ya lo ven todo. Lo que falta es alguien que mire las fotos.

Strivon mira por ellas. A partir de una foto de cámara y del planograma de la tienda, comprueba cada zona de estantería: ¿tiene el producto que debe y cuánto está de llena? Lo que sale es una lista de trabajo para el personal, no un informe.

Se creó en JunctionX Lisboa 2026 para el reto de Sensei, con fotos de 14 cámaras.

## Cómo funciona

Para cada zona de estantería de una foto, el pipeline responde dos preguntas y la app convierte las respuestas en tareas.

| Pregunta | Respuesta | Tarea para el personal |
|---|---|---|
| ¿Está el producto correcto? | sí o no | **Devolver a su sitio** si es otro |
| ¿Cuánto está de llena la zona? | vacía, a medias o llena | **Reponer** si está vacía, **Más tarde** si está a medias, nada si está llena |

Cada tarea muestra el recorte de la zona y la hora de su foto, para comprobarla de un vistazo. El reto puntúa cada zona, así que el pipeline se ajusta a los puntos y también a las tareas: mira [`docs/PLAN.md`](docs/PLAN.md).

## Qué puedes hacer hoy

- **Ver qué hacer ahora**, agrupado en Reponer, Devolver a su sitio y Más tarde, por orden de urgencia.
- **Abrir una tarea** para ver la foto de su cámara con la zona marcada, y **reproducir el día** con la barra para ver cómo cambia la lista.
- **Recorrer la tienda** con un mapa de las góndolas, una página por góndola, una vista de productos y una página de análisis con la parte del tiempo que las estanterías estuvieron vacías.
- **Preguntarle algo a la tienda** y recibir la respuesta como una pantalla, con gráficas, tareas y tarjetas con foto. Necesita una clave de un modelo en el servidor.
- **Predecir una carpeta de fotos** desde la línea de comandos: un JSON con `planogram_compliant` y `stock_level` para cada zona.
- **Puntuar las predicciones** con nuestras propias etiquetas y los puntos del reto.

> **Estado.** La app todavía muestra estados de estantería simulados. Conectarla a las predicciones reales del pipeline es el siguiente paso.

## Verlo

La landing está en [strivon-landing.vercel.app](https://strivon-landing.vercel.app).

<br>

### La app para el personal

<img align="right" width="55%" src="assets/video/demo-tasks.gif" alt="La lista de tareas se llena mientras avanza el día: zonas vacías, a medias y productos fuera de su sitio. Al abrir una tarea se ve la foto de su cámara con la zona marcada.">

Cada zona de estantería que necesita algo se convierte en una tarea: reponer lo que está vacío, devolver a su sitio lo que está mal colocado y revisar más tarde lo que está a medias.

Reproduce el día para ver cómo se llena la lista, y abre una tarea para ver su estantería con la zona marcada.

<br clear="right">
<br>

### Pregunta y recibe una pantalla

<img align="right" width="55%" src="assets/video/chat-to-gondola.gif" alt="Alguien pregunta dónde están los plátanos. El chat responde con una gráfica de cómo se vaciaron las estanterías durante el día y una tarjeta. Al abrir la tarjeta se ve la foto de la góndola con sus zonas marcadas.">

El chat no responde con un párrafo. El modelo escribe el diseño de la respuesta con las piezas de la propia app (gráficas, tablas, tareas, un mapa del día, tarjetas con foto) y la app lo dibuja, así que la respuesta se puede abrir y seguir hasta la estantería de la que habla.

Necesita una clave de un modelo en el servidor (`LLM_API_KEY` en `frontend/.env`); sin ella el chat se oculta.

<br clear="right">
<br>

Los estados de las estanterías en los dos clips son simulados. Los vídeos en tamaño completo están en [`assets/video`](assets/video).

## Ejecutarlo en local

La app, con Node 20 o superior:

```bash
cd frontend
npm install
npm run dev
```

Con los datos del reto en `data/`, muestra las fotos y las zonas reales. Sin ellos, dibuja estanterías inventadas.

El pipeline, desde `backend/`. Añade `--no-clip` para saltarte PyTorch y usar solo los rasgos clásicos:

```bash
python -m pip install -r requirements.txt
python -m sensei predict
python -m sensei score
```

Por defecto, `predict` lee `data/images` y escribe `outputs/predictions.json`, y `score` comprueba ese fichero con `eval/labels.json`.

Los pasos del día de la entrega están en [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md).

## Documentación

- [`docs/APP.md`](docs/APP.md): qué muestra la app y los datos que lee.
- [`frontend/DESIGN.md`](frontend/DESIGN.md): cómo se ve la interfaz y el motivo de cada decisión.
- [`docs/PLAN.md`](docs/PLAN.md): cómo se puntúa el reto y el plan para puntuar bien.
- [`docs/SENSEI_INFO.md`](docs/SENSEI_INFO.md): lo que nos dijo Sensei, incluido qué significan vacío, medio y lleno.
- [`docs/VALIDATION_DAY.md`](docs/VALIDATION_DAY.md): cómo generar la entrega.
- [`LEADERBOARD.md`](LEADERBOARD.md): cómo se puntúa cada enfoque, y los resultados.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): ramas, commits e idioma.

## Resultados

Todos los enfoques se puntúan igual con el benchmark del equipo. Las reglas y las tablas están en [LEADERBOARD.md](LEADERBOARD.md) y en el [README en inglés](README.md#results).

## Código previo

Escrito durante el hackathon, salvo:

- `frontend/src/model/catalog.ts` porta las reglas de familias de producto de `backend/sensei/catalog.py`.
- La interfaz usa React, Vite, Tailwind CSS, shadcn/ui, Base UI, OpenUI, Lucide y
  country-flag-icons, todos MIT. Las versiones están en `frontend/package.json`.

Hecho en JunctionX Lisboa 2026, para el reto de Sensei.

<p align="center">
  <img src="assets/partners/junctionx.png" alt="JunctionX Lisbon" height="56">
  &nbsp;&nbsp;&nbsp;
  <img src="assets/partners/sensei.png" alt="Sensei" height="56">
</p>

Los logotipos de JunctionX Lisboa y de Sensei pertenecen a sus propietarios.
