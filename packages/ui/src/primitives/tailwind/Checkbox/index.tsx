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

import React from 'react'
import { HiCheck } from 'react-icons/hi'

import { twMerge } from 'tailwind-merge'
import { v4 as uuidv4 } from 'uuid'

import Label from '../Label'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: boolean
  label?: React.ReactNode
  className?: string
  containerClassName?: string
  onChange: (value: boolean) => void
  disabled?: boolean
}

const Checkbox = ({ className, containerClassName, label, value, onChange, disabled }: CheckboxProps) => {
  const handleChange = () => {
    if (!disabled) {
      onChange(!value)
    }
  }

  const id = uuidv4()

  return (
    <div className={twMerge('relative flex cursor-pointer items-end', containerClassName)}>
      <input
        type="checkbox"
        checked={value}
        onChange={handleChange}
        id={id}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleChange()
          }
        }}
        className={twMerge(
          'peer relative appearance-none',
          'grid h-4 w-4 place-items-center rounded border border-theme-primary focus:border-2 focus:border-theme-focus focus:outline-none',
          value ? 'bg-blue-primary' : 'bg-theme-surfaceInput',
          disabled ? 'cursor-not-allowed opacity-50' : '',
          className
        )}
      />
      <HiCheck onClick={handleChange} className="absolute m-0.5 hidden h-3 w-3 text-white peer-checked:block" />

      {label && <Label className="ml-2 cursor-pointer self-stretch leading-[1.15]" htmlFor={id}>{label}</Label>}
    </div>
  )
}
export default Checkbox
