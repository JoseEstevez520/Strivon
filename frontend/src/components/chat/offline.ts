/**
 * Stands in for the model until one is connected: it reads a question by its words and writes the
 * answer in OpenUI Lang, the same text a model would write. It picks parts and never writes a
 * figure, so swapping it for a model changes who chooses, not how an answer is drawn.
 */
const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

export function answer(question: string, products: { key: string; label: string }[]): string {
  const q = question.toLowerCase()
  const named = products.filter((p) => q.includes(p.label.toLowerCase()))

  if (named.length) {
    const keys = named.map((p) => JSON.stringify(p.key)).join(', ')
    return `root = Answer([DayMap([${keys}])])`
  }
  if (has(q, 'gondola', 'góndola', 'gôndola', 'attention', 'atención', 'atenção', 'atencion', 'worst', 'peor', 'pior'))
    return 'root = Answer([Ranked("gondolas", 5)])'
  if (has(q, 'restock', 'repon', 'repor', 'first', 'primero', 'primeiro'))
    return 'root = Answer([Ranked("products", 5)])'
  if (has(q, 'plano', 'planogram', 'right product', 'compliance', 'cumpl'))
    return 'root = Answer([Stat("compliance")])'
  if (has(q, 'empty', 'vací', 'vazi', 'vaci', 'time', 'tiempo', 'tempo', 'how is', 'cómo va', 'como vai'))
    return 'root = Answer([Stat("empty"), DayMap()])'
  return 'root = Answer([Stat("empty"), Ranked("products", 5)])'
}
