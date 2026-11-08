import ProductPage from '@/components/ProductPage';
import { getProduct } from '@/lib/products';

export default function Plania() {
  return <ProductPage product={getProduct('plania')} />;
}