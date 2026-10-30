import { OG_SIZE, ogImage } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Tamreen: Excel practice';

export default function Image() {
  return ogImage('=SUM(B2:B6)', 'Excel practice in your browser');
}
