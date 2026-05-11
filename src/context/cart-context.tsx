'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type CartLine = {
  productId: string
  /** null = producto sin variantes (solo stock del producto). */
  variantId: string | null
  variantLabel: string | null
  name: string
  unitPrice: number
  quantity: number
  maxStock: number
  /** Categoría de tienda (primer nivel) para agrupar el carrito. */
  categoryId: string
  categoryName: string
  categorySortOrder: number
}

function lineMatch(
  a: { productId: string; variantId: string | null },
  b: { productId: string; variantId: string | null },
) {
  return a.productId === b.productId && (a.variantId ?? null) === (b.variantId ?? null)
}

type CartContextValue = {
  lines: CartLine[]
  addLine: (p: {
    productId: string
    variantId: string | null
    variantLabel: string | null
    name: string
    unitPrice: number
    maxStock: number
    categoryId: string
    categoryName: string
    categorySortOrder: number
  }) => void
  removeLine: (productId: string, variantId: string | null) => void
  setQty: (productId: string, variantId: string | null, quantity: number) => void
  clear: () => void
  subtotal: number
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])

  const addLine = useCallback(
    (p: {
      productId: string
      variantId: string | null
      variantLabel: string | null
      name: string
      unitPrice: number
      maxStock: number
      categoryId: string
      categoryName: string
      categorySortOrder: number
    }) => {
      setLines((prev) => {
        const i = prev.findIndex((l) => lineMatch(l, p))
        if (i === -1) {
          const qty = Math.min(1, p.maxStock)
          if (qty < 1) return prev
          return [
            ...prev,
            {
              productId: p.productId,
              variantId: p.variantId,
              variantLabel: p.variantLabel,
              name: p.name,
              unitPrice: p.unitPrice,
              maxStock: p.maxStock,
              quantity: qty,
              categoryId: p.categoryId,
              categoryName: p.categoryName,
              categorySortOrder: p.categorySortOrder,
            },
          ]
        }
        const next = [...prev]
        const q = Math.min(next[i]!.quantity + 1, p.maxStock)
        next[i] = {
          ...next[i]!,
          quantity: q,
          categoryId: p.categoryId,
          categoryName: p.categoryName,
          categorySortOrder: p.categorySortOrder,
        }
        return next
      })
    },
    [],
  )

  const removeLine = useCallback((productId: string, variantId: string | null) => {
    setLines((prev) => prev.filter((l) => !lineMatch(l, { productId, variantId })))
  }, [])

  const setQty = useCallback((productId: string, variantId: string | null, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) =>
          lineMatch(l, { productId, variantId })
            ? { ...l, quantity: Math.max(0, Math.floor(quantity)) }
            : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0),
    [lines],
  )

  const value = useMemo(
    () => ({
      lines,
      addLine,
      removeLine,
      setQty,
      clear,
      subtotal,
    }),
    [lines, addLine, removeLine, setQty, clear, subtotal],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart dentro de CartProvider')
  return ctx
}
