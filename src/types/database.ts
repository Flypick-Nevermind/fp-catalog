export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface ProductAttribute {
  key: string;
  value: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  order_index: number;
  created_at?: string;
}

export type ProductStatus = "published" | "draft";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  category_id: string | null;
  attributes: ProductAttribute[];
  status: ProductStatus;
  created_at: string;
  categories?: Category | null;
  product_images?: ProductImage[];
}

