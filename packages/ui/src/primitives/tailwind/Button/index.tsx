/*
CPAL-1.0 License

The contents of this file are subject to the Common Public Attribution License
Version 1.0. (the "License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at
https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
The License is based on the Mozilla Public License Version 1.1, but Sections 14
and 15 have been added to cover use of software over a computer network and
provide for limited attribution for the Original Developer. In addition,
Exhibit A has been modified to be consistent with Exhibit B.

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
specific language governing rights and limitations under the License.

The Original Code is Ethereal Engine.

The Original Developer is the Initial Developer. The Initial Developer of the
Original Code is the Ethereal Engine team.

All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023
Ethereal Engine. All Rights Reserved.
*/

import React, { ReactNode } from 'react'

import { twMerge } from 'tailwind-merge'

export interface ButtonProps extends React.HTMLAttributes<HTMLButtonElement> {
  startIcon?: ReactNode
  endIcon?: ReactNode
  children?: ReactNode
  size?: 'small' | 'medium' | 'large'
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'transparent'
  disabled?: boolean
  fullWidth?: boolean
  rounded?: 'partial' | 'full' | 'none'
  className?: string
  iconContainerClassName?: string
  textContainerClassName?: string
}

const roundedTypes = {
  partial: 'rounded-md',
  full: 'rounded-full',
  none: 'rounded-none'
}

const sizes = {
  small: 'text-sm px-3 py-2',
  medium: 'text-base px-4 py-2',
  large: 'text-lg px-7 py-3'
}

const variants = {
  primary: 'bg-blue-primary',
  secondary: 'bg-theme-blue-secondary',
  outline: 'border border-solid border-theme-primary bg-theme-surface-main dark:bg-theme-highlight text-theme-primary',
  danger: 'bg-red-500',
  success: 'bg-teal-700',
  transparent: 'bg-transparent dark:bg-transparent'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      startIcon: StartIcon,
      children,
      endIcon: EndIcon,
      size = 'medium',
      fullWidth,
      rounded = 'partial',
      variant = 'primary',
      disabled = false,
      className,
      iconContainerClassName,
      textContainerClassName,
      ...props
    },
    ref
  ) => {
    const twClassName = twMerge(
      'flex items-center justify-center',
      'font-medium text-white',
      'transition ease-in-out',
      'disabled:cursor-not-allowed',
      (StartIcon || EndIcon) && 'justify-center',
      sizes[size],
      fullWidth ? 'w-full' : 'w-fit',
      roundedTypes[rounded],
      disabled ? 'bg-[#F3F4F6] text-[#9CA3AF] dark:bg-[#5F7DBF] dark:text-[#FFFFFF]' : '',
      variants[variant],
      className
    )

    return (
      <button ref={ref} role="button" disabled={disabled} className={twClassName} {...props}>
        {StartIcon && <span className={twMerge('mx-1', iconContainerClassName)}>{StartIcon}</span>}
        {children && (
          <span className={twMerge('mx-1', fullWidth ? 'mx-1 w-full' : '', textContainerClassName)}>{children}</span>
        )}
        {EndIcon && <span className={twMerge('mx-1', iconContainerClassName)}>{EndIcon}</span>}
      </button>
    )
  }
)

export default Button
