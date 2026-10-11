import { MemoryRouter, Navigate, Route, Routes } from 'react-router'
import { StoreProvider } from '@/lib/store'
import { GondolaPage } from '@/pages/GondolaPage'
import { RoundPage } from '@/pages/RoundPage'
import { TasksPage } from '@/pages/TasksPage'

/**
 * The app's own first page in a window so it reads as a demo, with the plan in 2D, 3D or as real
 * photos, the round list, the day bar, and the gondola and round pages behind it. It is the app's
 * code, not a copy, so it follows the app. A memory router keeps every link inside the window, so
 * nothing on it leads away from the page.
 *
 * It is loaded on its own, only when the visitor scrolls near it, together with the photos and the
 * data it reads, so the first screen does not pay for any of it. The phone code is hidden by
 * landing.css, because on the landing it would point at the landing and not at the round.
 */
export default function DemoWindow({ label }: { label: string }) {
  return (
    <StoreProvider limit={4}>
      <div className="demo-window rounded-2xl bg-surface p-1.5 sm:p-2">
        <div className="flex h-8 items-center gap-1.5 px-3 sm:h-9">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-sunk" />
          ))}
          <span className="ml-3 text-meta text-fg-muted">{label}</span>
        </div>
        <div className="rounded-xl bg-bg p-3 sm:p-6">
          <MemoryRouter>
            <Routes>
              <Route path="/" element={<TasksPage />} />
              {/* The round fills a phone screen and is fixed to it, so here it sits in a phone-sized frame; the transform makes the frame, and not the window, what it is fixed to. */}
              <Route
                path="/round"
                element={
                  <div className="mx-auto h-[40rem] w-full max-w-sm overflow-hidden rounded-3xl border border-line [transform:translateZ(0)]">
                    <RoundPage />
                  </div>
                }
              />
              <Route path="/gondolas/:camera" element={<GondolaPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MemoryRouter>
        </div>
      </div>
    </StoreProvider>
  )
}
