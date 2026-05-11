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
  /** Ruta en storage de la foto principal (misma que catálogo), para el panel del carrito. */
  imagePath: string | null
  /** Categoría de tienda (primer nivel) para agrupar el carrito. */
  categoryId: string
  categoryName: string
  categorySortOrder: number
}

/** Tope práctico por línea (el stock real se valida al aceptar el pedido en admin). */
const MAX_CART_LINE_QTY = 999

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
    imagePath: string | null
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
      imagePath: string | null
      categoryId: string
      categoryName: string
      categorySortOrder: number
    }) => {
      setLines((prev) => {
        const i = prev.findIndex((l) => lineMatch(l, p))
        if (i === -1) {
          return [
            ...prev,
            {
              productId: p.productId,
              variantId: p.variantId,
              variantLabel: p.variantLabel,
              name: p.name,
              unitPrice: p.unitPrice,
              maxStock: p.maxStock,
              imagePath: p.imagePath,
              quantity: 1,
              categoryId: p.categoryId,
              categoryName: p.categoryName,
              categorySortOrder: p.categorySortOrder,
            },
          ]
        }
        const next = [...prev]
        const q = Math.min(next[i]!.quantity + 1, MAX_CART_LINE_QTY)
        next[i] = {
          ...next[i]!,
          quantity: q,
          maxStock: p.maxStock,
          imagePath: p.imagePath ?? next[i]!.imagePath,
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
            ? { ...l, quantity: Math.min(MAX_CART_LINE_QTY, Math.max(0, Math.floor(quantity))) }
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
