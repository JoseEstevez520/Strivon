import { Billboard, OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import * as THREE from 'three'
import { ProductIcon } from '@/components/ProductIcon'
import { Segmented } from '@/components/ui/segmented'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { cameras, type Task } from '@/lib/tasks'
import { FAMILY_ICON, ICON_BODY } from '@/model/produceIcons'

/*
 * The store as a small 3D diorama, for the lab. Gondolas are rounded boxes standing on a floor with
 * low walls and a door; each box carries a flat tile for what is empty or in the wrong place, with
 * its product icon. The camera is orthographic, the usual isometric look, and the person can turn
 * it a little. The colours are the app's tokens, lit flat so they read the same as everywhere
 * else, and there are no cast shadows. Pressing a gondola opens its page.
 */

const C = {
  bg: '#f8f7f4',
  sunk: '#e6e4dd',
  raised: '#ffffff',
  box: '#fbfaf8',
  wall: '#cfcdc7',
  fg: '#1d1d1d',
  danger: '#c4452f',
  warning: '#b7791f',
  success: '#3f8a4f',
}
const tint = (c: string, pct: number, base = C.raised) => new THREE.Color(base).lerp(new THREE.Color(c), pct / 100).getStyle()

// World units. A gondola is a shelf unit W wide, D deep and H tall, facing the front.
const W = 3.8
const D = 2.0
const GAP_X = 0.8
const GAP_Z = 2.5
const MARGIN = 1.1
/** The floor grows with the number of gondolas: a square-ish grid, at most four across. */
const layoutOf = (count: number) => {
  const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(count))))
  const rows = Math.max(1, Math.ceil(count / cols))
  return { cols, floorW: cols * W + (cols - 1) * GAP_X + MARGIN * 2, floorD: rows * D + (rows - 1) * GAP_Z + MARGIN * 2 + 1.8 }
}

type Look = 'critical' | 'empty' | 'wrong' | 'half' | 'fine'
const lookOf = (x: Task): Look =>
  x.group === 'moveBack' ? 'wrong' : x.group === 'restock' ? (x.urgency >= 0.5 ? 'critical' : 'empty') : x.group === 'later' ? 'half' : 'fine'
const BODY: Record<Look, string> = {
  critical: tint(C.danger, 42),
  empty: tint(C.danger, 22),
  wrong: tint(C.warning, 36),
  half: '#e4e1d9',
  fine: '#f3f1ec',
}
const INK: Record<Look, string> = { critical: C.danger, empty: tint(C.danger, 85, C.fg), wrong: C.warning, half: '#8d8c85', fine: '#a9a8a1' }
const loud = (l: Look) => l === 'critical' || l === 'empty' || l === 'wrong'

/** A white icon on a transparent ground, for the disc of a pin. */
const pinTextures = new Map<string, THREE.Texture>()
function pinTexture(family: string, onLoad: () => void): THREE.Texture {
  const hit = pinTextures.get(family)
  if (hit) return hit
  const body = ICON_BODY[FAMILY_ICON[family]] ?? ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256"><g color="#ffffff" fill="#ffffff" transform="translate(1 1) scale(.94)">${body}</g></svg>`
  const texture = new THREE.Texture()
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const img = new Image()
  img.onload = () => {
    texture.image = img
    texture.needsUpdate = true
    onLoad()
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  pinTextures.set(family, texture)
  return texture
}

/** The name of a gondola, painted on the front face of its box: the number of the round or a green tick at the right. */
function useLabel(name: string, rank: number, fine: boolean) {
  const invalidate = useThree((s) => s.invalidate)
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    const draw = () => {
      const g = canvas.getContext('2d')!
      g.clearRect(0, 0, canvas.width, canvas.height)
      g.fillStyle = C.fg
      g.font = '500 112px "Inter Variable", Inter, system-ui, sans-serif'
      g.textBaseline = 'middle'
      g.fillText(name, 56, 132)
      if (rank > 0) {
        g.fillStyle = C.sunk
        g.beginPath()
        g.arc(900, 128, 84, 0, Math.PI * 2)
        g.fill()
        g.fillStyle = '#51554c'
        g.font = '500 96px "Inter Variable", Inter, system-ui, sans-serif'
        g.textAlign = 'center'
        g.fillText(String(rank), 900, 134)
        g.textAlign = 'left'
      } else if (fine) {
        g.strokeStyle = C.success
        g.lineWidth = 26
        g.lineCap = 'round'
        g.lineJoin = 'round'
        g.beginPath()
        g.moveTo(850, 136)
        g.lineTo(896, 182)
        g.lineTo(968, 84)
        g.stroke()
      }
      texture.needsUpdate = true
      invalidate()
    }
    draw()
    void document.fonts.ready.then(draw)
    return texture
  }, [name, rank, fine, invalidate])
}

interface GondolaProps {
  position: [number, number]
  tasks: Task[]
  rank: number
  name: string
  hovered: boolean
  onHover: (on: boolean) => void
  onOpen: () => void
}

/** The areas of a gondola grouped in shelves, from the top one down, each from left to right. */
function shelves(tasks: Task[]): Task[][] {
  const cy = (x: Task) => x.area.quad.reduce((sum, p) => sum + p[1], 0) / 4
  const cx = (x: Task) => x.area.quad.reduce((sum, p) => sum + p[0], 0) / 4
  const rows = new Map<number, Task[]>()
  for (const x of tasks) {
    const k = Math.round(cy(x) / 150)
    rows.set(k, [...(rows.get(k) ?? []), x])
  }
  const out = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v.sort((a, b) => cx(a) - cx(b)))
  // Never more than three shelves: fold the extra ones into the last.
  while (out.length > 3) out[out.length - 2] = [...out[out.length - 2], ...out.pop()!]
  return out
}

/** What a crate holds, drawn so it reads without a legend: a full one is a heap, a half one a low heap, an empty one is a hollow tray. */
const HEAP: Record<Look, number> = { critical: 0, empty: 0, wrong: 0.2, half: 0.09, fine: 0.2 }
const HEAP_COLOR: Record<Look, string> = {
  critical: '#cfc8bb',
  empty: '#cfc8bb',
  wrong: tint(C.warning, 45, '#e4dcc8'),
  half: '#dcd7c9',
  fine: '#dcd7c9',
}

/** How each family looks as a solid: a shape, its colour, and an optional second colour (stem, crown). */
type Shape = 'ball' | 'ovoid' | 'long' | 'pear' | 'banana' | 'pineapple' | 'bunch' | 'floret' | 'leaf' | 'pepper' | 'flat' | 'bulb'
const PRODUCE: Record<string, [Shape, string, string?]> = {
  banana: ['banana', '#e9c53a'], plantain: ['banana', '#c9c24a'],
  citrus_orange: ['ball', '#ef8f2a'], lemon: ['ovoid', '#f0d83c'], lime: ['ball', '#7fb83a'],
  watermelon: ['ovoid', '#4f9a4a', '#2f6e34'], melon: ['ball', '#d9c58a'],
  apple_green: ['ball', '#9ccb4a', '#6b4a2a'], apple_russet: ['ball', '#b9803a', '#6b4a2a'], apple_red: ['ball', '#d23a35', '#6b4a2a'],
  pear: ['pear', '#bcc84a'], kiwi: ['ovoid', '#8a6b3c'],
  leafy: ['leaf', '#4fa04a'], broccoli: ['floret', '#3f8f45', '#9cc06a'], red_cabbage: ['leaf', '#8a3f78'],
  cauliflower: ['floret', '#ece6d0', '#9cc06a'], cabbage: ['leaf', '#9cc06a'],
  avocado: ['pear', '#3f6b3a'], pepper_green: ['pepper', '#4fa04a'], pepper_red: ['pepper', '#d23a35'],
  eggplant: ['long', '#5a3a7a'], chayote: ['pear', '#9cc06a'], green_beans: ['long', '#5aa046'], cucumber: ['long', '#3f8f45'],
  tomato: ['ball', '#df3b2f', '#4fa04a'], strawberry: ['pear', '#d9344a', '#4fa04a'], mango: ['ovoid', '#f0a030'],
  grape_red: ['bunch', '#7a2f5a'], grape_white: ['bunch', '#b8cf6a'], cherry: ['bunch', '#b3202f'],
  pineapple: ['pineapple', '#e0a830', '#4f8f3a'], pitaya: ['ovoid', '#d93a8a', '#4fa04a'], guava: ['ball', '#b9cf6a'],
  passion_fruit: ['ball', '#7a3a6a'], papaya: ['ovoid', '#f0a040'], stone_fruit: ['ball', '#f0a070'],
  onion: ['bulb', '#d9a55a', '#b98a3a'], onion_red: ['bulb', '#8a3f6a', '#6a2f50'], garlic: ['bulb', '#ece4d0', '#cfc4a8'],
  sweet_potato: ['long', '#b0603a'], potato: ['ovoid', '#c9a46a'], ginger: ['long', '#d0b27a'], pumpkin: ['flat', '#ef8f2a', '#4f8f3a'],
}
const FALLBACK: [Shape, string] = ['ball', '#c9b98a']

/** One piece of produce, about 0.2 across, sitting on y = 0. */
function Piece({ shape, color, accent, grey, ghost }: { shape: Shape; color: string; accent?: string; grey?: boolean; ghost?: boolean }) {
  const m = (c: string) =>
    ghost ? (
      <meshStandardMaterial color={tint(C.danger, 55, c)} roughness={1} transparent opacity={0.32} depthWrite={false} />
    ) : (
      <meshStandardMaterial color={grey ? tint('#9a9486', 30, c) : c} roughness={0.85} />
    )
  const a = accent ?? color
  switch (shape) {
    case 'ovoid':
      return (
        <mesh position={[0, 0.09, 0]} scale={[1.25, 0.9, 0.9]}>
          <sphereGeometry args={[0.1, 14, 10]} />
          {m(color)}
        </mesh>
      )
    case 'long':
      return (
        <mesh position={[0, 0.06, 0]} rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.05, 0.16, 4, 10]} />
          {m(color)}
        </mesh>
      )
    case 'pear':
      return (
        <group>
          <mesh position={[0, 0.07, 0]}>
            <sphereGeometry args={[0.09, 14, 10]} />
            {m(color)}
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <sphereGeometry args={[0.058, 12, 8]} />
            {m(color)}
          </mesh>
        </group>
      )
    case 'banana':
      return (
        <mesh position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, Math.PI * 0.1]}>
          <torusGeometry args={[0.13, 0.036, 8, 18, Math.PI * 0.8]} />
          {m(color)}
        </mesh>
      )
    case 'pineapple':
      return (
        <group>
          <mesh position={[0, 0.11, 0]} scale={[1, 1.25, 1]}>
            <sphereGeometry args={[0.085, 14, 10]} />
            {m(color)}
          </mesh>
          <mesh position={[0, 0.27, 0]}>
            <coneGeometry args={[0.055, 0.14, 7]} />
            {m(a)}
          </mesh>
        </group>
      )
    case 'bunch':
      return (
        <group>
          {[[0, 0.05, 0], [0.07, 0.05, 0.03], [-0.07, 0.05, 0.02], [0.03, 0.05, -0.07], [-0.02, 0.12, 0.0], [0.05, 0.12, -0.02]].map((q, i) => (
            <mesh key={i} position={q as [number, number, number]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              {m(color)}
            </mesh>
          ))}
        </group>
      )
    case 'floret':
      return (
        <group>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 0.08, 8]} />
            {m(a)}
          </mesh>
          {[[0, 0.14, 0, 0.075], [0.07, 0.11, 0.02, 0.058], [-0.065, 0.11, 0.0, 0.058], [0.0, 0.11, -0.07, 0.05]].map((q, i) => (
            <mesh key={i} position={[q[0], q[1], q[2]]}>
              <sphereGeometry args={[q[3], 10, 8]} />
              {m(color)}
            </mesh>
          ))}
        </group>
      )
    case 'leaf':
      return (
        <mesh position={[0, 0.06, 0]} scale={[1.2, 0.6, 1.1]}>
          <sphereGeometry args={[0.11, 12, 8]} />
          {m(color)}
        </mesh>
      )
    case 'pepper':
      return (
        <group>
          <mesh position={[0, 0.09, 0]} scale={[0.9, 1.1, 0.9]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            {m(color)}
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.05, 6]} />
            {m('#4f7a3a')}
          </mesh>
        </group>
      )
    case 'bulb':
      return (
        <group>
          <mesh position={[0, 0.075, 0]} scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.09, 14, 10]} />
            {m(color)}
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <coneGeometry args={[0.03, 0.07, 8]} />
            {m(a)}
          </mesh>
        </group>
      )
    case 'flat':
      return (
        <mesh position={[0, 0.07, 0]} scale={[1.15, 0.75, 1.15]}>
          <sphereGeometry args={[0.11, 14, 10]} />
          {m(color)}
        </mesh>
      )
    default:
      return (
        <group>
          <mesh position={[0, 0.09, 0]}>
            <sphereGeometry args={[0.09, 14, 10]} />
            {m(color)}
          </mesh>
          {accent && (
            <mesh position={[0, 0.185, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.04, 6]} />
              {m(accent)}
            </mesh>
          )}
        </group>
      )
  }
}

/** One product laid in a crate, counted so the state reads without a legend: four when full, two when half, none when empty (one faint ghost says what is missing). A wrong product is the full pile, washed out. */
function Produce({ family, look, w, d, y }: { family: string; look: Look; w: number; d: number; y: number }) {
  const [shape, color, accent] = PRODUCE[family] ?? FALLBACK
  const gone = look === 'empty' || look === 'critical'
  const spots: [number, number, number][] =
    gone
      ? [[0, 0, 0.4]]
      : look === 'half'
        ? [[-0.22, 0, 0.4], [0.22, 0, 1.9]]
        : [[-0.24, -0.2, 0.3], [0.24, -0.2, 1.4], [-0.24, 0.2, 2.2], [0.24, 0.2, 3.1]]
  return (
    <group position={[0, y, 0]}>
      {spots.map(([sx, sz, r], i) => (
        <group key={i} position={[sx * w, 0, sz * d]} rotation-y={r} scale={Math.min(2.4, w / 0.45, d / 0.4) * (gone ? 1 : 0.85)}>
          <Piece shape={shape} color={color} accent={accent} grey={look === 'wrong'} ghost={gone} />
        </group>
      ))}
    </group>
  )
}

/** One crate on a step: a tray with a heap of produce in it, or hollow when empty, with the product's icon above. */
function Crate({ x, y, z, w, d, look, family, odd }: { x: number; y: number; z: number; w: number; d: number; look: Look; family: string; odd: boolean }) {
  const invalidate = useThree((s) => s.invalidate)
  const pin = useMemo(() => (loud(look) ? pinTexture(family, invalidate) : null), [family, look, invalidate])
  const radius = Math.min(0.26, w * 0.5)
  const stem = odd ? 0.6 : 0.4
  const color = look === 'wrong' ? C.warning : C.danger
  const h = 0.14
  const heap = HEAP[look]
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[w, h, d]} radius={0.05} smoothness={3} position={[0, h / 2, 0]}>
        <meshStandardMaterial color={BODY[look]} roughness={1} />
      </RoundedBox>
      {heap === 0 && (
        <mesh rotation-x={-Math.PI / 2} position={[0, h + 0.003, 0]}>
          <planeGeometry args={[w * 0.74, d * 0.74]} />
          <meshBasicMaterial color={tint(C.danger, look === 'critical' ? 30 : 16, '#bdb6a8')} />
        </mesh>
      )}
      <Produce family={family} look={look} w={w} d={d} y={h} />
      {pin && (
        <group position={[0, h + heap, 0]}>
          <mesh position={[0, stem / 2, 0]}>
            <cylinderGeometry args={[0.022, 0.022, stem, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Billboard position={[0, stem + radius * 0.9, 0]}>
            <mesh renderOrder={8}>
              <circleGeometry args={[radius, 28]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0, 0.002]} renderOrder={9}>
              <planeGeometry args={[radius * 1.35, radius * 1.35]} />
              <meshBasicMaterial map={pin} transparent toneMapped={false} />
            </mesh>
          </Billboard>
        </group>
      )}
    </group>
  )
}

/**
 * One gondola, as a stepped shelf: the shelves rise toward the back like stairs, so every crate on
 * every shelf can be seen from above, and the name stands on a board at the back. It lifts when
 * pointed at.
 */
function Gondola({ position, tasks, rank, name, hovered, onHover, onOpen }: GondolaProps) {
  const group = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const rows = useMemo(() => shelves(tasks), [tasks])
  const fine = !tasks.some((x) => loud(lookOf(x)))
  const label = useLabel(name, rank, fine)
  const n = Math.max(1, rows.length)
  const step = D / n
  const topY = (k: number) => 0.42 + (n - 1 - k) * 0.5
  const cols = Math.max(1, ...rows.map((r) => r.length))
  const slot = (W - 0.5) / cols
  const crateW = Math.min(slot * 0.88, 0.78)
  const crateD = Math.min(step * 0.82, 0.78)
  const board = topY(0) + 1.7

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = hovered ? 0.2 : 0
    const next = g.position.y + (target - g.position.y) * Math.min(1, dt * 14)
    g.position.y = Math.abs(target - next) < 0.002 ? target : next
    if (g.position.y !== target) invalidate()
  })

  const frame = fine ? tint(C.success, 22, C.box) : hovered ? C.raised : '#fdfcfa'
  return (
    <group
      position={[position[0], 0, position[1]]}
      onPointerOver={(e) => {
        e.stopPropagation()
        onHover(true)
      }}
      onPointerOut={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
    >
      <group ref={group}>
        {/* the steps */}
        {rows.map((_, k) => (
          <RoundedBox key={k} args={[W, topY(k), step]} radius={0.06} smoothness={3} position={[0, topY(k) / 2, -D / 2 + (k + 0.5) * step]}>
            <meshStandardMaterial color={frame} roughness={1} />
          </RoundedBox>
        ))}
        {/* the board at the back, with the name on its front */}
        <RoundedBox args={[W, board, 0.14]} radius={0.05} smoothness={3} position={[0, board / 2, -D / 2 - 0.07]}>
          <meshStandardMaterial color={frame} roughness={1} />
        </RoundedBox>
        <mesh position={[0, board - 0.36, -D / 2 + 0.004]}>
          <planeGeometry args={[W - 0.3, (W - 0.3) / 4.2]} />
          <meshBasicMaterial map={label} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {rows.map((row, k) =>
          row.map((x, i) => (
            <Crate
              key={x.area.area_id}
              x={-((row.length - 1) * slot) / 2 + i * slot}
              y={topY(k)}
              z={-D / 2 + (k + 0.5) * step}
              w={crateW}
              d={crateD}
              look={lookOf(x)}
              family={x.area.family}
              odd={i % 2 === 1}
            />
          )),
        )}
      </group>
    </group>
  )
}

/** The floor with low walls on three sides and an opening in the front wall. */
function Room({ count }: { count: number }) {
  const { floorW: FLOOR_W, floorD: FLOOR_D } = layoutOf(count)
  const wallH = 0.8
  const t = 0.45
  const doorW = 3.6
  const doorX = 0
  return (
    <group>
      <RoundedBox args={[FLOOR_W, 0.5, FLOOR_D]} radius={0.12} smoothness={3} position={[0, -0.25, 0]}>
        <meshStandardMaterial color={C.sunk} roughness={1} />
      </RoundedBox>
      {/* back and side walls */}
      <RoundedBox args={[FLOOR_W, wallH, t]} radius={0.1} smoothness={3} position={[0, wallH / 2, -FLOOR_D / 2 + t / 2]}>
        <meshStandardMaterial color={C.wall} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[t, wallH, FLOOR_D]} radius={0.1} smoothness={3} position={[-FLOOR_W / 2 + t / 2, wallH / 2, 0]}>
        <meshStandardMaterial color={C.wall} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[t, wallH, FLOOR_D]} radius={0.1} smoothness={3} position={[FLOOR_W / 2 - t / 2, wallH / 2, 0]}>
        <meshStandardMaterial color={C.wall} roughness={1} />
      </RoundedBox>
      {/* the front wall, in two pieces with the door between them */}
      {(() => {
        const left = doorX - doorW / 2 + FLOOR_W / 2
        const right = FLOOR_W - left - doorW
        return (
          <>
            <RoundedBox args={[left, wallH, t]} radius={0.1} smoothness={3} position={[-FLOOR_W / 2 + left / 2, wallH / 2, FLOOR_D / 2 - t / 2]}>
              <meshStandardMaterial color={C.wall} roughness={1} />
            </RoundedBox>
            <RoundedBox args={[right, wallH, t]} radius={0.1} smoothness={3} position={[FLOOR_W / 2 - right / 2, wallH / 2, FLOOR_D / 2 - t / 2]}>
              <meshStandardMaterial color={C.wall} roughness={1} />
            </RoundedBox>
          </>
        )
      })()}
      {/* the threshold, a little lighter than the floor */}
      <mesh rotation-x={-Math.PI / 2} position={[doorX, 0.004, FLOOR_D / 2 - 1.2]}>
        <planeGeometry args={[doorW, 2.2]} />
        <meshBasicMaterial color="#f1efe9" />
      </mesh>
    </group>
  )
}

const VIEWS = {
  front: [5, 21, 21],
  corner: [17, 19, 17],
} as const
export type View = keyof typeof VIEWS

/** Fits the floor in the frame whatever the width, and starts from the chosen side. */
function Rig({ view }: { view: View }) {
  const size = useThree((s) => s.size)
  const zoom = Math.min(size.width / 25, size.height / 19.4)
  return <OrthographicCamera makeDefault position={[...VIEWS[view]]} zoom={zoom} near={0.1} far={200} />
}

/** Moves the camera in on the selected gondola, and back out when nothing is selected. It only drives the camera for a moment after the selection changes, so dragging and zooming stay free. */
function Focus({ target }: { target: [number, number] | null }) {
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const until = useRef(0)
  const base = Math.min(size.width / 25, size.height / 19.4)
  useEffect(() => {
    until.current = performance.now() + 1100
    invalidate()
  }, [target, invalidate])
  useFrame((_, dt) => {
    if (!controls || performance.now() > until.current) return
    const goal = target ? new THREE.Vector3(target[0], 0.9, target[1]) : new THREE.Vector3(0, 0.5, 1)
    const k = Math.min(1, dt * 5)
    const before = controls.target.clone()
    controls.target.lerp(goal, k)
    camera.position.add(controls.target.clone().sub(before))
    camera.zoom += ((target ? base * (size.width < 640 ? 3.4 : 2.7) : base) - camera.zoom) * k
    camera.updateProjectionMatrix()
    controls.update()
    invalidate()
  })
  return null
}

export function Scene({ view, selected = null, onOpen, onHoverChange }: { view: View; selected?: string | null; onOpen: (camera: string) => void; onHoverChange: (camera: string | null) => void }) {
  const { state, tasks, gondola } = useStore()
  const list = cameras(state)
  const ranking = useMemo(() => suggest(tasks).filter((s) => s.empty + s.wrong > 0), [tasks])
  const rankOf = (c: string) => (ranking.findIndex((s) => s.camera === c) < 3 ? ranking.findIndex((s) => s.camera === c) + 1 : 0)
  const byCamera = useMemo(() => {
    const m: Record<string, Task[]> = {}
    for (const x of tasks) (m[x.area.camera] ??= []).push(x)
    return m
  }, [tasks])
  const [hover, setHover] = useState<string | null>(null)
  const { cols: COLS, floorW: FLOOR_W, floorD: FLOOR_D } = layoutOf(list.length)
  const spot = (n: number): [number, number] => [
    -FLOOR_W / 2 + MARGIN + W / 2 + (n % COLS) * (W + GAP_X),
    -FLOOR_D / 2 + MARGIN + D / 2 + 0.2 + Math.floor(n / COLS) * (D + GAP_Z),
  ]
  const focusAt = selected ? spot(list.indexOf(selected)) : null

  useEffect(() => {
    onHoverChange(hover)
    document.body.style.cursor = hover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hover, onHoverChange])

  return (
    <>
      <Rig view={view} />
      <Focus target={focusAt} />
      <ambientLight intensity={2.2} />
      <directionalLight position={[8, 16, 10]} intensity={1.5} />
      <Room count={list.length} />
      {list.map((c, n) => {
        const [x, z] = spot(n)
        return (
          <Gondola
            key={c}
            position={[x, z]}
            tasks={byCamera[c] ?? []}
            rank={rankOf(c)}
            name={gondola(c)}
            hovered={hover === c}
            onHover={(on) => setHover(on ? c : hover === c ? null : hover)}
            onOpen={() => onOpen(c)}
          />
        )
      })}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={0.55}
        maxPolarAngle={1.25}
        minAzimuthAngle={-0.7}
        maxAzimuthAngle={1.55}
        minZoom={12}
        maxZoom={80}
        target={[0, 0.5, 1]}
      />
    </>
  )
}

/** The store as a 3D diorama. Not in the menu: /lab/map-3d. */
export function Store3D() {
  const { t, family } = useI18n()
  const navigate = useNavigate()
  const [key, setKey] = useState(0)
  const [view, setView] = useState<View>('front')
  const [hover, setHover] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('g'))
  const { tasks, gondola } = useStore()
  const webgl = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
    } catch {
      return false
    }
  }, [])
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  // Everything in the gondola pointed at or picked, by product and state: what is there and what is not.
  const shown = selected ?? hover
  const rows = useMemo(() => {
    const m = new Map<string, { key: string; family: string; look: Look; n: number }>()
    for (const x of tasks.filter((y) => y.area.camera === shown)) {
      const look = lookOf(x) === 'critical' ? 'empty' : lookOf(x)
      const k = `${look}:${x.area.family}`
      const row = m.get(k) ?? { key: k, family: x.area.family, look, n: 0 }
      row.n += 1
      m.set(k, row)
    }
    const order: Record<Look, number> = { critical: 0, empty: 0, wrong: 1, half: 2, fine: 3 }
    return [...m.values()].sort((a, b) => order[a.look] - order[b.look] || b.n - a.n)
  }, [tasks, shown])
  const word = (l: Look) => (l === 'wrong' ? t.wrongProduct : l === 'half' ? t.level.half : l === 'fine' ? t.level.full : t.level.empty)

  return (
    <>
      <Segmented
        className="mb-3"
        label="Camera"
        options={[
          { value: 'front', label: 'Front' },
          { value: 'corner', label: 'Corner' },
        ]}
        on={(v) => view === v}
        onPick={(v) => {
          setView(v as View)
          setSelected(null)
          setKey(key + 1)
        }}
      />
      <div className="relative overflow-hidden rounded-2xl" style={{ background: C.bg }}>
        <div className="h-[58dvh] min-h-[22rem] sm:h-[min(84dvh,54rem)] sm:min-h-[26rem]">
        {webgl ? (
          <Canvas key={key} flat dpr={[1, 2]} frameloop="demand" gl={{ antialias: true }} onPointerMissed={() => setSelected(null)}>
            <Scene
              view={view}
              selected={selected}
              onOpen={(c) => (selected === c ? navigate(`/gondolas/${c}`) : setSelected(c))}
              onHoverChange={setHover}
            />
          </Canvas>
        ) : (
          <p className="grid size-full place-items-center text-ui text-fg-secondary">This browser cannot draw 3D.</p>
        )}
        </div>
        {shown && (
          <div className="m-3 rounded-xl bg-raised p-3 sm:absolute sm:top-3 sm:left-3 sm:m-0 sm:w-64" style={{ pointerEvents: selected ? 'auto' : 'none' }}>
            <p className="mb-2 text-label">{gondola(shown)}</p>
            <ul className="flex flex-col gap-1.5">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-meta text-fg-secondary">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ background: BODY[r.look], color: INK[r.look] }}>
                    <ProductIcon family={r.family} label={family(r.family)} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-fg">{family(r.family)}</span>
                  <span className="tabular-nums">×{r.n}</span>
                  <span className="w-20 text-right text-fg-muted">{word(r.look)}</span>
                </li>
              ))}
            </ul>
            {selected && (
              <button type="button" onClick={() => navigate(`/gondolas/${selected}`)} className="mt-3 h-9 w-full cursor-pointer rounded-lg bg-surface text-ui text-fg transition-colors hover:bg-sunk">
                {gondola(selected)} →
              </button>
            )}
          </div>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-meta text-fg-secondary">
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-t-full" style={{ background: HEAP_COLOR.fine }} />
          {t.level.full}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-3.5 rounded-t-full" style={{ background: HEAP_COLOR.half }} />
          {t.level.half}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-full" style={{ background: C.danger }} />
          {t.level.empty}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-full" style={{ background: C.warning }} />
          {t.wrongProduct}
        </li>
        <li className="ml-auto text-fg-muted">Press a gondola to look closer, press it again to open it</li>
      </ul>
    </>
  )
}
