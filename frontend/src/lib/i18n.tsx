import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

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
  families: Record<string, string>
}

const en: Strings = {
  level: { empty: 'Empty', half: 'Half full', full: 'Full' },
  throughDay: 'Through the day',
  close: 'Close',
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
  families: { banana: 'Banana', apple_red: 'Red apple', pear: 'Pear', citrus_orange: 'Orange', tomato: 'Tomato', kiwi: 'Kiwi' },
}

const pt: Strings = {
  level: { empty: 'Vazio', half: 'A meio', full: 'Cheio' },
  throughDay: 'Ao longo do dia',
  close: 'Fechar',
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
  families: { banana: 'Banana', apple_red: 'Maçã vermelha', pear: 'Pera', citrus_orange: 'Laranja', tomato: 'Tomate', kiwi: 'Kiwi' },
}

const es: Strings = {
  level: { empty: 'Vacío', half: 'A medias', full: 'Lleno' },
  throughDay: 'A lo largo del día',
  close: 'Cerrar',
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
  families: { banana: 'Plátano', apple_red: 'Manzana roja', pear: 'Pera', citrus_orange: 'Naranja', tomato: 'Tomate', kiwi: 'Kiwi' },
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
      family: (key) => t.families[key] ?? key,
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
