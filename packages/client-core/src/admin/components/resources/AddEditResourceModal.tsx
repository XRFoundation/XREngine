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

import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { staticResourcePath, StaticResourceType, uploadAssetPath } from '@etherealengine/common/src/schema.type.module'
import { cleanURL } from '@etherealengine/common/src/utils/cleanURL'
import { AssetsPreviewPanel } from '@etherealengine/editor/src/components/assets/AssetsPreviewPanel'
import {
  AssetTypeToMimeType,
  ExtensionToAssetType,
  MimeTypeToAssetType
} from '@etherealengine/engine/src/assets/constants/fileTypes'
import { useHookstate } from '@etherealengine/hyperflux'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import Modal from '@etherealengine/ui/src/primitives/tailwind/Modal'
import Radio from '@etherealengine/ui/src/primitives/tailwind/Radio'

import { useMutation } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import { NotificationService } from '../../../common/services/NotificationService'
import { uploadToFeathersService } from '../../../util/upload'

const getNameAndType = async (url: string) => {
  const urlParts = url.split('/')
  const fileName = urlParts[urlParts.length - 1]

  const response = await fetch(url)
  const blob = await response.blob()
  if (!blob.type) {
    const extension = fileName.split('.').pop()
    const assetType = ExtensionToAssetType[extension!]
    const mimeType = AssetTypeToMimeType[assetType]
    return {
      mimeType: mimeType,
      assetType: assetType
    }
  }

  return {
    name: fileName,
    mimeType: blob.type,
    assetType: MimeTypeToAssetType[blob.type]
  }
}

const getDefaultErrors = () => ({
  serverError: '',
  name: '',
  resourceFile: '',
  resourceURL: ''
})

export default function CreateResourceModal({ selectedResource }: { selectedResource?: StaticResourceType }) {
  const { t } = useTranslation()

  const modalProcessing = useHookstate(false)
  const errors = useHookstate(getDefaultErrors())
  const staticResourcesMutation = useMutation(staticResourcePath)

  const state = useHookstate({
    id: selectedResource?.id ? selectedResource.id : '',
    name: selectedResource?.name ? selectedResource.name : '',
    mimeType: selectedResource?.mimeType ? selectedResource.mimeType : '',
    project: selectedResource?.project ? selectedResource.project : '',
    source: 'url' as 'url' | 'file',
    resourceFile: undefined as File | undefined,
    resourceURL: selectedResource?.url ? selectedResource.url : ''
  })

  const previewPanelRef = React.useRef()

  useEffect(() => {
    if (state.source.value === 'file' && state.resourceFile.value) {
      state.name.set(state.resourceFile.value.name)
      if (state.resourceFile.value.type) {
        state.mimeType.set(state.resourceFile.value.type)
      } else {
        const extension = state.resourceFile.value.name.split('.').pop()!
        const assetType = ExtensionToAssetType[extension]
        const mimeType = AssetTypeToMimeType[assetType]
        state.mimeType.set(mimeType)
      }

      ;(previewPanelRef as any).current?.onSelectionChanged({
        name: state.resourceFile.value.name,
        resourceUrl: URL.createObjectURL(state.resourceFile.value) + '#' + state.resourceFile.value.name,
        contentType: MimeTypeToAssetType[state.mimeType.value]
      })
    } else {
      const url = cleanURL(state.resourceURL.value)
      getNameAndType(url).then(({ mimeType, assetType }) => {
        state.mimeType.set(mimeType)
        ;(previewPanelRef as any).current?.onSelectionChanged({
          name: state.name.value,
          resourceUrl: url,
          contentType: assetType
        })
      })
    }
  }, [state.source, state.resourceFile, state.resourceURL])

  const handleSubmit = async () => {
    errors.set(getDefaultErrors())

    if (!state.name.value) {
      errors.name.set(t('admin:components.resources.nameCantEmpty'))
    }
    if (state.source.value === 'file' && !state.resourceFile.value) {
      errors.resourceFile.set(t('admin:components.resources.resourceFileCantEmpty'))
    } else if (state.source.value === 'url' && !state.resourceURL.value) {
      errors.resourceURL.set(t('admin:components.resources.resourceUrlCantEmpty'))
    }
    if (Object.values(errors.value).some((value) => value.length > 0)) {
      return
    }

    try {
      if (state.source.value === 'file' && state.resourceFile.value) {
        await uploadToFeathersService(uploadAssetPath, [state.resourceFile.value], {
          type: 'admin-file-upload',
          args: { path: state.name.value, project: state.project.value }
        })
      } else if (state.source.value === 'url' && state.resourceURL.value) {
        const response = await fetch(state.resourceURL.value)
        const url = cleanURL(state.resourceURL.value)
        const blob = await response.blob()
        const resourceFile = new File([blob], url.split('/').pop()!, {
          type: state.mimeType.value
        })
        await uploadToFeathersService(uploadAssetPath, [resourceFile], {
          type: 'admin-file-upload',
          args: { path: state.name.value, project: state.project.value }
        })
      }
      if (selectedResource?.name && selectedResource?.name !== state.name.value) {
        staticResourcesMutation.patch(selectedResource!.id!, { name: state.name.value })
      }
      PopoverState.hidePopupover()
    } catch (e) {
      NotificationService.dispatchNotify(e.message, { variant: 'error' })
      errors.serverError.set(e.message)
    }
  }

  return (
    <Modal
      title={t('admin:components.resources.createResource')}
      onClose={PopoverState.hidePopupover}
      className="w-[50vw] max-w-2xl"
      onSubmit={handleSubmit}
    >
      <div className="grid w-full gap-4">
        {errors.serverError.value && <p className="mt-4 text-red-700">{errors.serverError.value}</p>}
        <Input
          value={state.name.value}
          label={t('admin:components.resources.resourceName')}
          onChange={(e) => {
            state.name.set(e.target.value)
          }}
          disabled={modalProcessing.value}
        />
        <Input value={state.mimeType.value} label={t('admin:components.resources.columns.mimeType')} disabled />
        <Input
          value={state.project.value}
          label={t('admin:components.resources.columns.project')}
          onChange={(e) => {
            state.project.set(e.target.value)
          }}
          disabled={modalProcessing.value}
        />
        <Radio
          value={state.source.value}
          options={[
            { label: 'URL', value: 'url' },
            { label: 'File', value: 'file' }
          ]}
          horizontal
          onChange={(value) => state.source.set(value)}
          disabled={modalProcessing.value}
        />
        {state.source.value === 'file' && (
          <Button fullWidth className="mb-4" disabled={modalProcessing.value}>
            <label className="block w-full cursor-pointer">
              {t('admin:components.resources.selectFile')}
              <input
                className="mb-4 hidden"
                type="file"
                onChange={(e) => {
                  e.preventDefault()
                  if (e.target.files) {
                    state.resourceFile.set(e.target.files[0])
                  }
                }}
              />
            </label>
          </Button>
        )}

        {state.source.value === 'url' && (
          <Input
            value={state.resourceURL.value}
            onChange={(e) => {
              state.resourceURL.set(e.target.value)
            }}
            label={t('admin:components.resources.resourceUrl')}
            disabled={modalProcessing.value}
          />
        )}

        <AssetsPreviewPanel ref={previewPanelRef} />
      </div>
    </Modal>
  )
}
