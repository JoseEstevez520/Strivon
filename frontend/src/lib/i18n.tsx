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
  searchProducts: string
  shortOf: (short: number, total: number) => string
  allGondolas: string
  loading: string
  orderNote: string
  showMore: (n: number) => string
  showAll: (n: number) => string
  showFewer: string
  withProduct: (names: string) => string
  noMatches: string
  areasCount: (n: number) => string
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
  searchProducts: 'Search products',
  shortOf: (s, n) => (s === 0 ? 'All fine' : n === 1 ? 'Short' : `${s} of ${n} areas short`),
  allGondolas: 'All gondolas',
  loading: 'Checking the shelves…',
  orderNote: 'Most urgent first: what is out in most places, then what has waited longest.',
  showMore: (n) => `Show ${n} more`,
  showAll: (n) => `Show ${n}`,
  showFewer: 'Show fewer',
  withProduct: (x) => `with ${x}`,
  noMatches: 'Nothing matches',
  areasCount: (n) => `${n} areas`,
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
  searchProducts: 'Procurar produtos',
  shortOf: (s, n) => (s === 0 ? 'Tudo bem' : n === 1 ? 'Em falta' : `${s} de ${n} áreas em falta`),
  allGondolas: 'Todas as gôndolas',
  loading: 'A verificar as prateleiras…',
  orderNote: 'O mais urgente primeiro: o que falta em mais sítios e, depois, o que espera há mais tempo.',
  showMore: (n) => `Mostrar mais ${n}`,
  showAll: (n) => `Mostrar ${n}`,
  showFewer: 'Mostrar menos',
  withProduct: (x) => `com ${x}`,
  noMatches: 'Nada encontrado',
  areasCount: (n) => `${n} áreas`,
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
  searchProducts: 'Buscar productos',
  shortOf: (s, n) => (s === 0 ? 'Todo bien' : n === 1 ? 'Con falta' : `${s} de ${n} zonas con falta`),
  allGondolas: 'Todas las góndolas',
  loading: 'Revisando las estanterías…',
  orderNote: 'Lo más urgente primero: lo que falta en más sitios y, después, lo que lleva más tiempo esperando.',
  showMore: (n) => `Mostrar ${n} más`,
  showAll: (n) => `Mostrar ${n}`,
  showFewer: 'Mostrar menos',
  withProduct: (x) => `con ${x}`,
  noMatches: 'Sin resultados',
  areasCount: (n) => `${n} zonas`,
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

const read = (): Lang => {
  try {
    const v = localStorage.getItem('strivon.lang')
    if (v === 'en' || v === 'pt' || v === 'es') return v
  } catch {
    // private mode: fall back to English
  }
  return 'en'
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
