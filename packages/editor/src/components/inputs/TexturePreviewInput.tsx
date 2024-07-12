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

import { Stack } from '@mui/material'
import React, { Fragment, useEffect } from 'react'
import { ColorSpace, DisplayP3ColorSpace, LinearSRGBColorSpace, SRGBColorSpace, Texture, Vector2 } from 'three'

import { AssetType } from '@etherealengine/common/src/constants/AssetType'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import { ImageFileTypes, VideoFileTypes } from '@etherealengine/engine/src/assets/constants/fileTypes'
import { useHookstate } from '@etherealengine/hyperflux'
import Button from '@etherealengine/ui/src/primitives/mui/Button'

import { ItemTypes } from '../../constants/AssetTypes'
import FileBrowserInput from './FileBrowserInput'
import { ImageContainer } from './ImagePreviewInput'
import InputGroup from './InputGroup'
import SelectInput from './SelectInput'
import { StringInputProps } from './StringInput'
import Vector2Input from './Vector2Input'

/**
 * VideoInput used to render component view for video inputs.
 *
 * @param       {function} onChange
 * @param       {any} rest
 * @constructor
 */
export function TextureInput({ ...rest }: StringInputProps) {
  return (
    <FileBrowserInput
      acceptFileTypes={[...ImageFileTypes, ...VideoFileTypes]}
      acceptDropItems={[...ItemTypes.Images, ...ItemTypes.Videos]}
      {...rest}
    />
  )
}

export default function TexturePreviewInput({
  value,
  onRelease,
  ...rest
}: {
  value: string | Texture
  onRelease: (value: any) => void
  preview?: string
}) {
  const previewStyle = {
    maxWidth: '128px',
    maxHeight: '128px',
    width: 'auto',
    height: 'auto'
  }
  const { preview } = rest
  const validSrcValue =
    typeof value === 'string' && [AssetType.Image, AssetType.Video].includes(AssetLoader.getAssetClass(value))

  const srcState = useHookstate(value)
  const texture = srcState.value as Texture
  const src = srcState.value as string
  const showPreview = preview !== undefined || validSrcValue
  const previewSrc = validSrcValue ? value : preview
  const inputSrc = validSrcValue
    ? value
    : texture?.isTexture
    ? texture.source?.data?.src ?? texture?.userData?.src ?? (preview ? 'BLOB' : '')
    : src
  const offset = useHookstate(typeof texture?.offset?.clone === 'function' ? texture.offset.clone() : new Vector2(0, 0))
  const scale = useHookstate(typeof texture?.repeat?.clone === 'function' ? texture.repeat.clone() : new Vector2(1, 1))
  const colorspace = useHookstate(
    texture?.colorSpace ? texture?.colorSpace : (new String(LinearSRGBColorSpace) as ColorSpace)
  )

  useEffect(() => {
    if (texture?.isTexture && !texture.isRenderTargetTexture) {
      offset.set(texture.offset)
      scale.set(texture.repeat)
      colorspace.set(texture.colorSpace)
    }
  }, [srcState])

  console.log('DEBUG texture colorspace is ', inputSrc, texture)
  return (
    <ImageContainer>
      <Stack>
        <TextureInput value={inputSrc} onRelease={onRelease} />
        {showPreview && (
          <Fragment>
            {(typeof preview === 'string' ||
              (typeof value === 'string' && AssetLoader.getAssetClass(value) === AssetType.Image)) && (
              <img src={previewSrc} style={previewStyle} alt="" crossOrigin="anonymous" />
            )}
            {typeof value === 'string' && AssetLoader.getAssetClass(value) === AssetType.Video && (
              <video src={previewSrc} style={previewStyle} />
            )}
          </Fragment>
        )}
        {texture?.isTexture && !texture.isRenderTargetTexture && (
          <>
            <Vector2Input
              value={offset.value}
              onChange={(_offset) => {
                offset.set(_offset)
                texture.offset.copy(_offset)
              }}
              uniformScaling={false}
            />
            <Vector2Input
              value={scale.value}
              onChange={(_scale) => {
                scale.set(_scale)
                texture.repeat.copy(_scale)
              }}
              uniformScaling={false}
            />
          </>
        )}
        {texture?.isTexture && (
          <>
            <InputGroup name="Encoding" label="Encoding">
              <SelectInput
                value={colorspace.value}
                options={[
                  { label: 'Linear', value: LinearSRGBColorSpace },
                  { label: 'sRGB', value: SRGBColorSpace },
                  { label: 'displayP3', value: DisplayP3ColorSpace }
                ]}
                onChange={(value: ColorSpace) => {
                  colorspace.set(value)
                  texture.colorSpace = value
                  texture.needsUpdate = true
                  console.log('DEBUG changed space', texture.colorSpace)
                }}
              />
            </InputGroup>
          </>
        )}
        {value && (
          <>
            <div>
              <Button
                onClick={() => {
                  onRelease('')
                }}
              >
                Clear
              </Button>
            </div>
          </>
        )}
      </Stack>
    </ImageContainer>
  )
}

export function TexturePreviewInputGroup({ name, label, value, onRelease, ...rest }) {
  return (
    <InputGroup name={name} label={label} {...rest}>
      <TexturePreviewInput value={value} onRelease={onRelease} />
    </InputGroup>
  )
}
