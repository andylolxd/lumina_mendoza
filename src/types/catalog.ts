export type ProductVariantRow = {
  id: string
  product_id: string
  size_label: string
  stock_quantity: number
  /** Si está false, la variante no aparece en tienda aunque tenga stock. */
  active: boolean
  sort_order: number
}

export type ProductRow = {

  id: string

  subcategory_id: string

  /** Si no es null, el producto está bajo una subsubcategoría (tercer nivel). */

  subsubcategoria_id?: string | null

  name: string

  description: string | null

  price: number

  stock_quantity: number

  image_path: string | null

  /** Rutas extra en storage (mismo bucket que `image_path`); la principal sigue siendo `image_path`. */

  image_gallery: string[]

  /** Si hay filas, en tienda se elige talle y el stock viene de cada variante. */

  variants: ProductVariantRow[]

  active: boolean

  sort_order: number

}



export type SubsubcategoriaRow = {

  id: string

  subcategory_id?: string

  name: string

  sort_order: number

  products: ProductRow[]

}



export type SubcategoryRow = {

  id: string

  category_id?: string

  name: string

  sort_order: number

  /** Productos directamente bajo esta subcategoría (sin subsubcategoría). */

  products: ProductRow[]

  subsubcategorias: SubsubcategoriaRow[]

}



export type CategoryRow = {

  id: string

  name: string

  sort_order: number

  subcategories: SubcategoryRow[] | null

}

