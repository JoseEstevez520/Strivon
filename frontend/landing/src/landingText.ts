import type { Lang } from '@/lib/i18n'

/** Every string of the landing. The three languages must have the same keys, and the compiler checks it. */
export interface LandingStrings {
  docTitle: string
  docDescription: string
  language: string
  hero: string
  whatTitle: string
  whatFirst: string
  whatSecond: string
  howTitle: string
  steps: [Item, Item, Item]
  todayTitle: string
  today: [Item, Item, Item, Item, Item, Item]
  seeTitle: string
  seeLead: string
  demo: string
  askTitle: string
  askText: string
  clipLabel: string
  enlarge: string
  clipHint: string
  close: string
  codeTitle: string
  repoDescription: string
  openRepo: string
  teamTitle: string
  footer: string
  tryApp: string
  seeDeck: string
  filmLabel: string
  filmTitle: string
  quickTitle: string
  quick: [Quick, Quick, Quick, Quick]
  stats: [Stat, Stat, Stat]
}

interface Quick {
  title: string
  text: string
}

interface Stat {
  value: string
  label: string
}

interface Item {
  title: string
  text: string
}

const en: LandingStrings = {
  docTitle: 'Strivon',
  docDescription: 'Ceiling cameras watch the fruit and vegetable shelves. Strivon tells the staff what to restock and what to put back.',
  language: 'Language',
  hero: 'Ceiling cameras watch the fruit and vegetable shelves. Strivon compares what they see with the planogram and tells the staff what to restock and what to put back.',
  whatTitle: 'What is Strivon?',
  whatFirst:
    'Fresh produce is the section where the state of a shelf matters most. An empty gondola is a lost sale, an overstocked one ends in waste, and a product in the wrong place gets the wrong price. Today the staff check this by walking the store.',
  whatSecond:
    'A ceiling camera already sees every gondola, but loose, piled fruit with no barcode is hard for a computer to read, and shoppers and staff hide it with their hands. Strivon takes the photo and the store planogram and checks each shelf area: is it holding the product it should, and how full is it? What comes out is a list of work for the staff. It was built for the Sensei challenge at JunctionX Lisbon, with a day of photos from 14 cameras in an autonomous store in Leiria.',
  howTitle: 'How it works',
  steps: [
    { title: 'A camera looks', text: 'Each gondola has a ceiling camera that takes a photo about once an hour.' },
    { title: 'Each shelf area is checked', text: 'Against the planogram: is it holding the right product, and how full is it?' },
    { title: 'Staff get the work', text: 'What is empty, what is in the wrong place, and what can wait.' },
  ],
  todayTitle: 'What it does today',
  today: [
    { title: 'A round for the whole store', text: 'A plan shows which gondolas need something, and the list gives the order of the round and what to carry to each stop.' },
    { title: 'Every gondola, in 2D, 3D or real', text: 'The store as a plan, a 3D model or the latest photo of each camera, with the shelf areas drawn on it so the proof is in view.' },
    { title: 'Products as cards', text: 'Each product with its stock over every shelf area it sits on, where to bring it or put it back, and since when.' },
    { title: 'The day, replayed', text: 'Move through the photos of the day and watch each area change, or open a card to see its day as a strip.' },
    { title: 'How the store is doing', text: 'How much of the time shelves were empty, when and where, marked as an estimate because photos come an hour apart.' },
    { title: 'English, Portuguese and Spanish', text: 'The whole app, in the language of whoever is on shift.' },
  ],
  seeTitle: 'See it',
  seeLead: 'The app, shortened. The plan shows where the problems are and the list gives the order of the round. Move through the day, or press a gondola to see its shelf.',
  demo: 'Demo',
  askTitle: 'Generative UI',
  askText:
    'You can ask the store a question in plain words. The answer is not a paragraph: the chat builds the screen that answers it, with a chart of the day and a card that opens the shelf.',
  clipLabel:
    "Someone asks where the bananas are. The chat answers with a chart of how the shelves emptied through the day and a card. Opening the card shows the gondola's photo with its shelf areas marked.",
  enlarge: 'Open the video large',
  clipHint: 'Tap to watch it full screen, with the phone on its side.',
  close: 'Close',
  codeTitle: 'Code',
  repoDescription: 'Shelf monitoring for the Sensei challenge at JunctionX Lisbon 2026.',
  openRepo: 'Open the repository',
  teamTitle: 'Team',
  footer: 'Built at JunctionX Lisbon 2026, for the Sensei challenge. The logos belong to their owners.',
  tryApp: 'Try the app',
  seeDeck: 'See the presentation',
  filmLabel: 'The Strivon film, 18 seconds, with sound.',
  filmTitle: 'The film',
  quickTitle: 'See it in a minute',
  quick: [
    { title: 'One photo, every shelf area', text: 'Empty, wrong product or fine, drawn on the photo from the ceiling camera.' },
    { title: 'A route for the staff', text: 'The gondolas to go to first, in order, and what to carry.' },
    { title: 'The store in 3D', text: 'Every gondola with what it needs, from any side.' },
    { title: 'The round on the phone', text: 'Load up, then stop by stop. Tick it, next one.' },
  ],
  stats: [
    { value: '14', label: 'ceiling cameras' },
    { value: '2 s', label: 'a photo, on one CPU thread' },
    { value: '0.005 ¢', label: 'a photo at most, an estimate' },
  ],
}

const pt: LandingStrings = {
  docTitle: 'Strivon',
  docDescription: 'As câmaras de teto vigiam as prateleiras de fruta e legumes. O Strivon diz à equipa o que repor e o que devolver ao sítio.',
  language: 'Língua',
  hero: 'As câmaras de teto vigiam as prateleiras de fruta e legumes. O Strivon compara o que elas veem com o planograma e diz à equipa o que repor e o que devolver ao sítio.',
  whatTitle: 'O que é o Strivon?',
  whatFirst:
    'A fruta e os legumes são a secção onde o estado de uma prateleira mais importa. Uma gôndola vazia é uma venda perdida, uma com excesso acaba em desperdício e um produto fora do lugar é cobrado ao preço errado. Hoje, a equipa verifica isto percorrendo a loja.',
  whatSecond:
    'Uma câmara de teto já vê cada gôndola, mas a fruta solta e empilhada, sem código de barras, é difícil de ler para um computador, e os clientes e a equipa tapam-na com as mãos. O Strivon recebe a fotografia e o planograma da loja e verifica cada zona da prateleira: tem o produto que deve ter e quão cheia está? O resultado é uma lista de trabalho para a equipa. Foi feito para o desafio da Sensei no JunctionX Lisboa, com um dia de fotografias de 14 câmaras de uma loja autónoma em Leiria.',
  howTitle: 'Como funciona',
  steps: [
    { title: 'Uma câmara olha', text: 'Cada gôndola tem uma câmara no teto que tira uma fotografia mais ou menos de hora a hora.' },
    { title: 'Cada zona da prateleira é verificada', text: 'Contra o planograma: tem o produto certo e quão cheia está?' },
    { title: 'A equipa recebe o trabalho', text: 'O que está vazio, o que está no sítio errado e o que pode esperar.' },
  ],
  todayTitle: 'O que faz hoje',
  today: [
    { title: 'Uma ronda para a loja toda', text: 'Um plano mostra que gôndolas precisam de algo, e a lista dá a ordem da ronda e o que levar a cada paragem.' },
    { title: 'Cada gôndola, em 2D, 3D ou real', text: 'A loja como plano, como modelo 3D ou com a última fotografia de cada câmara, com as zonas da prateleira desenhadas por cima para se ver a prova.' },
    { title: 'Produtos em cartões', text: 'Cada produto com o seu stock em todas as zonas onde está, onde o levar ou devolver ao sítio, e desde quando.' },
    { title: 'O dia, em repetição', text: 'Percorra as fotografias do dia e veja cada zona mudar, ou abra um cartão para ver o seu dia numa faixa.' },
    { title: 'Como vai a loja', text: 'Quanto tempo as prateleiras estiveram vazias, quando e onde, apresentado como estimativa porque as fotografias chegam com uma hora de intervalo.' },
    { title: 'Inglês, português e espanhol', text: 'A aplicação inteira, na língua de quem está de turno.' },
  ],
  seeTitle: 'Ver',
  seeLead: 'A aplicação, em versão curta. O plano mostra onde estão os problemas e a lista dá a ordem da ronda. Percorra o dia ou carregue numa gôndola para ver a sua prateleira.',
  demo: 'Demonstração',
  askTitle: 'UI generativa',
  askText:
    'Pode fazer uma pergunta à loja por palavras suas. A resposta não é um parágrafo: o chat constrói o ecrã que a responde, com um gráfico do dia e um cartão que abre a prateleira.',
  clipLabel:
    'Alguém pergunta onde estão as bananas. O chat responde com um gráfico de como as prateleiras se esvaziaram ao longo do dia e um cartão. Ao abrir o cartão vê-se a fotografia da gôndola com as zonas assinaladas. O vídeo está em inglês.',
  enlarge: 'Ver o vídeo em grande',
  clipHint: 'Toque para ver em ecrã inteiro, com o telemóvel na horizontal.',
  close: 'Fechar',
  codeTitle: 'Código',
  repoDescription: 'Monitorização de prateleiras para o desafio da Sensei no JunctionX Lisbon 2026.',
  openRepo: 'Abrir o repositório',
  teamTitle: 'Equipa',
  footer: 'Feito no JunctionX Lisbon 2026, para o desafio da Sensei. Os logótipos pertencem aos seus donos.',
  tryApp: 'Experimentar a app',
  seeDeck: 'Ver a apresentação',
  filmLabel: 'O filme da Strivon, 18 segundos, com som.',
  filmTitle: 'O filme',
  quickTitle: 'Veja num minuto',
  quick: [
    { title: 'Uma foto, cada zona da prateleira', text: 'Vazia, produto errado ou certa, desenhado na foto da câmara do teto.' },
    { title: 'Um percurso para a equipa', text: 'As gôndolas a que ir primeiro, por ordem, e o que levar.' },
    { title: 'A loja em 3D', text: 'Cada gôndola com o que precisa, de qualquer lado.' },
    { title: 'A ronda no telemóvel', text: 'Carregar e depois paragem a paragem. Marcar, a seguinte.' },
  ],
  stats: [
    { value: '14', label: 'câmaras no teto' },
    { value: '2 s', label: 'por foto, num só fio de CPU' },
    { value: '0,005 ¢', label: 'por foto, no máximo, uma estimativa' },
  ],
}

const es: LandingStrings = {
  docTitle: 'Strivon',
  docDescription: 'Las cámaras de techo vigilan las estanterías de fruta y verdura. Strivon le dice al personal qué reponer y qué devolver a su sitio.',
  language: 'Idioma',
  hero: 'Las cámaras de techo vigilan las estanterías de fruta y verdura. Strivon compara lo que ven con el planograma y le dice al personal qué reponer y qué devolver a su sitio.',
  whatTitle: '¿Qué es Strivon?',
  whatFirst:
    'La fruta y la verdura son la sección donde más importa el estado de una estantería. Una góndola vacía es una venta perdida, una con exceso acaba en merma y un producto fuera de su sitio se cobra al precio equivocado. Hoy lo comprueba el personal recorriendo la tienda.',
  whatSecond:
    'Una cámara de techo ya ve cada góndola, pero la fruta suelta y apilada, sin código de barras, es difícil de leer para un ordenador, y los clientes y el personal la tapan con las manos. Strivon toma la foto y el planograma de la tienda y revisa cada zona de estantería: ¿tiene el producto que debe y cuánto está de llena? Lo que sale es una lista de trabajo para el personal. Se hizo para el reto de Sensei en JunctionX Lisboa, con un día de fotos de 14 cámaras de una tienda autónoma de Leiria.',
  howTitle: 'Cómo funciona',
  steps: [
    { title: 'Una cámara mira', text: 'Cada góndola tiene una cámara en el techo que hace una foto más o menos cada hora.' },
    { title: 'Se comprueba cada zona de la estantería', text: 'Contra el planograma: ¿tiene el producto correcto y cuánto está de llena?' },
    { title: 'El personal recibe el trabajo', text: 'Lo que está vacío, lo que está en el sitio equivocado y lo que puede esperar.' },
  ],
  todayTitle: 'Qué hace hoy',
  today: [
    { title: 'Una ronda para toda la tienda', text: 'Un plano muestra qué góndolas necesitan algo, y la lista da el orden de la ronda y qué llevar a cada parada.' },
    { title: 'Cada góndola, en 2D, 3D o real', text: 'La tienda como plano, como modelo 3D o con la última foto de cada cámara, con las zonas de la estantería dibujadas encima para ver la prueba.' },
    { title: 'Productos en tarjetas', text: 'Cada producto con su stock en todas las zonas donde está, dónde llevarlo o devolverlo a su sitio, y desde cuándo.' },
    { title: 'El día, repetido', text: 'Recorre las fotos del día y mira cómo cambia cada zona, o abre una tarjeta para ver su día en una tira.' },
    { title: 'Cómo va la tienda', text: 'Cuánto tiempo estuvieron vacías las estanterías, cuándo y dónde, marcado como estimación porque las fotos llegan con una hora de diferencia.' },
    { title: 'Inglés, portugués y español', text: 'Toda la aplicación, en el idioma de quien está de turno.' },
  ],
  seeTitle: 'Verlo',
  seeLead: 'La aplicación, en versión corta. El plano muestra dónde están los problemas y la lista da el orden de la ronda. Recorre el día o pulsa una góndola para ver su estantería.',
  demo: 'Demostración',
  askTitle: 'UI generativa',
  askText:
    'Puedes preguntarle a la tienda con tus palabras. La respuesta no es un párrafo: el chat construye la pantalla que la responde, con una gráfica del día y una tarjeta que abre la estantería.',
  clipLabel:
    'Alguien pregunta dónde están los plátanos. El chat responde con una gráfica de cómo se vaciaron las estanterías durante el día y una tarjeta. Al abrir la tarjeta se ve la foto de la góndola con sus zonas marcadas. El vídeo está en inglés.',
  enlarge: 'Ver el vídeo en grande',
  clipHint: 'Toca para verlo a pantalla completa, con el móvil en horizontal.',
  close: 'Cerrar',
  codeTitle: 'Código',
  repoDescription: 'Monitorización de estanterías para el reto de Sensei en JunctionX Lisbon 2026.',
  openRepo: 'Abrir el repositorio',
  teamTitle: 'Equipo',
  footer: 'Hecho en JunctionX Lisbon 2026, para el reto de Sensei. Los logotipos pertenecen a sus dueños.',
  tryApp: 'Probar la app',
  seeDeck: 'Ver la presentación',
  filmLabel: 'La película de Strivon, 18 segundos, con sonido.',
  filmTitle: 'La película',
  quickTitle: 'Míralo en un minuto',
  quick: [
    { title: 'Una foto, cada zona del estante', text: 'Vacía, producto equivocado o bien, dibujado sobre la foto de la cámara del techo.' },
    { title: 'Una ruta para el personal', text: 'Las góndolas a las que ir primero, en orden, y qué llevar.' },
    { title: 'La tienda en 3D', text: 'Cada góndola con lo que necesita, desde cualquier lado.' },
    { title: 'La ronda en el móvil', text: 'Cargar y luego parada a parada. Marcar, la siguiente.' },
  ],
  stats: [
    { value: '14', label: 'cámaras de techo' },
    { value: '2 s', label: 'por foto, en un solo hilo de CPU' },
    { value: '0,005 ¢', label: 'por foto como máximo, una estimación' },
  ],
}

export const landingText: Record<Lang, LandingStrings> = { en, pt, es }
