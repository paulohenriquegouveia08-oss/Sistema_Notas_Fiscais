'use client'

import './globals.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <title>SisFin - Sistema Financeiro</title>
      </head>
      <body className="antialiased">
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1A1D27',
                color: '#F1F5F9',
                border: '1px solid #2A2D3A',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#22C55E',
                  secondary: '#052E16',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#450A0A',
                },
              },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  )
}
