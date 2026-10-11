import { OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import * as THREE from 'three'
import { ProductIcon } from '@/components/ProductIcon'
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
const COLS = 4
const ROWS = 4
const FLOOR_W = COLS * W + (COLS - 1) * GAP_X + MARGIN * 2
const FLOOR_D = ROWS * D + (ROWS - 1) * GAP_Z + MARGIN * 2 + 1.8

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

/** The icon of a product with its warning badge, drawn once as a texture and reused. */
const textures = new Map<string, THREE.Texture>()
function iconTexture(family: string, look: Look, onLoad: () => void): THREE.Texture {
  const key = `${family}:${look}`
  const hit = textures.get(key)
  if (hit) return hit
  const body = ICON_BODY[FAMILY_ICON[family]] ?? ''
  const ink = INK[look]
  const badge =
    look === 'half' || look === 'fine'
      ? ''
      : look === 'wrong'
      ? `<circle cx="26" cy="6" r="5.5" fill="${C.warning}"/><path d="M23.5 6h5M23.5 6l2-2M23.5 6l2 2" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<circle cx="26" cy="6" r="5.5" fill="${C.danger}"/><rect x="25.2" y="2.6" width="1.6" height="4.2" rx=".8" fill="#fff"/><circle cx="26" cy="8.9" r="1" fill="#fff"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="256" height="256"><g color="${ink}" fill="${ink}" transform="translate(1.6 2.4) scale(.95)">${body}</g>${badge}</svg>`
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
  textures.set(key, texture)
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

/** One crate on a step: a tray with a heap of produce in it, or hollow when empty, with the product's icon above. */
function Crate({ x, y, z, w, d, look, family }: { x: number; y: number; z: number; w: number; d: number; look: Look; family: string }) {
  const invalidate = useThree((s) => s.invalidate)
  const map = useMemo(() => iconTexture(family, look, invalidate), [family, look, invalidate])
  const h = 0.14
  const heap = HEAP[look]
  const icon = Math.min(w, d) * 0.8
  return (
    <group position={[x, y, z]}>
      <RoundedBox args={[w, h, d]} radius={0.05} smoothness={3} position={[0, h / 2, 0]}>
        <meshStandardMaterial color={BODY[look]} roughness={1} />
      </RoundedBox>
      {heap > 0 ? (
        <mesh position={[0, h, 0]} scale={[w * 0.4, heap, d * 0.4]}>
          <sphereGeometry args={[1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={HEAP_COLOR[look]} roughness={1} />
        </mesh>
      ) : (
        <mesh rotation-x={-Math.PI / 2} position={[0, h + 0.003, 0]}>
          <planeGeometry args={[w * 0.74, d * 0.74]} />
          <meshBasicMaterial color={tint(C.danger, look === 'critical' ? 30 : 16, '#bdb6a8')} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position={[0, h + heap + 0.01, 0]} renderOrder={5}>
        <planeGeometry args={[icon, icon]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} />
      </mesh>
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
  const board = topY(0) + 0.95

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
        <mesh position={[0, board - 0.42, -D / 2 + 0.004]}>
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
            />
          )),
        )}
      </group>
    </group>
  )
}

/** The floor with low walls on three sides and an opening in the front wall. */
function Room() {
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
type View = keyof typeof VIEWS

/** Fits the floor in the frame whatever the width, and starts from the chosen side. */
function Rig({ view }: { view: View }) {
  const size = useThree((s) => s.size)
  const zoom = Math.min(size.width / 22, size.height / 19.5)
  return <OrthographicCamera makeDefault position={[...VIEWS[view]]} zoom={zoom} near={0.1} far={200} />
}

function Scene({ view, onOpen, onHoverChange }: { view: View; onOpen: (camera: string) => void; onHoverChange: (camera: string | null) => void }) {
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
      <ambientLight intensity={2.2} />
      <directionalLight position={[8, 16, 10]} intensity={1.5} />
      <Room />
      {list.map((c, n) => {
        const col = n % COLS
        const row = Math.floor(n / COLS)
        const x = -FLOOR_W / 2 + MARGIN + W / 2 + col * (W + GAP_X)
        const z = -FLOOR_D / 2 + MARGIN + D / 2 + 0.2 + row * (D + GAP_Z)
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
export function Map3DPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [key, setKey] = useState(0)
  const [view, setView] = useState<View>('front')
  const [hover, setHover] = useState<string | null>(null)
  const { tasks, gondola } = useStore()
  const { family } = useI18n()
  // What is wrong in the gondola pointed at, shown in a corner of the frame so it never covers the scene.
  const summary = useMemo(() => {
    const m = new Map<string, { key: string; family: string; look: Look; n: number }>()
    for (const x of tasks.filter((y) => y.area.camera === hover && loud(lookOf(y)))) {
      const look = lookOf(x) === 'wrong' ? 'wrong' : 'empty'
      const k = `${look}:${x.area.family}`
      const row = m.get(k) ?? { key: k, family: x.area.family, look: look as Look, n: 0 }
      row.n += 1
      m.set(k, row)
    }
    return [...m.values()].sort((a, b) => b.n - a.n)
  }, [tasks, hover])
  const webgl = useMemo(() => {
    try {
      const c = document.createElement('canvas')
      return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
    } catch {
      return false
    }
  }, [])
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-4">
        <h1 className="text-title">{t.plan.title} · 3D</h1>
        <span className="flex items-center gap-1">
          {(['front', 'corner'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              data-on={view === v}
              onClick={() => {
                setView(v)
                setKey(key + 1)
              }}
              className="h-9 cursor-pointer rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg"
            >
              {v === 'front' ? 'Front' : 'Corner'}
            </button>
          ))}
        <button type="button" onClick={() => setKey(key + 1)} className="h-9 cursor-pointer rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface">
          Reset view
        </button>
        </span>
      </div>
      <div className="relative h-[min(82dvh,52rem)] min-h-[26rem] overflow-hidden rounded-2xl" style={{ background: C.bg }}>
        {webgl ? (
          <Canvas key={key} flat dpr={[1, 2]} frameloop="demand" gl={{ antialias: true }}>
            <Scene view={view} onOpen={(c) => navigate(`/gondolas/${c}`)} onHoverChange={setHover} />
          </Canvas>
        ) : (
          <p className="grid size-full place-items-center text-ui text-fg-secondary">This browser cannot draw 3D.</p>
        )}
        {hover && (
          <div className="pointer-events-none absolute top-3 left-3 w-60 rounded-xl bg-raised p-3">
            <p className="mb-2 text-label">{gondola(hover)}</p>
            {summary.length === 0 ? (
              <p className="text-meta text-fg-secondary">{t.plan.nothingHere}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {summary.map((r) => (
                  <li key={r.key} className="flex items-center gap-2 text-meta text-fg-secondary">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md" style={{ background: BODY[r.look], color: INK[r.look] }}>
                      <ProductIcon family={r.family} label={family(r.family)} className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-fg">{family(r.family)}</span>
                    <span className="tabular-nums">×{r.n}</span>
                    <span className="text-fg-muted">{r.look === 'wrong' ? t.wrongProduct : t.level.empty}</span>
                  </li>
                ))}
              </ul>
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
          <span className="size-3.5 rounded-[4px]" style={{ background: BODY.empty, boxShadow: 'inset 0 0 0 3px ' + BODY.empty, outline: '3px solid ' + tint(C.danger, 16, '#bdb6a8'), outlineOffset: -3 }} />
          {t.level.empty}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-t-full" style={{ background: HEAP_COLOR.wrong }} />
          {t.wrongProduct}
        </li>
        <li className="ml-auto text-fg-muted">Drag to turn it, scroll to zoom, press a gondola to open it</li>
      </ul>
    </>
  )
}
