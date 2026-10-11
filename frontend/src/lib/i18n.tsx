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
  // --- calibration presets (start)
  calibrationPresets: { label: string; strict: string; relaxed: string; reset: string; hint: string }
  // --- calibration presets (end)
  // --- sets page (start)
  sets: {
    title: string
    intro: string
    nameLabel: string
    defaultName: (n: number) => string
    uploadRun: string
    working: string
    uploadedStep: (n: number) => string
    runFailed: (why: string) => string
    listTitle: string
    none: string
    photos: (n: number) => string
    areas: (n: number) => string
    labelled: string
    unlabelled: string
    status: Record<'done' | 'failed' | 'running' | 'uploaded', string>
    stockMix: string
    notCompliantPct: (p: string) => string
    colImages: string
    colAreas: string
    colNotCompliant: string
    colScore: string
    noLabels: string
    useTeam: string
    uploadLabels: string
    labelsSaved: (n: number, dropped: number) => string
    labelsFailed: (why: string) => string
    scoreTitle: string
    scoreOf: (t: number, max: number, pct: string) => string
    identification: string
    stock: string
    pointsOf: (p: number, max: number, pct: string) => string
    correct: (pct: string) => string
    errBelow: (n: number) => string
    errAbove: (n: number) => string
    notScored: (n: number) => string
    missingAreas: (n: number) => string
    worst: string
    predicted: string
    truth: string
    compliant: string
    notCompliant: string
    noPrediction: string
    compare: string
    compareHint: string
    compareSelect: string
    rename: string
    delete: string
    confirmDelete: (name: string) => string
    close: string
    scoreByCamera: string
    labelsFrom: Record<'team' | 'upload', string>
  }
  // --- sets page (end)
  // --- validation day (start)
  validate: {
    title: string
    intro: string
    step1: string
    step2: string
    step3: string
    dropHere: string
    dropOr: string
    pickFolder: string
    pickFiles: string
    photos: (n: number) => string
    cameras: (n: number, names: string) => string
    flat: string
    countWarning: (n: number, expected: number) => string
    uploading: string
    uploadFailed: (why: string) => string
    expectImages: string
    expectAreas: string
    run: string
    running: string
    needPhotos: string
    elapsed: (time: string) => string
    log: string
    backendDown: string
    busy: string
    runFailed: (why: string) => string
    verdict: Record<'OK' | 'FALLBACKS' | 'INCOMPLETE' | 'INVALID' | 'ERROR', string>
    advice: Record<'OK' | 'FALLBACKS' | 'INCOMPLETE' | 'INVALID' | 'ERROR', string>
    validatorLine: (images: number, areas: number, errors: number) => string
    validatorFailed: string
    perCamera: string
    total: string
    notCompliant: string
    download: string
    downloadLocked: string
  }
  // --- validation day (end)
  throughDay: string
  close: string
  allCameras: string
  navTasks: string
  navGondolas: string
  navProducts: string
  navCalibration: string
  navValidate: string
  navSets: string
  viewBanner: string
  viewBack: string
  viewOpen: string
  calTitle: string
  calIntro: string
  calReset: string
  calSlider: (product: string) => string
  calLevels: (product: string) => string
  calUnits: (n: number) => string
  calMeaning: (amount: string, level: string) => string
  calFollowsModel: string
  calLines: (empty: string, full: string) => string
  calClear: string
  calExport: string
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
  // --- calibration presets (start)
  calibrationPresets: { label: 'Calibration profile', strict: 'Strict', relaxed: 'Relaxed', reset: 'Default', hint: 'Strict: a shelf is full only when well stocked. Relaxed: a bit of stock is already fine.' },
  // --- calibration presets (end)
  // --- sets page (start)
  sets: {
    title: 'Validation sets',
    intro: 'Upload each set of photos, run the predictor and keep every result. Percentages come from the model; the score needs labels.',
    nameLabel: 'Set name',
    defaultName: (n) => `Set ${n}`,
    uploadRun: 'Upload and run',
    working: 'Working',
    uploadedStep: (n) => `${n} photos uploaded, running the predictor`,
    runFailed: (why) => `Could not run this set: ${why}`,
    listTitle: 'Sets',
    none: 'No sets yet. Upload the first one above.',
    photos: (n) => (n === 1 ? '1 photo' : `${n} photos`),
    areas: (n) => (n === 1 ? '1 area' : `${n} areas`),
    labelled: 'Has labels',
    unlabelled: 'No labels',
    status: { done: 'Done', failed: 'Failed', running: 'Running', uploaded: 'Not run' },
    stockMix: 'Stock mix',
    notCompliantPct: (p) => `${p}% of the areas are not compliant`,
    colImages: 'Photos',
    colAreas: 'Areas',
    colNotCompliant: 'Not compliant',
    colScore: 'Score',
    noLabels: 'No labels, so no score: percentages only',
    useTeam: 'Use team labels',
    uploadLabels: 'Upload labels',
    labelsSaved: (n, dropped) => `${n} labelled areas saved${dropped > 0 ? `, ${dropped} left out (photos not in this set)` : ''}`,
    labelsFailed: (why) => `Labels not saved: ${why}`,
    scoreTitle: 'Official score',
    scoreOf: (t, max, pct) => `${t} / ${max} (${pct}%)`,
    identification: 'Identification',
    stock: 'Stock',
    pointsOf: (p, max, pct) => `${p} / ${max} (${pct}%)`,
    correct: (pct) => `${pct}% correct`,
    errBelow: (n) => `${n} below the real stock (-2)`,
    errAbove: (n) => `${n} above the real stock (-3)`,
    notScored: (n) => `${n} areas have no label and are not scored`,
    missingAreas: (n) => `${n} labelled areas have no prediction (counted wrong)`,
    worst: 'Worst areas',
    predicted: 'Predicted',
    truth: 'Real',
    compliant: 'compliant',
    notCompliant: 'not compliant',
    noPrediction: 'no prediction',
    compare: 'Compare sets',
    compareHint: 'Tick two or more sets to see them side by side.',
    compareSelect: 'Compare',
    rename: 'Rename',
    delete: 'Delete',
    confirmDelete: (n) => `Delete "${n}" and its photos?`,
    close: 'Close',
    scoreByCamera: 'Score by camera',
    labelsFrom: { team: 'Team labels', upload: 'Uploaded labels' },
  },
  // --- sets page (end)
  // --- validation day (start)
  validate: {
    title: 'Validation day',
    intro: 'Drop the photos the organisers send, run the official predictor and download the checked file. Only send a file when the verdict is OK.',
    step1: '1. Photos',
    step2: '2. Run',
    step3: '3. Result',
    dropHere: 'Drop the photos or the folder here',
    dropOr: 'or choose them',
    pickFolder: 'Choose a folder',
    pickFiles: 'Choose photos',
    photos: (n) => (n === 1 ? '1 photo' : `${n} photos`),
    cameras: (n, names) => `${n} cameras: ${names}`,
    flat: 'The photos are not in camera folders. The predictor will match them to cameras by looking at them.',
    countWarning: (n, expected) => `${n} photos, but ${expected} are expected. Check that none are missing.`,
    uploading: 'Uploading…',
    uploadFailed: (why) => `The photos did not upload. ${why}`,
    expectImages: 'Photos expected',
    expectAreas: 'Areas expected',
    run: 'Run the predictor',
    running: 'Running…',
    needPhotos: 'Add the photos first.',
    elapsed: (time) => `Running for ${time}`,
    log: 'Live log',
    backendDown: 'The backend does not answer. Start it on port 8000 and try again.',
    busy: 'A run is already in progress. Wait for it to finish.',
    runFailed: (why) => `The run could not start. ${why}`,
    verdict: { OK: 'OK', FALLBACKS: 'Fallbacks', INCOMPLETE: 'Incomplete', INVALID: 'Invalid', ERROR: 'Error' },
    advice: {
      OK: 'All checks passed. You can send the file.',
      FALLBACKS: 'Some answers did not come from the model, for example a corrupt photo. Do not send this file.',
      INCOMPLETE: 'The photo or area count does not match what was expected, or files were skipped. Check before sending anything.',
      INVALID: 'The file failed the format check. Do not send it.',
      ERROR: 'The run stopped with an error. Read the log, fix it and run again. Do not send anything.',
    },
    validatorLine: (images, areas, errors) => `${images} images, ${areas} areas, ${errors} errors`,
    validatorFailed: 'The validator did not pass.',
    perCamera: 'Per camera',
    total: 'Total',
    notCompliant: 'Not compliant',
    download: 'Download final.json',
    downloadLocked: 'Only available when the verdict is OK and the validator passed.',
  },
  // --- validation day (end)
  throughDay: 'Through the day',
  close: 'Close',
  allCameras: 'All cameras',
  navTasks: 'Tasks',
  navGondolas: 'Gondolas',
  navProducts: 'Products',
  navCalibration: 'Calibration',
  navValidate: 'Validation',
  navSets: 'Sets',
  viewBanner: 'Showing the validation run',
  viewBack: 'Back to the train/test photos',
  viewOpen: 'Open in the app',
  calTitle: 'Calibration',
  calIntro: 'Move the slider to an amount, then pick what that amount counts as. Orange at 25% and Full means a quarter of the crate already counts as full.',
  calReset: 'Reset to defaults',
  calSlider: (p) => `Amount of ${p}`,
  calLevels: (p) => `Level for ${p}`,
  calUnits: (n) => (n === 1 ? '1 unit' : `${n} units`),
  calMeaning: (a, l) => `${a} counts as ${l}`,
  calFollowsModel: 'No marker: shows what the model says.',
  calLines: (e, f) => `Empty up to ${e} · Full from ${f} · Half in between`,
  calClear: 'Back to the model',
  calExport: 'Export calib.json',
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
  // --- calibration presets (start)
  calibrationPresets: { label: 'Perfil de calibração', strict: 'Rigoroso', relaxed: 'Flexível', reset: 'Predefinido', hint: 'Rigoroso: só está cheio quando bem abastecido. Flexível: um pouco de stock já chega.' },
  // --- calibration presets (end)
  // --- sets page (start)
  sets: {
    title: 'Conjuntos de validação',
    intro: 'Carregue cada conjunto de fotos, execute o preditor e guarde todos os resultados. As percentagens vêm do modelo; a pontuação precisa de etiquetas.',
    nameLabel: 'Nome do conjunto',
    defaultName: (n) => `Conjunto ${n}`,
    uploadRun: 'Carregar e executar',
    working: 'A trabalhar',
    uploadedStep: (n) => `${n} fotos carregadas, a executar o preditor`,
    runFailed: (why) => `Não foi possível executar este conjunto: ${why}`,
    listTitle: 'Conjuntos',
    none: 'Ainda não há conjuntos. Carregue o primeiro acima.',
    photos: (n) => (n === 1 ? '1 foto' : `${n} fotos`),
    areas: (n) => (n === 1 ? '1 área' : `${n} áreas`),
    labelled: 'Com etiquetas',
    unlabelled: 'Sem etiquetas',
    status: { done: 'Concluído', failed: 'Falhou', running: 'A executar', uploaded: 'Por executar' },
    stockMix: 'Distribuição do stock',
    notCompliantPct: (p) => `${p}% das áreas não cumprem`,
    colImages: 'Fotos',
    colAreas: 'Áreas',
    colNotCompliant: 'Não conforme',
    colScore: 'Pontuação',
    noLabels: 'Sem etiquetas, logo sem pontuação: só percentagens',
    useTeam: 'Usar etiquetas da equipa',
    uploadLabels: 'Carregar etiquetas',
    labelsSaved: (n, dropped) => `${n} áreas etiquetadas guardadas${dropped > 0 ? `, ${dropped} de fora (fotos que não estão neste conjunto)` : ''}`,
    labelsFailed: (why) => `Etiquetas não guardadas: ${why}`,
    scoreTitle: 'Pontuação oficial',
    scoreOf: (t, max, pct) => `${t} / ${max} (${pct}%)`,
    identification: 'Identificação',
    stock: 'Stock',
    pointsOf: (p, max, pct) => `${p} / ${max} (${pct}%)`,
    correct: (pct) => `${pct}% certo`,
    errBelow: (n) => `${n} abaixo do stock real (-2)`,
    errAbove: (n) => `${n} acima do stock real (-3)`,
    notScored: (n) => `${n} áreas sem etiqueta não entram na pontuação`,
    missingAreas: (n) => `${n} áreas etiquetadas sem previsão (contam como erro)`,
    worst: 'Piores áreas',
    predicted: 'Previsto',
    truth: 'Real',
    compliant: 'conforme',
    notCompliant: 'não conforme',
    noPrediction: 'sem previsão',
    compare: 'Comparar conjuntos',
    compareHint: 'Marque dois ou mais conjuntos para os ver lado a lado.',
    compareSelect: 'Comparar',
    rename: 'Renomear',
    delete: 'Apagar',
    confirmDelete: (n) => `Apagar "${n}" e as suas fotos?`,
    close: 'Fechar',
    scoreByCamera: 'Pontuação por câmara',
    labelsFrom: { team: 'Etiquetas da equipa', upload: 'Etiquetas carregadas' },
  },
  // --- sets page (end)
  // --- validation day (start)
  validate: {
    title: 'Dia da validação',
    intro: 'Larga as fotos que a organização envia, corre o previsor oficial e descarrega o ficheiro verificado. Envia o ficheiro só se o veredito for OK.',
    step1: '1. Fotos',
    step2: '2. Correr',
    step3: '3. Resultado',
    dropHere: 'Larga aqui as fotos ou a pasta',
    dropOr: 'ou escolhe-as',
    pickFolder: 'Escolher pasta',
    pickFiles: 'Escolher fotos',
    photos: (n) => (n === 1 ? '1 foto' : `${n} fotos`),
    cameras: (n, names) => `${n} câmaras: ${names}`,
    flat: 'As fotos não estão em pastas por câmara. O previsor vai associá-las às câmaras olhando para elas.',
    countWarning: (n, expected) => `${n} fotos, mas esperam-se ${expected}. Confirma que não falta nenhuma.`,
    uploading: 'A enviar…',
    uploadFailed: (why) => `As fotos não foram enviadas. ${why}`,
    expectImages: 'Fotos esperadas',
    expectAreas: 'Áreas esperadas',
    run: 'Correr o previsor',
    running: 'A correr…',
    needPhotos: 'Primeiro adiciona as fotos.',
    elapsed: (time) => `A correr há ${time}`,
    log: 'Registo em direto',
    backendDown: 'O backend não responde. Arranca-o na porta 8000 e tenta de novo.',
    busy: 'Já há uma execução em curso. Espera que termine.',
    runFailed: (why) => `Não foi possível começar. ${why}`,
    verdict: { OK: 'OK', FALLBACKS: 'Alternativas', INCOMPLETE: 'Incompleto', INVALID: 'Inválido', ERROR: 'Erro' },
    advice: {
      OK: 'Todas as verificações passaram. Podes enviar o ficheiro.',
      FALLBACKS: 'Algumas respostas não vieram do modelo, por exemplo por uma foto corrompida. Não envies este ficheiro.',
      INCOMPLETE: 'O número de fotos ou de áreas não coincide com o esperado, ou houve ficheiros ignorados. Confirma antes de enviar.',
      INVALID: 'O ficheiro falhou a verificação de formato. Não o envies.',
      ERROR: 'A execução parou com um erro. Lê o registo, corrige e corre outra vez. Não envies nada.',
    },
    validatorLine: (images, areas, errors) => `${images} imagens, ${areas} áreas, ${errors} erros`,
    validatorFailed: 'O validador não passou.',
    perCamera: 'Por câmara',
    total: 'Total',
    notCompliant: 'Fora do planograma',
    download: 'Descarregar final.json',
    downloadLocked: 'Só disponível quando o veredito é OK e o validador passou.',
  },
  // --- validation day (end)
  throughDay: 'Ao longo do dia',
  close: 'Fechar',
  allCameras: 'Todas as câmaras',
  navTasks: 'Tarefas',
  navGondolas: 'Gôndolas',
  navProducts: 'Produtos',
  navCalibration: 'Calibração',
  navValidate: 'Validação',
  navSets: 'Conjuntos',
  viewBanner: 'A mostrar a execução de validação',
  viewBack: 'Voltar às fotos de treino/teste',
  viewOpen: 'Abrir na aplicação',
  calTitle: 'Calibração',
  calIntro: 'Move o seletor até uma quantidade e escolhe o que ela conta como. Laranja a 25% com Cheio quer dizer que um quarto da caixa já conta como cheio.',
  calReset: 'Repor valores por defeito',
  calSlider: (p) => `Quantidade de ${p}`,
  calLevels: (p) => `Nível de ${p}`,
  calUnits: (n) => (n === 1 ? '1 unidade' : `${n} unidades`),
  calMeaning: (a, l) => `${a} conta como ${l}`,
  calFollowsModel: 'Sem marcador: mostra o que o modelo diz.',
  calLines: (e, f) => `Vazio até ${e} · Cheio a partir de ${f} · A meio entre os dois`,
  calClear: 'Voltar ao modelo',
  calExport: 'Exportar calib.json',
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
  // --- calibration presets (start)
  calibrationPresets: { label: 'Perfil de calibración', strict: 'Estricto', relaxed: 'Flexible', reset: 'Por defecto', hint: 'Estricto: solo está lleno si está bien surtido. Flexible: con algo de stock ya vale.' },
  // --- calibration presets (end)
  // --- sets page (start)
  sets: {
    title: 'Conjuntos de validación',
    intro: 'Sube cada conjunto de fotos, ejecuta el predictor y conserva todos los resultados. Los porcentajes salen del modelo; la puntuación necesita etiquetas.',
    nameLabel: 'Nombre del conjunto',
    defaultName: (n) => `Conjunto ${n}`,
    uploadRun: 'Subir y ejecutar',
    working: 'Trabajando',
    uploadedStep: (n) => `${n} fotos subidas, ejecutando el predictor`,
    runFailed: (why) => `No se pudo ejecutar este conjunto: ${why}`,
    listTitle: 'Conjuntos',
    none: 'Aún no hay conjuntos. Sube el primero arriba.',
    photos: (n) => (n === 1 ? '1 foto' : `${n} fotos`),
    areas: (n) => (n === 1 ? '1 área' : `${n} áreas`),
    labelled: 'Con etiquetas',
    unlabelled: 'Sin etiquetas',
    status: { done: 'Hecho', failed: 'Falló', running: 'Ejecutando', uploaded: 'Sin ejecutar' },
    stockMix: 'Reparto del stock',
    notCompliantPct: (p) => `${p}% de las áreas no cumplen`,
    colImages: 'Fotos',
    colAreas: 'Áreas',
    colNotCompliant: 'No conforme',
    colScore: 'Puntos',
    noLabels: 'Sin etiquetas no hay puntuación: solo porcentajes',
    useTeam: 'Usar etiquetas del equipo',
    uploadLabels: 'Subir etiquetas',
    labelsSaved: (n, dropped) => `${n} áreas etiquetadas guardadas${dropped > 0 ? `, ${dropped} descartadas (fotos que no están en este conjunto)` : ''}`,
    labelsFailed: (why) => `Etiquetas no guardadas: ${why}`,
    scoreTitle: 'Puntuación oficial',
    scoreOf: (t, max, pct) => `${t} / ${max} (${pct}%)`,
    identification: 'Identificación',
    stock: 'Stock',
    pointsOf: (p, max, pct) => `${p} / ${max} (${pct}%)`,
    correct: (pct) => `${pct}% acertado`,
    errBelow: (n) => `${n} por debajo del stock real (-2)`,
    errAbove: (n) => `${n} por encima del stock real (-3)`,
    notScored: (n) => `${n} áreas sin etiqueta no puntúan`,
    missingAreas: (n) => `${n} áreas etiquetadas sin predicción (cuentan como fallo)`,
    worst: 'Peores áreas',
    predicted: 'Predicho',
    truth: 'Real',
    compliant: 'conforme',
    notCompliant: 'no conforme',
    noPrediction: 'sin predicción',
    compare: 'Comparar conjuntos',
    compareHint: 'Marca dos o más conjuntos para verlos lado a lado.',
    compareSelect: 'Comparar',
    rename: 'Renombrar',
    delete: 'Borrar',
    confirmDelete: (n) => `¿Borrar "${n}" y sus fotos?`,
    close: 'Cerrar',
    scoreByCamera: 'Puntos por cámara',
    labelsFrom: { team: 'Etiquetas del equipo', upload: 'Etiquetas subidas' },
  },
  // --- sets page (end)
  // --- validation day (start)
  validate: {
    title: 'Día de validación',
    intro: 'Suelta las fotos que manda la organización, ejecuta el predictor oficial y descarga el archivo comprobado. Envía el archivo solo si el veredicto es OK.',
    step1: '1. Fotos',
    step2: '2. Ejecutar',
    step3: '3. Resultado',
    dropHere: 'Suelta aquí las fotos o la carpeta',
    dropOr: 'o elígelas',
    pickFolder: 'Elegir carpeta',
    pickFiles: 'Elegir fotos',
    photos: (n) => (n === 1 ? '1 foto' : `${n} fotos`),
    cameras: (n, names) => `${n} cámaras: ${names}`,
    flat: 'Las fotos no están en carpetas por cámara. El predictor las asignará a las cámaras mirándolas.',
    countWarning: (n, expected) => `${n} fotos, pero se esperan ${expected}. Comprueba que no falte ninguna.`,
    uploading: 'Subiendo…',
    uploadFailed: (why) => `Las fotos no se subieron. ${why}`,
    expectImages: 'Fotos esperadas',
    expectAreas: 'Zonas esperadas',
    run: 'Ejecutar el predictor',
    running: 'Ejecutando…',
    needPhotos: 'Primero añade las fotos.',
    elapsed: (time) => `Ejecutando desde hace ${time}`,
    log: 'Registro en vivo',
    backendDown: 'El backend no responde. Arráncalo en el puerto 8000 e inténtalo de nuevo.',
    busy: 'Ya hay una ejecución en curso. Espera a que termine.',
    runFailed: (why) => `No se pudo empezar. ${why}`,
    verdict: { OK: 'OK', FALLBACKS: 'Alternativas', INCOMPLETE: 'Incompleto', INVALID: 'Inválido', ERROR: 'Error' },
    advice: {
      OK: 'Todas las comprobaciones han pasado. Puedes enviar el archivo.',
      FALLBACKS: 'Algunas respuestas no vinieron del modelo, por ejemplo por una foto corrupta. No envíes este archivo.',
      INCOMPLETE: 'El número de fotos o de zonas no coincide con lo esperado, o se saltaron archivos. Comprueba antes de enviar.',
      INVALID: 'El archivo no pasó la comprobación de formato. No lo envíes.',
      ERROR: 'La ejecución se detuvo con un error. Lee el registro, corrígelo y ejecuta otra vez. No envíes nada.',
    },
    validatorLine: (images, areas, errors) => `${images} imágenes, ${areas} zonas, ${errors} errores`,
    validatorFailed: 'El validador no pasó.',
    perCamera: 'Por cámara',
    total: 'Total',
    notCompliant: 'Fuera del planograma',
    download: 'Descargar final.json',
    downloadLocked: 'Solo disponible cuando el veredicto es OK y el validador pasó.',
  },
  // --- validation day (end)
  throughDay: 'A lo largo del día',
  close: 'Cerrar',
  allCameras: 'Todas las cámaras',
  navTasks: 'Tareas',
  navGondolas: 'Góndolas',
  navProducts: 'Productos',
  navCalibration: 'Calibración',
  navValidate: 'Validación',
  navSets: 'Conjuntos',
  viewBanner: 'Mostrando la ejecución de validación',
  viewBack: 'Volver a las fotos de entrenamiento/prueba',
  viewOpen: 'Abrir en la app',
  calTitle: 'Calibración',
  calIntro: 'Mueve el control hasta una cantidad y elige qué cuenta como. Naranja al 25% con Lleno significa que un cuarto de la caja ya cuenta como lleno.',
  calReset: 'Restablecer valores',
  calSlider: (p) => `Cantidad de ${p}`,
  calLevels: (p) => `Nivel de ${p}`,
  calUnits: (n) => (n === 1 ? '1 unidad' : `${n} unidades`),
  calMeaning: (a, l) => `${a} cuenta como ${l}`,
  calFollowsModel: 'Sin marcador: muestra lo que dice el modelo.',
  calLines: (e, f) => `Vacío hasta ${e} · Lleno desde ${f} · A medias entre los dos`,
  calClear: 'Volver al modelo',
  calExport: 'Exportar calib.json',
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
