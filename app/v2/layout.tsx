import type { Viewport } from 'next';
import './mobile.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <div className="v2-mobile">{children}</div>;
}
