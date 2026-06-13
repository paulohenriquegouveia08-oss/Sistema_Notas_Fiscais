'use client'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="h-16 border-b border-dark-border flex items-center justify-between px-6 bg-dark-surface">
      <h1 className="text-xl font-bold text-text-primary">{title}</h1>
    </header>
  )
}
