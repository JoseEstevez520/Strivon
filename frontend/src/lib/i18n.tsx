import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { FAMILIES } from '@/model/families'

export type Lang = 'en' | 'pt' | 'es'
export const LANGS: Lang[] = ['en', 'pt', 'es']

interface Strings {
  headline: (n: number) => string
  photoFrom: (time: string) => string
  camera: string
  language: string
  day: string
  play: string
  pause: string
  restock: string
  moveBack: string
  later: string
  allGood: string
  empty: string
  half: string
  wrongPlace: (seen: string) => string
  inPlaceOf: (expected: string) => string
  since: (time: string) => string
  areasFine: (n: number) => string
  level: Record<'empty' | 'half' | 'full', string>
  throughDay: string
  close: string
  allCameras: string
  navTasks: string
  navGondolas: string
  navProducts: string
  gondolasHeadline: (n: number) => string
  productsHeadline: (n: number) => string
  productsToRestock: (n: number) => string
  showFine: (n: number) => string
  onShelf: (percent: number) => string
  bringTo: string
  putBackIn: string
  searchProducts: string
  shortOf: (short: number, total: number) => string
  allGondolas: string
  all: string
  filterState: string
  gondolaN: (n: number) => string
  loading: string
  navInsights: string
  navMap: string
  viewAs: string
  planHeadline: (n: number) => string
  goFirst: string
  toBring: string
  roundStart: string
  roundStop: (n: number, total: number) => string
  roundLoad: string
  roundLoadNote: string
  leaveHere: string
  pickUp: string
  takeTo: (gondola: string) => string
  takeBack: string
  fromGondola: (gondola: string) => string
  previous: string
  next: string
  roundDone: string
  roundDoneNote: string
  openOnPhone: string
  bringFromBack: string
  putBackHeading: string
  thenGo: string
  bring: string
  emptySince: (time: string) => string
  insightsHeadline: (pct: number) => string
  insightsPeriod: (date: string, from: string, to: string) => string
  insightsSimulatedShort: string
  insightsEstimate: string
  insightsPeak: (hour: string, pct: number) => string
  worstAt: (hours: string) => string
  insightsSimulated: string
  mapTitle: string
  mapCell: (product: string, hour: string, pct: number) => string
  mapLess: string
  mapMore: string
  worstProducts: string
  worstGondolas: string
  metrics: Record<'empty' | 'compliance' | 'restock' | 'moveBack', string>
  wholeStore: string
  trendTitle: (name: string) => string
  mixTitle: (name: string) => string
  wrongProduct: string
  colName: string
  colEmpty: string
  colHalf: string
  colWrong: string
  complianceLine: (pct: number) => string
  askTitle: string
  askPlaceholder: string
  send: string
  thinking: string
  latest: string
  chatFailed: string
  dictate: string
  dictateStop: string
  transcribing: string
  readAloudOn: string
  readAloudOff: string
  micDenied: string
  micMissing: string
  voiceFailed: string
  larger: string
  smaller: string
  suggestions: string[]
  orderNote: string
  showMore: (n: number) => string
  showAll: (n: number) => string
  showFewer: string
  withProduct: (names: string) => string
  noMatches: string
  areasCount: (n: number) => string
  plan: {
    title: string
    department: string
    anotherMoment: string
    hideMoment: string
    entrance: string
    aisle: (n: number) => string
    stop: (n: number) => string
    show: (name: string) => string
    fine: string
    nothingHere: string
    fineCount: (n: number) => string
    allFine: string
    otherAreas: string
    nothingToDo: string
    areaLabel: (name: string, state: string) => string
    moreItems: (n: number) => string
    spot: (top: boolean, n: number) => string
  }
}

const en: Strings = {
  level: { empty: 'Empty', half: 'Half full', full: 'Full' },
  throughDay: 'Through the day',
  close: 'Close',
  allCameras: 'All cameras',
  navTasks: 'Tasks',
  navGondolas: 'Gondolas',
  navProducts: 'Products',
  gondolasHeadline: (n) => (n === 0 ? 'Every gondola is fine' : n === 1 ? 'One gondola needs attention' : `${n} gondolas need attention`),
  productsHeadline: (n) => (n === 1 ? 'One product' : `${n} products`),
  productsToRestock: (n) => (n === 0 ? 'Nothing to restock' : n === 1 ? 'One product to restock' : `${n} products to restock`),
  showFine: (n) => `Show ${n} fine`,
  onShelf: (p) => `${p}% on the shelves`,
  bringTo: 'Bring to',
  putBackIn: 'Put back in',
  searchProducts: 'Search products',
  shortOf: (s, n) => (s === 0 ? 'All fine' : n === 1 ? 'Short' : `${s} of ${n} areas short`),
  allGondolas: 'All gondolas',
  all: 'All',
  filterState: 'State',
  gondolaN: (n) => `Gondola ${n}`,
  loading: 'Checking the shelves…',
  navInsights: 'Insights',
  navMap: 'Map',
  viewAs: 'View',
  planHeadline: (n) => (n === 0 ? 'Every gondola is fine' : n === 1 ? '1 gondola needs attention' : `${n} gondolas need attention`),
  goFirst: 'Go first',
  toBring: 'To bring',
  roundStart: 'Start the round',
  roundStop: (n, total) => `Stop ${n} of ${total}`,
  roundLoad: 'Load up',
  roundLoadNote: 'Take this from the back room before you go',
  leaveHere: 'Leave here',
  pickUp: 'Pick up here',
  takeTo: (g) => `Take to ${g}`,
  takeBack: 'Take back to the back room',
  fromGondola: (g) => `from ${g}`,
  previous: 'Previous',
  next: 'Next',
  roundDone: 'That is the round',
  roundDoneNote: 'New photos arrive every hour and update the list.',
  openOnPhone: 'Open on your phone',
  bringFromBack: 'Bring from the back',
  putBackHeading: 'Put back in its place',
  thenGo: 'Then',
  bring: 'Bring',
  emptySince: (time) => `Empty since ${time}`,
  insightsHeadline: (p) => `~${p}% of shelf time was empty`,
  insightsPeriod: (d, a, b) => `${d} · ${a}–${b}`,
  insightsSimulatedShort: 'simulated',
  insightsEstimate: 'Estimated from about 13 photos per camera.',
  insightsPeak: (h, p) => `Most empty at ${h}, with ${p}% of the areas`,
  worstAt: (h) => `worst at ${h}`,
  insightsSimulated: 'Provisional: the stock states are simulated.',
  mapTitle: 'Stock over time',
  mapCell: (p, hour, pct) => `${p}, ${hour}: ${pct}% of its areas empty`,
  mapLess: 'None',
  mapMore: 'All empty',
  worstProducts: 'Products empty the longest',
  worstGondolas: 'Gondolas empty the longest',
  metrics: { empty: 'Shelf time empty', compliance: 'Right product in place', restock: 'To restock', moveBack: 'To move back' },
  wholeStore: 'The whole store',
  trendTitle: (n) => `${n}: share of areas empty, by hour`,
  mixTitle: (n) => `${n}: how shelf time split`,
  wrongProduct: 'Wrong product',
  colName: 'Name',
  colEmpty: 'Empty',
  colHalf: 'Half full',
  colWrong: 'Wrong product',
  complianceLine: (p) => `${p}% of the time, areas held the product the planogram expects`,
  askTitle: 'Ask about your store',
  askPlaceholder: 'Ask about your store',
  send: 'Send',
  thinking: 'Thinking',
  latest: 'Go to the latest',
  chatFailed: 'The assistant did not answer. Try again.',
  dictate: 'Dictate a question',
  dictateStop: 'Stop recording',
  transcribing: 'Transcribing',
  readAloudOn: 'Read answers aloud',
  readAloudOff: 'Stop reading aloud',
  micDenied: 'Microphone blocked. Allow it in the browser.',
  micMissing: 'No microphone found.',
  voiceFailed: 'Could not hear that. Try again.',
  larger: 'Make it larger',
  smaller: 'Make it smaller',
  suggestions: ['Which gondolas need attention?', 'How are the bananas doing?', 'How much of the time were areas empty?', 'What should I restock first?', 'Give me the report of the day'],
  orderNote: 'Most urgent first: what is out in most places, then what has waited longest.',
  showMore: (n) => `Show ${n} more`,
  showAll: (n) => `Show ${n}`,
  showFewer: 'Show fewer',
  withProduct: (x) => `with ${x}`,
  noMatches: 'Nothing matches',
  areasCount: (n) => (n === 1 ? '1 area' : `${n} areas`),
  plan: {
    title: 'Store map',
    department: 'Fruit and vegetables',
    anotherMoment: 'See another moment',
    hideMoment: 'Back to now',
    entrance: 'Entrance',
    aisle: (n) => `Aisle ${n}`,
    stop: (n) => `Stop ${n}`,
    show: (name) => `Show ${name}`,
    fine: 'Fine',
    nothingHere: 'Nothing to fix here',
    fineCount: (n) => `${n} fine`,
    allFine: 'All fine',
    otherAreas: 'The rest of the shelf',
    nothingToDo: 'Every gondola is fine',
    areaLabel: (name, state) => `${name}, ${state}`,
    moreItems: (n) => `+${n}`,
    spot: (top, n) => `${top ? 'Top' : 'Bottom'} shelf, ${n} from the left`,
  },
  headline: (n) => (n === 0 ? 'Nothing to do right now' : n === 1 ? 'One thing to do now' : `${n} things to do now`),
  photoFrom: (t) => `Photos up to ${t}`,
  camera: 'Camera',
  language: 'Language',
  day: 'Day',
  play: 'Play the day',
  pause: 'Pause',
  restock: 'Restock',
  moveBack: 'Move back',
  later: 'Later',
  allGood: 'All good',
  empty: 'Empty',
  half: 'Half full',
  wrongPlace: (seen) => `Looks like ${seen}`,
  inPlaceOf: (x) => `in the place of ${x}`,
  since: (t) => `since ${t}`,
  areasFine: (n) => `${n} areas`,
}

const pt: Strings = {
  level: { empty: 'Vazio', half: 'A meio', full: 'Cheio' },
  throughDay: 'Ao longo do dia',
  close: 'Fechar',
  allCameras: 'Todas as câmaras',
  navTasks: 'Tarefas',
  navGondolas: 'Gôndolas',
  navProducts: 'Produtos',
  gondolasHeadline: (n) => (n === 0 ? 'Todas as gôndolas estão bem' : n === 1 ? 'Uma gôndola precisa de atenção' : `${n} gôndolas precisam de atenção`),
  productsHeadline: (n) => (n === 1 ? 'Um produto' : `${n} produtos`),
  productsToRestock: (n) => (n === 0 ? 'Nada para repor' : n === 1 ? 'Um produto para repor' : `${n} produtos para repor`),
  showFine: (n) => `Mostrar ${n} em ordem`,
  onShelf: (p) => `${p}% nas prateleiras`,
  bringTo: 'Levar para',
  putBackIn: 'Devolver em',
  searchProducts: 'Procurar produtos',
  shortOf: (s, n) => (s === 0 ? 'Tudo bem' : n === 1 ? 'Em falta' : `${s} de ${n} áreas em falta`),
  allGondolas: 'Todas as gôndolas',
  all: 'Todos',
  filterState: 'Estado',
  gondolaN: (n) => `Gôndola ${n}`,
  loading: 'A verificar as prateleiras…',
  navInsights: 'Análise',
  navMap: 'Mapa',
  viewAs: 'Vista',
  planHeadline: (n) => (n === 0 ? 'Todas as gôndolas estão bem' : n === 1 ? '1 gôndola precisa de atenção' : `${n} gôndolas precisam de atenção`),
  goFirst: 'Vai primeiro',
  toBring: 'Para trazer',
  roundStart: 'Começar a ronda',
  roundStop: (n, total) => `Paragem ${n} de ${total}`,
  roundLoad: 'Carregar',
  roundLoadNote: 'Leve isto do armazém antes de sair',
  leaveHere: 'Deixar aqui',
  pickUp: 'Recolher aqui',
  takeTo: (g) => `Levar para ${g}`,
  takeBack: 'Devolver ao armazém',
  fromGondola: (g) => `de ${g}`,
  previous: 'Anterior',
  next: 'Seguinte',
  roundDone: 'A ronda está feita',
  roundDoneNote: 'Chegam fotos novas todas as horas e a lista atualiza.',
  openOnPhone: 'Abrir no telemóvel',
  bringFromBack: 'Trazer do armazém',
  putBackHeading: 'Devolver ao seu lugar',
  thenGo: 'Depois',
  bring: 'Levar',
  emptySince: (time) => `Vazio desde as ${time}`,
  insightsHeadline: (p) => `~${p}% do tempo de prateleira esteve vazio`,
  insightsPeriod: (d, a, b) => `${d} · ${a}–${b}`,
  insightsSimulatedShort: 'simulado',
  insightsEstimate: 'Estimado com cerca de 13 fotos por câmara.',
  insightsPeak: (h, p) => `Mais vazio às ${h}, com ${p}% das áreas`,
  worstAt: (h) => `pior às ${h}`,
  insightsSimulated: 'Provisório: os estados de stock são simulados.',
  mapTitle: 'Stock ao longo do tempo',
  mapCell: (p, hour, pct) => `${p}, ${hour}: ${pct}% das áreas vazias`,
  mapLess: 'Nenhuma',
  mapMore: 'Todas vazias',
  worstProducts: 'Produtos vazios há mais tempo',
  worstGondolas: 'Gôndolas vazias há mais tempo',
  metrics: { empty: 'Tempo de prateleira vazia', compliance: 'Produto certo no sítio', restock: 'Para repor', moveBack: 'Para devolver ao sítio' },
  wholeStore: 'A loja toda',
  trendTitle: (n) => `${n}: parte das áreas vazias, por hora`,
  mixTitle: (n) => `${n}: como se repartiu o tempo`,
  wrongProduct: 'Produto errado',
  colName: 'Nome',
  colEmpty: 'Vazio',
  colHalf: 'A meio',
  colWrong: 'Produto errado',
  complianceLine: (p) => `${p}% do tempo, as áreas tinham o produto que o planograma espera`,
  askTitle: 'Pergunte sobre a sua loja',
  askPlaceholder: 'Pergunte sobre a sua loja',
  send: 'Enviar',
  thinking: 'A pensar',
  latest: 'Ir para a última',
  chatFailed: 'O assistente não respondeu. Tenta outra vez.',
  dictate: 'Ditar uma pergunta',
  dictateStop: 'Parar a gravação',
  transcribing: 'A transcrever',
  readAloudOn: 'Ler respostas em voz alta',
  readAloudOff: 'Parar a leitura em voz alta',
  micDenied: 'Microfone bloqueado. Permite-o no navegador.',
  micMissing: 'Nenhum microfone encontrado.',
  voiceFailed: 'Não deu para ouvir. Tenta outra vez.',
  larger: 'Aumentar',
  smaller: 'Reduzir',
  suggestions: ['Que gôndolas precisam de atenção?', 'Como estão as bananas?', 'Que parte do tempo estiveram as áreas vazias?', 'O que devo repor primeiro?', 'Dá-me o relatório do dia'],
  orderNote: 'O mais urgente primeiro: o que falta em mais sítios e, depois, o que espera há mais tempo.',
  showMore: (n) => `Mostrar mais ${n}`,
  showAll: (n) => `Mostrar ${n}`,
  showFewer: 'Mostrar menos',
  withProduct: (x) => `com ${x}`,
  noMatches: 'Nada encontrado',
  areasCount: (n) => (n === 1 ? "1 área" : `${n} áreas`),
  plan: {
    title: 'Mapa da loja',
    department: 'Frutas e legumes',
    anotherMoment: 'Ver outro momento',
    hideMoment: 'Voltar a agora',
    entrance: 'Entrada',
    aisle: (n) => `Corredor ${n}`,
    stop: (n) => `Paragem ${n}`,
    show: (name) => `Mostrar ${name}`,
    fine: 'Bem',
    nothingHere: 'Nada a corrigir aqui',
    fineCount: (n) => `${n} bem`,
    allFine: 'Tudo bem',
    otherAreas: 'O resto da prateleira',
    nothingToDo: 'Todas as gôndolas estão bem',
    areaLabel: (name, state) => `${name}, ${state}`,
    moreItems: (n) => `+${n}`,
    spot: (top, n) => `${top ? 'Prateleira de cima' : 'Prateleira de baixo'}, ${n} a contar da esquerda`,
  },
  headline: (n) => (n === 0 ? 'Nada a fazer agora' : n === 1 ? 'Uma coisa a fazer agora' : `${n} coisas a fazer agora`),
  photoFrom: (t) => `Fotos até às ${t}`,
  camera: 'Câmara',
  language: 'Idioma',
  day: 'Dia',
  play: 'Ver o dia',
  pause: 'Pausar',
  restock: 'Repor',
  moveBack: 'Arrumar',
  later: 'Mais tarde',
  allGood: 'Tudo bem',
  empty: 'Vazio',
  half: 'A meio',
  wrongPlace: (seen) => `Parece ${seen}`,
  inPlaceOf: (x) => `no lugar de ${x}`,
  since: (t) => `desde as ${t}`,
  areasFine: (n) => `${n} áreas`,
}

const es: Strings = {
  level: { empty: 'Vacío', half: 'A medias', full: 'Lleno' },
  throughDay: 'A lo largo del día',
  close: 'Cerrar',
  allCameras: 'Todas las cámaras',
  navTasks: 'Tareas',
  navGondolas: 'Góndolas',
  navProducts: 'Productos',
  gondolasHeadline: (n) => (n === 0 ? 'Todas las góndolas están bien' : n === 1 ? 'Una góndola necesita atención' : `${n} góndolas necesitan atención`),
  productsHeadline: (n) => (n === 1 ? 'Un producto' : `${n} productos`),
  productsToRestock: (n) => (n === 0 ? 'Nada que reponer' : n === 1 ? 'Un producto que reponer' : `${n} productos que reponer`),
  showFine: (n) => `Mostrar ${n} en orden`,
  onShelf: (p) => `${p}% en las estanterías`,
  bringTo: 'Llevar a',
  putBackIn: 'Devolver en',
  searchProducts: 'Buscar productos',
  shortOf: (s, n) => (s === 0 ? 'Todo bien' : n === 1 ? 'Con falta' : `${s} de ${n} zonas con falta`),
  allGondolas: 'Todas las góndolas',
  all: 'Todos',
  filterState: 'Estado',
  gondolaN: (n) => `Góndola ${n}`,
  loading: 'Revisando las estanterías…',
  navInsights: 'Análisis',
  navMap: 'Mapa',
  viewAs: 'Vista',
  planHeadline: (n) => (n === 0 ? 'Todas las góndolas están bien' : n === 1 ? '1 góndola necesita atención' : `${n} góndolas necesitan atención`),
  goFirst: 'Ve primero',
  toBring: 'Para traer',
  roundStart: 'Empezar la ronda',
  roundStop: (n, total) => `Parada ${n} de ${total}`,
  roundLoad: 'Cargar',
  roundLoadNote: 'Coge esto del almacén antes de salir',
  leaveHere: 'Dejar aquí',
  pickUp: 'Recoger aquí',
  takeTo: (g) => `Llevar a ${g}`,
  takeBack: 'Devolver al almacén',
  fromGondola: (g) => `de ${g}`,
  previous: 'Anterior',
  next: 'Siguiente',
  roundDone: 'La ronda está hecha',
  roundDoneNote: 'Cada hora llegan fotos nuevas y la lista se actualiza.',
  openOnPhone: 'Abrir en el móvil',
  bringFromBack: 'Traer del almacén',
  putBackHeading: 'Devolver a su sitio',
  thenGo: 'Después',
  bring: 'Llevar',
  emptySince: (time) => `Vacío desde las ${time}`,
  insightsHeadline: (p) => `~${p}% del tiempo de estantería estuvo vacío`,
  insightsPeriod: (d, a, b) => `${d} · ${a}–${b}`,
  insightsSimulatedShort: 'simulado',
  insightsEstimate: 'Estimado con unas 13 fotos por cámara.',
  insightsPeak: (h, p) => `Más vacío a las ${h}, con el ${p}% de las áreas`,
  worstAt: (h) => `peor a las ${h}`,
  insightsSimulated: 'Provisional: los estados de stock están simulados.',
  mapTitle: 'Stock a lo largo del tiempo',
  mapCell: (p, hour, pct) => `${p}, ${hour}: ${pct}% de sus zonas vacías`,
  mapLess: 'Ninguna',
  mapMore: 'Todas vacías',
  worstProducts: 'Productos vacíos más tiempo',
  worstGondolas: 'Góndolas vacías más tiempo',
  metrics: { empty: 'Tiempo de estantería vacía', compliance: 'Producto correcto en su sitio', restock: 'Por reponer', moveBack: 'Por devolver a su sitio' },
  wholeStore: 'Toda la tienda',
  trendTitle: (n) => `${n}: parte de las zonas vacías, por hora`,
  mixTitle: (n) => `${n}: cómo se repartió el tiempo`,
  wrongProduct: 'Producto equivocado',
  colName: 'Nombre',
  colEmpty: 'Vacío',
  colHalf: 'A medias',
  colWrong: 'Producto equivocado',
  complianceLine: (p) => `${p}% del tiempo, las zonas tenían el producto que espera el planograma`,
  askTitle: 'Pregunta sobre tu tienda',
  askPlaceholder: 'Pregunta sobre tu tienda',
  send: 'Enviar',
  thinking: 'Pensando',
  latest: 'Ir a la última',
  chatFailed: 'El asistente no ha respondido. Inténtalo de nuevo.',
  dictate: 'Dictar una pregunta',
  dictateStop: 'Parar la grabación',
  transcribing: 'Transcribiendo',
  readAloudOn: 'Leer las respuestas en voz alta',
  readAloudOff: 'Dejar de leer en voz alta',
  micDenied: 'Micrófono bloqueado. Permítelo en el navegador.',
  micMissing: 'No se encuentra ningún micrófono.',
  voiceFailed: 'No se ha podido oír. Inténtalo de nuevo.',
  larger: 'Agrandar',
  smaller: 'Reducir',
  suggestions: ['¿Qué góndolas necesitan atención?', '¿Cómo van los plátanos?', '¿Qué parte del tiempo estuvieron vacías las zonas?', '¿Qué repongo primero?', 'Dame el informe del día'],
  orderNote: 'Lo más urgente primero: lo que falta en más sitios y, después, lo que lleva más tiempo esperando.',
  showMore: (n) => `Mostrar ${n} más`,
  showAll: (n) => `Mostrar ${n}`,
  showFewer: 'Mostrar menos',
  withProduct: (x) => `con ${x}`,
  noMatches: 'Sin resultados',
  areasCount: (n) => (n === 1 ? '1 zona' : `${n} zonas`),
  plan: {
    title: 'Mapa de la tienda',
    department: 'Frutas y verduras',
    anotherMoment: 'Ver otro momento',
    hideMoment: 'Volver a ahora',
    entrance: 'Entrada',
    aisle: (n) => `Pasillo ${n}`,
    stop: (n) => `Parada ${n}`,
    show: (name) => `Mostrar ${name}`,
    fine: 'Bien',
    nothingHere: 'Nada que corregir aquí',
    fineCount: (n) => `${n} bien`,
    allFine: 'Todo bien',
    otherAreas: 'El resto del estante',
    nothingToDo: 'Todas las góndolas están bien',
    areaLabel: (name, state) => `${name}, ${state}`,
    moreItems: (n) => `+${n}`,
    spot: (top, n) => `${top ? 'Estante de arriba' : 'Estante de abajo'}, ${n} desde la izquierda`,
  },
  headline: (n) => (n === 0 ? 'Nada que hacer ahora' : n === 1 ? 'Una cosa que hacer ahora' : `${n} cosas que hacer ahora`),
  photoFrom: (t) => `Fotos hasta las ${t}`,
  camera: 'Cámara',
  language: 'Idioma',
  day: 'Día',
  play: 'Ver el día',
  pause: 'Pausar',
  restock: 'Reponer',
  moveBack: 'Recolocar',
  later: 'Más tarde',
  allGood: 'Todo bien',
  empty: 'Vacío',
  half: 'A medias',
  wrongPlace: (seen) => `Parece ${seen}`,
  inPlaceOf: (x) => `en lugar de ${x}`,
  since: (t) => `desde las ${t}`,
  areasFine: (n) => `${n} zonas`,
}

const dictionaries: Record<Lang, Strings> = { en, pt, es }

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: Strings
  family: (key: string) => string
}

const Context = createContext<I18n | null>(null)

/** The language of the browser: the first of its languages that is Portuguese or Spanish, else English. */
function browserLang(): Lang {
  const asked = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language])
  for (const l of asked) {
    const code = (l ?? '').toLowerCase()
    if (code.startsWith('pt')) return 'pt'
    if (code.startsWith('es')) return 'es'
    if (code.startsWith('en')) return 'en'
  }
  return 'en'
}

const read = (): Lang => {
  try {
    const v = localStorage.getItem('strivon.lang')
    if (v === 'en' || v === 'pt' || v === 'es') return v
  } catch {
    // private mode: follow the browser
  }
  return browserLang()
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(read)
  const value = useMemo<I18n>(() => {
    const t = dictionaries[lang]
    return {
      lang,
      t,
      family: (key) => FAMILIES[key]?.[lang] ?? key,
      setLang: (l) => {
        setLangState(l)
        try {
          localStorage.setItem('strivon.lang', l)
        } catch {
          // not persisted
        }
      },
    }
  }, [lang])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Context)
  if (!v) throw new Error('useI18n needs an I18nProvider')
  return v
}
