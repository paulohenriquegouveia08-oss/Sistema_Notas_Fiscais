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
  CalendarClock,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
} from 'lucide-react'
import { clsx } from 'clsx'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  { href: '/customers', label: 'Clientes', icon: Users },
  { href: '/invoices', label: 'Notas Fiscais', icon: FileText },
  { href: '/pdf-storage', label: 'PDFs', icon: FileArchive },
  { href: '/pdf-date-editor', label: 'Data da DANFE', icon: CalendarClock },
  { href: '/receivables', label: 'Recebíveis', icon: DollarSign },
  { href: '/calendar', label: 'Agenda', icon: Calendar },
  { href: '/settings', label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  isMobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    if (saved) setCollapsed(saved === 'true')
  }, [])

  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebarCollapsed', String(next))
  }

  const sidebarContent = (
    <>
      <div className="flex items-center h-16 px-4 border-b border-dark-border">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onMobileClose}>
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
          onClick={onMobileClose}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors lg:hidden ml-auto"
        >
          <X className="h-5 w-5" />
        </button>
        <button
          onClick={toggle}
          className={clsx(
            'p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors hidden lg:block',
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

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
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

      <div className="p-4 border-t border-dark-border hidden lg:block">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          {!collapsed && (
            <span className="text-xs text-text-muted">Sistema online</span>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen bg-dark-surface border-r border-dark-border flex flex-col z-50 transition-all duration-300',
          'lg:z-40',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {sidebarContent}
      </aside>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
    </>
  )
}
