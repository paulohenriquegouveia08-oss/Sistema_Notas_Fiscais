'use client'

import { clsx } from 'clsx'
import { ButtonHTMLAttributes, forwardRef } from 'react'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed',
  secondary:
    'bg-dark-surface border border-dark-border text-text-primary hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed',
  ghost:
    'text-text-muted hover:text-text-primary hover:bg-dark-surface disabled:opacity-50 disabled:cursor-not-allowed',
  danger:
    'bg-danger text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed',
}

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-medium transition-colors',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading && (
          <Spinner size={size === 'lg' ? 'md' : 'sm'} />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
