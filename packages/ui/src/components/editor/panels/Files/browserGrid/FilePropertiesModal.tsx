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

import { FileThumbnailJobState } from '@etherealengine/client-core/src/common/services/FileThumbnailJobState'
import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { API } from '@etherealengine/common'
import { StaticResourceType, UserType, staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { ImmutableArray, NO_PROXY, State, getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import { HiPencil, HiPlus, HiXMark } from 'react-icons/hi2'
import { RiSave2Line } from 'react-icons/ri'
import Button from '../../../../../primitives/tailwind/Button'
import Input from '../../../../../primitives/tailwind/Input'
import Modal from '../../../../../primitives/tailwind/Modal'
import Text from '../../../../../primitives/tailwind/Text'
import { FileType, createFileDigest, createStaticResourceDigest } from '../container'

export default function FilePropertiesModal({
  projectName,
  files
}: {
  projectName: string
  files: ImmutableArray<FileType>
}) {
  const itemCount = files.length
  if (itemCount === 0) return null
  const { t } = useTranslation()

  const fileStaticResources = useHookstate<StaticResourceType[]>([])
  const fileDigest = createFileDigest(files)
  const resourceDigest = useHookstate<StaticResourceType>(createStaticResourceDigest([]))
  const sharedFields = useHookstate<string[]>([])
  const modifiedFields = useHookstate<string[]>([])
  const editedField = useHookstate<string | null>(null)
  const tagInput = useHookstate<string>('')
  const sharedTags = useHookstate<string[]>([])

  let title: string
  let filename: string
  if (itemCount === 1) {
    const firstFile = files[0]
    filename = firstFile.name
    title = t('editor:layout.filebrowser.fileProperties.header', { fileName: filename.toUpperCase() })
  } else {
    filename = t('editor:layout.filebrowser.fileProperties.mixedValues')
    title = t('editor:layout.filebrowser.fileProperties.header-plural', { itemCount })
  }

  const onChange = (fieldName: string, state: State<any>) => {
    return (e) => {
      if (!modifiedFields.value.includes(fieldName)) {
        modifiedFields.set([...modifiedFields.value, fieldName])
      }
      state.set(e.target.value)
    }
  }

  const handleRegenerateThumbnail = () => {
    for (const resource of fileStaticResources.value) {
      getMutableState(FileThumbnailJobState).merge([
        {
          key: resource.url,
          project: resource.project!,
          id: resource.id
        }
      ])
    }
  }

  const handleSubmit = async () => {
    if (modifiedFields.value.length > 0) {
      const addedTags: string[] = resourceDigest.tags.value!.filter((tag) => !sharedTags.value.includes(tag))
      const removedTags: string[] = sharedTags.value!.filter((tag) => !resourceDigest.tags.value!.includes(tag))
      for (const resource of fileStaticResources.value) {
        const oldTags = resource.tags ?? []
        const newTags = Array.from(new Set([...addedTags, ...oldTags.filter((tag) => !removedTags.includes(tag))]))
        await API.instance.service(staticResourcePath).patch(resource.id, {
          key: resource.key,
          tags: newTags,
          licensing: resourceDigest.licensing.value,
          attribution: resourceDigest.attribution.value,
          project: projectName
        })
      }
      modifiedFields.set([])
      PopoverState.hidePopupover()
    }
  }

  const query = {
    key: {
      $like: undefined,
      $or: files.map(({ key }) => ({
        key
      }))
    },
    $limit: 10000
  }

  const resources = useFind(staticResourcePath, { query })
  useEffect(() => {
    if (resources.data.length === 0) return
    API.instance
      .service('user')
      .get(resources.data[0].userId)
      .then((user) => author.set(user))

    fileStaticResources.set(resources.data)
    const digest = createStaticResourceDigest(resources.data)
    resourceDigest.set(digest)
    sharedFields.set(
      Object.keys(resourceDigest).filter((key) => {
        const value = resourceDigest[key]
        return value.length !== ''
      })
    )
    sharedTags.set(resourceDigest.tags.get(NO_PROXY)!.slice() as string[])
  }, [resources.data.length])

  const author = useHookstate<UserType | null>(null)

  const handleAddTag = () => {
    if (tagInput.value != '' && !resourceDigest.tags.value!.includes(tagInput.value)) {
      if (!modifiedFields.value.includes('tags')) {
        modifiedFields.set([...modifiedFields.value, 'tags'])
      }
      resourceDigest.tags.set([...resourceDigest.tags.value!, tagInput.value])
    }
    tagInput.set('')
  }

  const handleRemoveTag = (index: number) => {
    if (!modifiedFields.value.includes('tags')) {
      modifiedFields.set([...modifiedFields.value, 'tags'])
    }
    resourceDigest.tags.set(resourceDigest.tags.value!.filter((_, i) => i !== index))
  }

  return (
    <Modal
      title={title}
      className="w-96"
      onSubmit={handleSubmit}
      onClose={PopoverState.hidePopupover}
      submitButtonText={t('editor:layout.filebrowser.fileProperties.save-changes')}
      closeButtonText={t('editor:layout.filebrowser.fileProperties.discard')}
    >
      <div className="flex flex-col items-center">
        {fileStaticResources.length === 1 && (
          <img
            src={resources.data[0].thumbnailURL}
            alt={resources.data[0].key}
            className="h-24 w-24 rounded-lg object-cover"
          />
        )}
        <Button
          title={t('editor:layout.filebrowser.fileProperties.regenerateThumbnail')}
          onClick={handleRegenerateThumbnail}
          className="mt-2 text-xs"
        >
          {t('editor:layout.filebrowser.fileProperties.regenerateThumbnail')}
        </Button>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="grid grid-cols-2 gap-2">
          <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.name')}</Text>
          <Text className="text-theme-input">{filename}</Text>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.type')}</Text>
          <Text className="text-theme-input">{fileDigest.type.toUpperCase()}</Text>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.size')}</Text>
          <Text className="text-theme-input">
            {files.map((file) => file.size).reduce((total, value) => total + parseInt(value ?? '0'), 0)}
          </Text>
        </div>
        {fileStaticResources.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.author')}</Text>
              <Text className="text-theme-input">{author.value?.name}</Text>
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.attribution')}</Text>
              <span className="flex items-center">
                {editedField.value === 'attribution' ? (
                  <>
                    <Input
                      value={resourceDigest.attribution.value ?? ''}
                      onChange={onChange('attribution', resourceDigest.attribution)}
                    />
                    <Button
                      title={t('common:components.save')}
                      variant="transparent"
                      size="small"
                      startIcon={<RiSave2Line />}
                      onClick={() => editedField.set(null)}
                    />
                  </>
                ) : (
                  <>
                    <Text className="text-theme-input">
                      {files.length > 1 && !sharedFields.value.includes('attribution')
                        ? t('editor:layout.filebrowser.fileProperties.mixedValues')
                        : resourceDigest.attribution.value || <em>{t('common:components.none')}</em>}
                    </Text>
                    <Button
                      title={t('common:components.edit')}
                      variant="transparent"
                      size="small"
                      startIcon={<HiPencil />}
                      onClick={() => editedField.set('attribution')}
                    />
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 items-center gap-2">
              <Text className="text-end">{t('editor:layout.filebrowser.fileProperties.licensing')}</Text>
              <span className="flex items-center">
                {editedField.value === 'licensing' ? (
                  <>
                    <Input
                      value={resourceDigest.licensing.value ?? ''}
                      onChange={onChange('licensing', resourceDigest.licensing)}
                    />
                    <Button
                      title={t('common:components.save')}
                      variant="transparent"
                      size="small"
                      startIcon={<RiSave2Line />}
                      onClick={() => editedField.set(null)}
                    />
                  </>
                ) : (
                  <>
                    <Text className="text-theme-input">
                      {files.length > 1 && !sharedFields.value.includes('licensing')
                        ? t('editor:layout.filebrowser.fileProperties.mixedValues')
                        : resourceDigest.licensing.value || <em>{t('common:components.none')}</em>}
                    </Text>
                    <Button
                      title={t('common:components.edit')}
                      variant="transparent"
                      size="small"
                      startIcon={<HiPencil />}
                      onClick={() => editedField.set('licensing')}
                    />
                  </>
                )}
              </span>
            </div>
            <div className="mt-10 flex flex-col gap-2">
              <Text className="text-theme-gray3" fontSize="sm">
                {t('editor:layout.filebrowser.fileProperties.addTag')}
              </Text>
              <div className="flex items-center gap-2">
                <Input
                  value={tagInput.value}
                  onChange={(event) => tagInput.set(event.target.value)}
                  onKeyUp={(event) => {
                    if (event.key === 'Enter') {
                      handleAddTag()
                    }
                  }}
                />
                <Button
                  startIcon={<HiPlus />}
                  title={t('editor:layout.filebrowser.fileProperties.add')}
                  onClick={handleAddTag}
                />
              </div>
              <div className="flex h-24 flex-wrap gap-2 overflow-y-auto bg-theme-surfaceInput p-2">
                {resourceDigest.tags.value!.map((tag, idx) => (
                  <span key={idx} className="flex h-fit w-fit items-center rounded bg-[#2F3137] px-2 py-0.5">
                    {tag} <HiXMark className="ml-1 cursor-pointer" onClick={() => handleRemoveTag(idx)} />
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
