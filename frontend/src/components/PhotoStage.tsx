import { GROUP_COLOR } from './groupStyle'
import { IMAGE_SIZE } from '@/data/types'
import type { Task } from '@/lib/tasks'

interface Props {
  tasks: Task[]
  selected: string | null
  onSelect: (areaId: string) => void
}

/**
 * The camera photo with every shelf area drawn over it. The photo is a flat placeholder until the
 * real image comes from the API.
 */
export function PhotoStage({ tasks, selected, onSelect }: Props) {
  return (
    <div className="overflow-hidden rounded-xl bg-[#d6d8d0]">
      <svg
        viewBox={`0 0 ${IMAGE_SIZE.width} ${IMAGE_SIZE.height}`}
        className="block w-full"
        role="img"
        aria-label="Camera photo with shelf areas"
      >
        {tasks.map((task) => {
          const points = task.area.quad.map((p) => p.join(',')).join(' ')
          const color = GROUP_COLOR[task.group]
          const on = selected === task.area.area_id
          return (
            <polygon
              key={task.area.area_id}
              points={points}
              onClick={() => onSelect(task.area.area_id)}
              fill={color}
              fillOpacity={on ? 0.2 : 0}
              stroke={color}
              strokeWidth={on ? 4 : 2.5}
              strokeLinejoin="round"
              className="cursor-pointer transition-[fill-opacity] hover:fill-opacity-10"
            />
          )
        })}
      </svg>
    </div>
  )
}
