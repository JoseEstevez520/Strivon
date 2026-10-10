// The planogram names are the store's Portuguese catalogue names. These rules turn one into a
// product family, in the same order and with the same patterns as `sensei/catalog.py`, where the
// first match wins. If one changes there, change it here.
const RULES: [RegExp, string][] = [
  [/BANANA PAO/, 'plantain'],
  [/BANANA/, 'banana'],
  [/CLEMENTINA/, 'citrus_orange'],
  [/LIMAO/, 'lemon'],
  [/\bLIMA\b/, 'lime'],
  [/CITR|LARANJA/, 'citrus_orange'],
  [/MELANCIA MINI/, 'watermelon'],
  [/MELANCIA/, 'watermelon'],
  [/MELOA|MELAO/, 'melon'],
  [/GRANNY|GOLDEN/, 'apple_green'],
  [/REINETA/, 'apple_russet'],
  [/MA[CÇ]A/, 'apple_red'],
  [/PERA/, 'pear'],
  [/KIWI/, 'kiwi'],
  [/ALFACE/, 'leafy'],
  [/COUVE PORTUGUESA|PENCA/, 'leafy'],
  [/BROCOLO/, 'broccoli'],
  [/COUVE ROXA/, 'red_cabbage'],
  [/COUVE FLOR/, 'cauliflower'],
  [/COUVE/, 'cabbage'],
  [/ABACATE/, 'avocado'],
  [/PIMENTO VERDE/, 'pepper_green'],
  [/PIMENTO/, 'pepper_red'],
  [/BERINGELA/, 'eggplant'],
  [/CHUCHU/, 'chayote'],
  [/FEIJAO VERDE/, 'green_beans'],
  [/PEPINO/, 'cucumber'],
  [/CURGETE/, 'cucumber'],
  [/TOMATE/, 'tomato'],
  [/MORANGO/, 'strawberry'],
  [/MANGA/, 'mango'],
  [/UVA RED|UVA TINTA|UVA PRETA/, 'grape_red'],
  [/UVA/, 'grape_white'],
  [/CEREJA/, 'cherry'],
  [/ABACAXI|ANANAS/, 'pineapple'],
  [/PITAYA/, 'pitaya'],
  [/GOIABA/, 'guava'],
  [/MARACUJA/, 'passion_fruit'],
  [/GRANADILHA/, 'passion_fruit'],
  [/MAMAO|PAPAIA/, 'papaya'],
  [/ALPERCE/, 'stone_fruit'],
  [/PESSEGO PARAGUAYO/, 'stone_fruit'],
  [/PESSEGO|NECTARINA/, 'stone_fruit'],
  [/BATATA DOCE/, 'sweet_potato'],
  [/BATATA/, 'potato'],
  [/GENGIBRE/, 'ginger'],
  [/ABOBORA/, 'pumpkin'],
  [/CEBOLA ROXA/, 'onion_red'],
  [/CEBOLINHA/, 'onion'],
  [/CEBOLA/, 'onion'],
  [/ALHO/, 'garlic'],
]

/** The family of a catalogue name, such as "BANANA CAT I CNT KG" to `banana`. */
export function familyOf(productName: string): string {
  const key = productName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  for (const [pattern, family] of RULES) if (pattern.test(key)) return family
  return 'other'
}
