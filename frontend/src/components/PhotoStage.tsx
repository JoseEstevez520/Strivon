import { GROUP_COLOR } from './groupStyle'
import { IMAGE_SIZE } from '@/model/types'
import type { Task } from '@/lib/tasks'

interface Props {
  tasks: Task[]
  selected: string | null
  onSelect: (areaId: string) => void
  /** The camera photo. A flat placeholder shows when there is none. */
  src?: string | null
}

/** The camera photo with every shelf area drawn over it. */
export function PhotoStage({ tasks, selected, onSelect, src }: Props) {
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
                fillOpacity={on ? 0.3 : 0.12}
                stroke={color}
                strokeWidth={on ? 8 : 5}
                strokeLinejoin="round"
                className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-20"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
