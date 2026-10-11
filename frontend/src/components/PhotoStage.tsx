import { GROUP_COLOR } from './groupStyle'
import { FAMILY_ICON, ICON_BODY } from '@/model/produceIcons'
import { IMAGE_SIZE } from '@/model/types'
import type { Task } from '@/lib/tasks'

interface Props {
  tasks: Task[]
  selected: string | null
  onSelect: (areaId: string) => void
  /** The camera photo. A flat placeholder shows when there is none. */
  src?: string | null
  /** Mark what is missing or misplaced with its product's icon on a red or amber disc, and colour empty areas stronger. */
  marks?: boolean
}

/** The camera photo with every shelf area drawn over it. */
export function PhotoStage({ tasks, selected, onSelect, src, marks = false }: Props) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-[#d6d8d0]">
      {src && <img src={src} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />}
      <svg
        viewBox={`0 0 ${IMAGE_SIZE.width} ${IMAGE_SIZE.height}`}
        className="absolute inset-0 size-full"
        role="img"
        aria-label="Camera photo with shelf areas"
      >
        {tasks.map((task) => {
          const points = task.area.quad.map((p) => p.join(',')).join(' ')
          const color = GROUP_COLOR[task.group]
          const on = selected === task.area.area_id
          return (
            <g key={task.area.area_id}>
              {/* A pale outline under the colour, so it reads over a busy photo. */}
              <polygon points={points} fill="none" stroke="white" strokeOpacity={0.6} strokeWidth={on ? 13 : 9} strokeLinejoin="round" pointerEvents="none" />
              <polygon
                points={points}
                onClick={() => onSelect(task.area.area_id)}
                fill={color}
                fillOpacity={on ? 0.4 : marks && task.group === 'restock' ? 0.2 : 0.12}
                stroke={color}
                strokeWidth={on ? 8 : 5}
                strokeLinejoin="round"
                className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-20"
              />
            </g>
          )
        })}
        {marks &&
          tasks
            .filter((x) => x.group === 'restock' || x.group === 'moveBack')
            .map((task) => {
              const xs = task.area.quad.map((p) => p[0])
              const ys = task.area.quad.map((p) => p[1])
              // A small badge in the top-left corner of the area, so the product itself stays in view.
              const side = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
              const size = Math.max(16, Math.min(26, side * 0.3))
              const cx = Math.min(...xs) + size * 0.85
              const cy = Math.min(...ys) + size * 0.85
              const body = ICON_BODY[FAMILY_ICON[task.area.family]]
              const color = GROUP_COLOR[task.group]
              return (
                <g key={`mark-${task.area.area_id}`} pointerEvents="none">
                  <circle cx={cx} cy={cy} r={size * 0.78} fill={color} stroke="white" strokeWidth={3} />
                  {body && (
                    <g transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 32})`} color="white" dangerouslySetInnerHTML={{ __html: body }} />
                  )}
                </g>
              )
            })}
      </svg>
    </div>
  )
}
