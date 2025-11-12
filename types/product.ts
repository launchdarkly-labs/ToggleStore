export interface Product {
  id: string
  name: string
  category: "Apparel" | "Stationery" | "Drinkware" | "Accessories"
  price: number
  description: string
  stock: number
  featured: boolean
  images: {
    main: string
    thumbnail: string
  }
  sizes: string[]
  details: {
    [key: string]: string | undefined
  }
  tags: string[]
}

export interface CartItem {
  product: Product
  quantity: number
  selectedSize?: string
}

export interface Cart {
  items: CartItem[]
  subtotal: number
  shipping: number
  total: number
}

