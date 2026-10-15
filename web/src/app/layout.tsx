import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'ASTRAYON · 두 개의 하늘',
  description: '격자 이동부터 SD 기체의 관절 액션과 파일럿 컷인까지 — 첫 교전 데모',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
