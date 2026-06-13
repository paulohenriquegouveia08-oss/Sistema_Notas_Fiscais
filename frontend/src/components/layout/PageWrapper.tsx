import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

interface PageWrapperProps {
  title: string
  children: ReactNode
}

export default function PageWrapper({ title, children }: PageWrapperProps) {
  return (
    <div className="min-h-screen bg-dark-bg">
      <Sidebar />
      <div className="ml-60 transition-all duration-300">
        <Header title={title} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
