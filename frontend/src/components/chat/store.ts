import { useSyncExternalStore } from 'react'

/** A question, or an answer as the OpenUI Lang a model writes. */
export interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

interface State {
  messages: Message[]
  /** The id of the answer still being written, or 0. */
  streaming: number
  next: number
  open: boolean
  wide: boolean
}

/**
 * The conversation lives outside the components, so a link in an answer can take you to another
 * page and the chat is as you left it when you come back, answer still arriving or not.
 */
let state: State = { messages: [], streaming: 0, next: 1, open: false, wide: false }
const listeners = new Set<() => void>()

export const chatStore = {
  get: () => state,
  set(patch: Partial<State> | ((s: State) => Partial<State>)) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    listeners.forEach((l) => l())
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export const useChat = () => useSyncExternalStore(chatStore.subscribe, chatStore.get)
