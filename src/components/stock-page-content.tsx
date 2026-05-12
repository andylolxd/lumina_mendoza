'use client'

import { StockAdjustPanel } from '@/components/stock-adjust-panel'
import { StockMozo } from '@/components/stock-mozo'
import { StockSalesHistory } from '@/components/stock-sales-history'
import { StockSalesStats } from '@/components/stock-sales-stats'
import type { CategoryRow } from '@/types/catalog'
import { useRef, useState } from 'react'

const collapseAllBtnClass =
  'shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-rose-600/50 hover:bg-zinc-700 hover:text-rose-100'

const tabBtnBase =
  'rounded-lg px-3 py-2 text-sm font-medium transition border border-transparent'
const tabActive = 'border-rose-500/60 bg-rose-950/50 text-rose-100'
const tabInactive = 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'

type TabId = 'venta' | 'stock' | 'historial' | 'stats'

export function StockPageContent({ categories }: { categories: CategoryRow[] }) {
  const [tab, setTab] = useState<TabId>('venta')
  const [collapseTick, setCollapseTick] = useState(0)
  const [expandTick, setExpandTick] = useState(0)
  const [showExpandAll, setShowExpandAll] = useState(false)
  const bulkLockRef = useRef(false)

  const runBulkLocked = (fn: () => void) => {
    bulkLockRef.current = true
    fn()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bulkLockRef.current = false
      })
    })
  }

  const handleCollapseAll = () => {
    runBulkLocked(() => {
      setCollapseTick((n) => n + 1)
      setShowExpandAll(true)
    })
  }

  const handleExpandAll = () => {
    runBulkLocked(() => {
      setExpandTick((n) => n + 1)
      setShowExpandAll(false)
    })
  }

  const handleUserOpenedPanel = () => {
    if (!bulkLockRef.current) setShowExpandAll(false)
  }

  const showTreeTools = tab === 'venta' || tab === 'stock'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-rose-100">Stock</h1>
          <p className="text-sm text-zinc-500">
            Venta en persona, ajuste de inventario, historial y estadísticas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showTreeTools ? (
            showExpandAll ? (
              <button type="button" className={collapseAllBtnClass} onClick={handleExpandAll}>
                Abrir todo
              </button>
            ) : (
              <button type="button" className={collapseAllBtnClass} onClick={handleCollapseAll}>
                Contraer todo
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        <button
          type="button"
          className={`${tabBtnBase} ${tab === 'venta' ? tabActive : tabInactive}`}
          onClick={() => setTab('venta')}
        >
          Venta en persona
        </button>
        <button
          type="button"
          className={`${tabBtnBase} ${tab === 'stock' ? tabActive : tabInactive}`}
          onClick={() => setTab('stock')}
        >
          Stock
        </button>
        <button
          type="button"
          className={`${tabBtnBase} ${tab === 'historial' ? tabActive : tabInactive}`}
          onClick={() => setTab('historial')}
        >
          Historial
        </button>
        <button
          type="button"
          className={`${tabBtnBase} ${tab === 'stats' ? tabActive : tabInactive}`}
          onClick={() => setTab('stats')}
        >
          Estadísticas
        </button>
      </div>

      {tab === 'venta' ? (
        <StockMozo
          categories={categories}
          collapseTick={collapseTick}
          expandTick={expandTick}
          bulkLockRef={bulkLockRef}
          onUserOpenedPanel={handleUserOpenedPanel}
        />
      ) : null}

      {tab === 'stock' ? (
        <StockAdjustPanel
          categories={categories}
          collapseTick={collapseTick}
          expandTick={expandTick}
          bulkLockRef={bulkLockRef}
          onUserOpenedPanel={handleUserOpenedPanel}
        />
      ) : null}

      {tab === 'historial' ? (
        <StockSalesHistory
          collapseTick={collapseTick}
          expandTick={expandTick}
          bulkLockRef={bulkLockRef}
          onUserOpenedPanel={handleUserOpenedPanel}
        />
      ) : null}

      {tab === 'stats' ? (
        <StockSalesStats
          collapseTick={collapseTick}
          expandTick={expandTick}
          bulkLockRef={bulkLockRef}
          onUserOpenedPanel={handleUserOpenedPanel}
        />
      ) : null}
    </div>
  )
}
