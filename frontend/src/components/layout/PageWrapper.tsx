'use client'

import { useState } from 'react'
import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface PageWrapperProps {
  title: string
  children: ReactNode
}

export default function PageWrapper({ title, children }: PageWrapperProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar
        isMobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <div className="lg:ml-60 transition-all duration-300 min-h-screen flex flex-col">
        <Header
          title={title}
          onMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
