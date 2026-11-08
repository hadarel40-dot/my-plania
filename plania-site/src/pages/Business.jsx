import ProductPage from '@/components/ProductPage';
import { getProduct } from '@/lib/products';

export default function Business() {
  return <ProductPage product={getProduct('business')} />;
}