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

import ImageInput from '..'
import InputGroup from '../../Group'
import { StringInputProps } from '../../String'

export const ImageContainer = ({ children }) => {
  return <div className="flex h-auto w-[60%] flex-col items-end justify-start gap-2">{children}</div>
}

export default function ImagePreviewInput({
  value,
  onRelease,
  label,
  previewOnly,
  ...rest
}: StringInputProps & { label?: string; previewOnly?: boolean }) {
  return (
    <ImageContainer>
      {label && (
        <div className="self-stretch font-['Figtree'] text-[8px] font-normal leading-3 text-neutral-200">{label}</div>
      )}
      <div className="flex w-[70%] flex-col items-start justify-start gap-1 rounded bg-neutral-800 p-1 ">
        <div className="h-[274px] w-[305px]">
          <div className="flex h-[274px] w-[305px] justify-center rounded bg-zinc-900">
            <div className="h-auto w-auto rounded bg-neutral-900">
              <img src={value} crossOrigin="anonymous" className="h-full w-full rounded object-contain" />
            </div>
          </div>
        </div>
        {(previewOnly === undefined || previewOnly === false) && (
          <div className="inline-flex items-center justify-center gap-2.5 self-stretch rounded bg-neutral-900 px-2 py-1">
            <ImageInput value={value} onRelease={onRelease} />
          </div>
        )}
      </div>
    </ImageContainer>
  )
}

ImagePreviewInput.defaultProps = {
  value: 'https://fastly.picsum.photos/id/1065/200/300.jpg?hmac=WvioY_uR2xNPKNxQoR9y1HhWkuV6_v7rB23clZYh0Ks',
  onRelease: () => {}
}

export function ImagePreviewInputGroup({ name, label, value, onRelease, ...rest }) {
  return (
    <InputGroup name={name} label={label} {...rest}>
      <ImagePreviewInput value={value} onRelease={onRelease} />
    </InputGroup>
  )
}
