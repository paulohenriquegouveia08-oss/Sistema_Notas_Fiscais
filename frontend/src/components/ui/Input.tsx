'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  mono?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text-muted">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            'input-field',
            mono && 'font-mono',
            error && 'border-danger focus:ring-danger',
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
