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

// World units. A gondola is a squarish block W by D and H tall, with a grid of crates on its top.
const W = 3.4
const D = 2.9
const H = 0.9
const CRATE = 0.52
const PITCH = 0.6
const PER_ROW = 5
const GAP_X = 0.9
const GAP_Z = 1.3
const MARGIN = 1.1
const COLS = 5
const ROWS = 3
const FLOOR_W = COLS * W + (COLS - 1) * GAP_X + MARGIN * 2
const FLOOR_D = ROWS * D + (ROWS - 1) * GAP_Z + MARGIN * 2 + 1.6

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

const shelfOrder = (tasks: Task[]): Task[] => {
  const cy = (x: Task) => x.area.quad.reduce((sum, p) => sum + p[1], 0) / 4
  const cx = (x: Task) => x.area.quad.reduce((sum, p) => sum + p[0], 0) / 4
  return [...tasks].sort((a, b) => Math.round(cy(a) / 90) - Math.round(cy(b) / 90) || cx(a) - cx(b))
}

/** One crate on the top of a gondola: a low tinted box with the product's icon on its lid. What needs doing stands taller. */
function Crate({ x, z, look, family }: { x: number; z: number; look: Look; family: string }) {
  const invalidate = useThree((s) => s.invalidate)
  const map = useMemo(() => iconTexture(family, look, invalidate), [family, look, invalidate])
  const h = loud(look) ? 0.26 : 0.1
  return (
    <group position={[x, H, z]}>
      <RoundedBox args={[CRATE, h, CRATE]} radius={0.05} smoothness={3} position={[0, h / 2, 0]}>
        <meshStandardMaterial color={BODY[look]} roughness={1} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[0, h + 0.004, 0]} renderOrder={5}>
        <planeGeometry args={[CRATE * 0.96, CRATE * 0.96]} />
        <meshBasicMaterial map={map} transparent toneMapped={false} />
      </mesh>
    </group>
  )
}

/** One gondola: a squarish block with its name on the front and a crate for each area on top. It lifts when pointed at. */
function Gondola({ position, tasks, rank, name, hovered, onHover, onOpen }: GondolaProps) {
  const group = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const ordered = useMemo(() => shelfOrder(tasks), [tasks])
  const fine = !ordered.some((x) => loud(lookOf(x)))
  const label = useLabel(name, rank, fine)

  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    const target = hovered ? 0.2 : 0
    const next = g.position.y + (target - g.position.y) * Math.min(1, dt * 14)
    g.position.y = Math.abs(target - next) < 0.002 ? target : next
    if (g.position.y !== target) invalidate()
  })

  const frame = fine ? tint(C.success, 22, C.box) : hovered ? C.raised : '#fdfcfa'
  const rows = Math.ceil(ordered.length / PER_ROW)
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
        <RoundedBox args={[W, H, D]} radius={0.14} smoothness={4} position={[0, H / 2, 0]}>
          <meshStandardMaterial color={frame} roughness={1} />
        </RoundedBox>
        <mesh position={[0, H * 0.52, D / 2 + 0.004]}>
          <planeGeometry args={[W - 0.4, (W - 0.4) / 4.2]} />
          <meshBasicMaterial map={label} transparent toneMapped={false} depthWrite={false} />
        </mesh>
        {ordered.map((x, i) => {
          const col = i % PER_ROW
          const row = Math.floor(i / PER_ROW)
          const inRow = Math.min(PER_ROW, ordered.length - row * PER_ROW)
          const px = -((inRow - 1) * PITCH) / 2 + col * PITCH
          const pz = -((rows - 1) * PITCH) / 2 + row * PITCH - 0.05
          return <Crate key={x.area.area_id} x={px} z={pz} look={lookOf(x)} family={x.area.family} />
        })}
      </group>
    </group>
  )
}

/** The floor with low walls on three sides and an opening in the front wall. */
function Room() {
  const wallH = 0.7
  const t = 0.45
  const doorW = 3.6
  const doorX = -FLOOR_W / 2 + 7
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

/** Fits the floor in the frame whatever the width, and starts looking from a corner. */
function Rig() {
  const size = useThree((s) => s.size)
  const zoom = Math.min(size.width / 24.5, size.height / 17.5)
  return <OrthographicCamera makeDefault position={[17, 15, 17]} zoom={zoom} near={0.1} far={200} />
}

function Scene({ onOpen, onHoverChange }: { onOpen: (camera: string) => void; onHoverChange: (camera: string | null) => void }) {
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
      <Rig />
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
        minAzimuthAngle={-0.5}
        maxAzimuthAngle={1.55}
        minZoom={12}
        maxZoom={80}
        target={[0, 0, 0.6]}
      />
    </>
  )
}

/** The store as a 3D diorama. Not in the menu: /lab/map-3d. */
export function Map3DPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [key, setKey] = useState(0)
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
        <button type="button" onClick={() => setKey(key + 1)} className="h-9 cursor-pointer rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface">
          Reset view
        </button>
      </div>
      <div className="relative h-[min(84dvh,54rem)] min-h-[26rem] overflow-hidden rounded-2xl" style={{ background: C.bg }}>
        {webgl ? (
          <Canvas key={key} flat dpr={[1, 2]} frameloop="demand" gl={{ antialias: true }}>
            <Scene onOpen={(c) => navigate(`/gondolas/${c}`)} onHoverChange={setHover} />
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
      <p className="mt-2 px-1 text-meta text-fg-muted">Drag to turn it a little, scroll to zoom. Press a gondola to open it.</p>
    </>
  )
}
