'use client'

import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenuClick?: () => void
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b border-dark-border flex items-center justify-between px-4 lg:px-6 bg-dark-surface">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-dark-border transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg lg:text-xl font-bold text-text-primary">{title}</h1>
      </div>
    </header>
  )
}
