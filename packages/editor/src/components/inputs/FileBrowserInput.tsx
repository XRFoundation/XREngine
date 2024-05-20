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

import IconButton from '@mui/material/IconButton'
import React from 'react'
import { useDrop } from 'react-dnd'

import config from '@etherealengine/common/src/config'
import Icon from '@etherealengine/ui/src/primitives/mui/Icon'

import { ItemTypes } from '../../constants/AssetTypes'
import useUpload from '../assets/useUpload'
import { ControlledStringInput, StringInputProps } from './StringInput'

export type FileBrowserInputProps = StringInputProps & { acceptFileTypes: string[]; acceptDropItems: string[] }

/**
 * Function component used for rendering FileBrowserInput.
 *
 * @param {function} onChange
 * @param {string} acceptFileTypes
 * @param {object} acceptDropItems
 * @param {any} rest
 * @returns
 */
export function FileBrowserInput({
  onRelease,
  value,
  acceptFileTypes,
  acceptDropItems,
  ...rest
}: FileBrowserInputProps) {
  const uploadOptions = {
    multiple: false,
    accepts: acceptFileTypes
  }
  const onUpload = useUpload(uploadOptions)

  // todo fix for invalid URLs
  const assetIsExternal = value && !value?.includes(config.client.fileServer) && !value.includes('blob:https://')
  const uploadExternalAsset = () => {
    onUpload([
      {
        isFile: true,
        name: value?.split('/').pop(),
        file: async (onSuccess, onFail) => {
          try {
            const asset = await fetch(value!)
            const blob = await asset.blob()
            const file = new File([blob], value!.split('/').pop()!)
            onSuccess(file)
          } catch (error) {
            if (onFail) onFail(error)
            else throw error
          }
        }
      } as Partial<FileSystemFileEntry>
    ] as any).then((assets) => {
      if (assets) {
        onRelease?.(assets[0])
      }
    })
  }

  const [{ canDrop, isOver }, dropRef] = useDrop({
    accept: [...acceptDropItems, ItemTypes.File],
    async drop(item: any, monitor) {
      const isDropType = acceptDropItems.find((element) => element === item.type)
      if (isDropType) {
        // Below url fix is applied when item is folder
        let url = item.url
        if (!url.endsWith(item.fullName)) {
          url += item.fullName
        }

        onRelease?.(url)
      } else {
        // https://github.com/react-dnd/react-dnd/issues/1345#issuecomment-538728576
        const dndItem: any = monitor.getItem()
        const entries = Array.from(dndItem.items).map((item: any) => item.webkitGetAsEntry())

        onUpload(entries).then((assets) => {
          if (assets) {
            onRelease?.(assets[0])
          }
        })
      }
    },
    collect: (monitor) => ({
      canDrop: monitor.canDrop(),
      isOver: monitor.isOver()
    })
  })

  return (
    <>
      <ControlledStringInput
        ref={dropRef}
        value={value}
        onRelease={onRelease}
        error={isOver && !canDrop}
        canDrop={isOver && canDrop}
        {...rest}
      />
      {assetIsExternal && (
        <IconButton
          disableRipple
          style={{
            padding: 0
          }}
          onClick={uploadExternalAsset}
        >
          <Icon type="Download" style={{ color: 'var(--textColor)' }} />
        </IconButton>
      )}
    </>
  )
}

export default FileBrowserInput
