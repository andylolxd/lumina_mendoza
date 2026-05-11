import { CartProvider } from '@/context/cart-context'

export default function TiendaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CartProvider>{children}</CartProvider>
}
