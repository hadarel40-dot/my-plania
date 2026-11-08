import ProductPage from '@/components/ProductPage';
import { getProduct } from '@/lib/products';

export default function Travel() {
  return <ProductPage product={getProduct('travel')} />;
}