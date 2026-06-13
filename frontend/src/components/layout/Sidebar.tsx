'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  FileArchive,
  DollarSign,
  Calendar,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/invoices', label: 'Notas Fiscais', icon: FileText },
  { href: '/pdf-storage', label: 'PDFs', icon: FileArchive },
  { href: '/receivables', label: 'Recebíveis', icon: DollarSign },
  { href: '/calendar', label: 'Agenda', icon: Calendar },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved) setCollapsed(saved === 'true')
  }, [])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebarCollapsed', String(next))
  }

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen bg-dark-surface border-r border-dark-border flex flex-col z-40 transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-dark-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          {!collapsed && (
            <div>
              <span className="text-lg font-bold text-text-primary">SisFin</span>
              <span className="block text-[10px] text-text-muted leading-tight">v1.1.0</span>
            </div>
          )}
        </Link>
        <button
          onClick={toggle}
          className={clsx(
            'p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors',
            collapsed ? 'mx-auto mt-2' : 'ml-auto'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative',
                isActive
                  ? 'bg-primary/15 text-primary border-l-2 border-primary ml-0 pl-[10px]'
                  : 'text-text-muted hover:text-text-primary hover:bg-dark-border'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-dark-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          {!collapsed && (
            <span className="text-xs text-text-muted">Sistema online</span>
          )}
        </div>
      </div>
    </aside>
  )
}
