import { CameraTile } from '@/components/CameraTile'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars, type RankedItem } from '@/components/day/RankedBars'
import { StatLine } from '@/components/day/StatLine'
import type { MapRow } from '@/lib/stats'

/**
 * What an answer is made of. Each part is one of the app's own components, so an answer looks like
 * the rest of the app. This is the vocabulary an assistant may use: whatever answers later, a
 * model or a rule, returns these parts and nothing else, and the numbers inside are worked out by
 * code, not by the model.
 */
export type AnswerBlock =
  | { type: 'text'; text: string }
  | { type: 'stat'; text: string; note?: string }
  | { type: 'ranked'; items: RankedItem[] }
  | { type: 'dayMap'; rows: MapRow[]; hours: number[] }
  | { type: 'gondola'; camera: string }

export function AnswerBlockView({ block }: { block: AnswerBlock }) {
  switch (block.type) {
    case 'text':
      return <p className="text-ui text-fg-secondary">{block.text}</p>
    case 'stat':
      return <StatLine note={block.note}>{block.text}</StatLine>
    case 'ranked':
      return <RankedBars items={block.items} />
    case 'dayMap':
      return <DayMap rows={block.rows} hours={block.hours} />
    case 'gondola':
      return (
        <div className="max-w-xs">
          <CameraTile camera={block.camera} />
        </div>
      )
  }
}
