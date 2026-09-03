'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, UtensilsCrossed, Image as ImageIcon, FileText, Layers,
  MessageSquare, Users, ScrollText, Settings, LogOut, Menu as MenuIcon,
  Sun, Moon, ExternalLink, ChevronLeft,
} from 'lucide-react';
import { api } from '@/lib/client';
import { cn } from '@/lib/utils';
import { useLang, type Key } from '@/lib/i18n';
import type { Permission } from '@/lib/rbac';

type NavItem = { href: string; icon: typeof LayoutDashboard; key: Key; permission: Permission };

const NAV: NavItem[] = [
  { href: '/', icon: LayoutDashboard, key: 'dashboard', permission: 'menu:read' },
  { href: '/menu', icon: UtensilsCrossed, key: 'menu', permission: 'menu:read' },
  { href: '/hero', icon: ImageIcon, key: 'hero', permission: 'content:read' },
  { href: '/media', icon: Layers, key: 'media', permission: 'media:read' },
  { href: '/content', icon: FileText, key: 'content', permission: 'content:read' },
  { href: '/messages', icon: MessageSquare, key: 'messages', permission: 'messages:read' },
  { href: '/users', icon: Users, key: 'users', permission: 'users:read' },
  { href: '/audit', icon: ScrollText, key: 'audit', permission: 'audit:read' },
  { href: '/settings', icon: Settings, key: 'settings', permission: 'settings:read' },
];

export function Shell({
  user, permissions, children,
}: {
  user: { id: string; name: string; email: string; role: string };
  permissions: Permission[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('baytna-theme');
      if (saved === 'dark' || saved === 'light') setTheme(saved);
      setCollapsed(localStorage.getItem('baytna-collapsed') === '1');
    } catch { /* private mode */ }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('baytna-theme', next); } catch { /* ignore */ }
  }

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('baytna-collapsed', next ? '1' : '0'); } catch { /* ignore */ }
  }

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.push('/login');
  }

  // Navigation is filtered by the same permission table that guards the API,
  // so a Viewer never sees a link that would 403.
  const visible = NAV.filter((n) => permissions.includes(n.permission));

  return (
    <div className="flex min-h-screen bg-surface2">
      {/* ---------------------------------------------------------- sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 start-0 z-40 flex flex-col border-e border-line bg-surface transition-[width,transform] duration-300',
          collapsed ? 'w-[68px]' : 'w-60',
          mobileOpen ? 'translate-x-0' : 'max-lg:-translate-x-full rtl:max-lg:translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-flame/15 text-lg">🍔</span>
          {!collapsed && (
            <span className="font-display text-sm uppercase tracking-wide text-ink">Baytna</span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {visible.map((item) => {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? t(item.key) : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  active ? 'bg-flame/12 font-medium text-flame' : 'text-muted hover:bg-surface2 hover:text-ink',
                )}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{t(item.key)}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-2">
          <button
            onClick={toggleCollapsed}
            className="hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 lg:flex"
          >
            <ChevronLeft size={17} className={cn('shrink-0 transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      {/* ------------------------------------------------------------ main */}
      <div className={cn('flex min-w-0 flex-1 flex-col transition-[padding] duration-300', collapsed ? 'lg:ps-[68px]' : 'lg:ps-60')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <MenuIcon size={20} className="text-ink" />
          </button>

          <div className="ms-auto flex items-center gap-1.5">
            <a
              href={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}
              target="_blank" rel="noopener noreferrer"
              title={t('livePreview')}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-muted hover:text-ink"
            >
              <ExternalLink size={14} /> <span className="max-sm:hidden">{t('livePreview')}</span>
            </a>

            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="h-9 rounded-lg border border-line px-3 text-xs font-semibold text-muted hover:text-ink"
              aria-label={t('language')}
            >
              {lang === 'en' ? 'ع' : 'EN'}
            </button>

            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:text-ink"
              aria-label={t('theme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="ms-1 flex items-center gap-2 border-s border-line ps-3">
              <div className="text-end max-sm:hidden">
                <p className="text-xs font-medium leading-tight text-ink">{user.name}</p>
                <p className="text-[10px] leading-tight text-muted">{user.role.replace('_', ' ')}</p>
              </div>
              <button
                onClick={signOut}
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted hover:border-jo-red/40 hover:text-jo-red"
                aria-label={t('signOut')}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 p-4 sm:p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
