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
import { twMerge } from 'tailwind-merge'
import { Group, LoaderUtils } from 'three'

import { API } from '@etherealengine/common'
import { modelTransformPath } from '@etherealengine/common/src/schema.type.module'
import { createEntity, Entity, generateEntityUUID, UndefinedEntity, UUIDComponent } from '@etherealengine/ecs'
import { getComponent, hasComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import {
  DefaultModelTransformParameters as defaultParams,
  ModelTransformParameters
} from '@etherealengine/engine/src/assets/classes/ModelTransform'
import { transformModel as clientSideTransformModel } from '@etherealengine/engine/src/assets/compression/ModelTransformFunctions'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { Heuristic, VariantComponent } from '@etherealengine/engine/src/scene/components/VariantComponent'
import { proxifyParentChildRelationships } from '@etherealengine/engine/src/scene/functions/loadGLTFModel'
import { getState, ImmutableArray, NO_PROXY, none, useHookstate } from '@etherealengine/hyperflux'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { Object3DComponent } from '@etherealengine/spatial/src/renderer/components/Object3DComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import {
  EntityTreeComponent,
  removeEntityNodeRecursively
} from '@etherealengine/spatial/src/transform/components/EntityTree'

import { PopoverState } from '@etherealengine/client-core/src/common/services/PopoverState'
import { FileType } from '@etherealengine/ui/src/components/editor/panels/Files/container'
import { useTranslation } from 'react-i18next'
import { defaultLODs, LODList, LODVariantDescriptor } from '../../constants/GLTFPresets'
import exportGLTF from '../../functions/exportGLTF'
import { EditorState } from '../../services/EditorServices'

import ConfirmDialog from '@etherealengine/ui/src/components/tailwind/ConfirmDialog'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import LoadingView from '@etherealengine/ui/src/primitives/tailwind/LoadingView'
import Text from '@etherealengine/ui/src/primitives/tailwind/Text'
import { HiPlus, HiXMark } from 'react-icons/hi2'
import { MdClose } from 'react-icons/md'
import GLTFTransformProperties from '../properties/GLTFTransformProperties'

const createTempEntity = (name: string, parentEntity: Entity = UndefinedEntity): Entity => {
  const entity = createEntity()
  setComponent(entity, NameComponent, name)
  setComponent(entity, VisibleComponent)
  setComponent(entity, TransformComponent)
  setComponent(entity, EntityTreeComponent, { parentEntity })

  let sceneID = getState(EditorState).scenePath!
  if (hasComponent(parentEntity, SourceComponent)) {
    sceneID = getComponent(parentEntity, SourceComponent)
  }
  setComponent(entity, SourceComponent, sceneID)

  const uuid = generateEntityUUID()
  setComponent(entity, UUIDComponent, uuid)

  // These additional properties and relations are required for
  // the current GLTF exporter to successfully generate a GLTF.
  const obj3d = new Group()
  obj3d.entity = entity
  addObjectToGroup(entity, obj3d)
  proxifyParentChildRelationships(obj3d)
  setComponent(entity, Object3DComponent, obj3d)

  return entity
}

export const createLODVariants = async (
  lods: LODVariantDescriptor[],
  clientside: boolean,
  heuristic: Heuristic,
  exportCombined = false
) => {
  const lodVariantParams: ModelTransformParameters[] = lods.map((lod) => ({
    ...lod.params
  }))

  const transformMetadata = [] as Record<string, any>[]
  for (const [i, variant] of lodVariantParams.entries()) {
    if (clientside) {
      await clientSideTransformModel(variant, (key, data) => {
        if (!transformMetadata[i]) transformMetadata[i] = {}
        transformMetadata[i][key] = data
      })
    } else {
      await API.instance.service(modelTransformPath).create(variant)
    }
  }

  if (exportCombined) {
    const modelSrc = `${LoaderUtils.extractUrlBase(lods[0].params.src)}${lods[0].params.dst}.${
      lods[0].params.modelFormat
    }`
    const result = createTempEntity('container')
    setComponent(result, ModelComponent)
    const variant = createTempEntity('LOD Variant', result)
    setComponent(variant, ModelComponent, { src: modelSrc })
    setComponent(variant, VariantComponent, {
      levels: lods.map((lod, lodIndex) => ({
        src: `${LoaderUtils.extractUrlBase(lod.params.src)}${lod.params.dst}.${lod.params.modelFormat}`,
        metadata: {
          ...lod.variantMetadata,
          ...transformMetadata[lodIndex]
        }
      })),
      heuristic
    })

    await exportGLTF(result, lods[0].params.src.replace(/\.[^.]*$/, `-integrated.gltf`))
    removeEntityNodeRecursively(result)
  }
}

export default function ModelCompressionPanel({
  selectedFiles,
  refreshDirectory
}: {
  selectedFiles: ImmutableArray<FileType>
  refreshDirectory: () => Promise<void>
}) {
  const { t } = useTranslation()
  const compressionLoading = useHookstate(false)
  const selectedLODIndex = useHookstate(0)
  const selectedPreset = useHookstate(defaultParams)
  const presetList = useHookstate(structuredClone(LODList))

  useEffect(() => {
    const presets = localStorage.getItem('presets')
    if (presets !== null) {
      presetList.set(JSON.parse(presets))
    }
  }, [])

  const lods = useHookstate<LODVariantDescriptor[]>([])

  const compressContentInBrowser = async () => {
    compressionLoading.set(true)
    for (const file of selectedFiles) {
      await compressModel(file)
    }
    await refreshDirectory()
    compressionLoading.set(false)
  }

  const applyPreset = (preset: ModelTransformParameters) => {
    selectedPreset.set(JSON.parse(JSON.stringify(preset)))
    PopoverState.showPopupover(
      <ConfirmDialog text={t('editor:properties.model.transform.applyPresetConfirmation')} onSubmit={confirmPreset} />
    )
  }

  const confirmPreset = () => {
    const lod = lods[selectedLODIndex.value].get(NO_PROXY)
    const src = lod.params.src
    const dst = lod.params.dst
    const modelFormat = lod.params.modelFormat
    const uri = lod.params.resourceUri

    const presetParams = JSON.parse(JSON.stringify(selectedPreset.value)) as ModelTransformParameters
    presetParams.src = src
    presetParams.dst = dst
    presetParams.modelFormat = modelFormat
    presetParams.resourceUri = uri

    lods[selectedLODIndex.value].params.set(presetParams)
  }

  const savePresetList = () => {
    presetList.merge([JSON.parse(JSON.stringify(lods[selectedLODIndex.value].value))])
    localStorage.setItem('presets', JSON.stringify(presetList.value))
  }

  const compressModel = async (file: FileType) => {
    const clientside = true
    const exportCombined = true

    let fileLODs = lods.value as LODVariantDescriptor[]

    if (selectedFiles.length > 1) {
      fileLODs = fileLODs.map((lod) => {
        const src = file.url
        const fileName = src.split('/').pop()!.split('.').shift()!
        const dst = fileName + lod.suffix
        return {
          ...lod,
          src,
          dst,
          modelFormat: src.endsWith('.gltf') ? 'gltf' : src.endsWith('.vrm') ? 'vrm' : 'glb'
        }
      })
    }

    const heuristic = Heuristic.BUDGET
    await createLODVariants(fileLODs, clientside, heuristic, exportCombined)
  }

  const deletePreset = (event: React.MouseEvent, idx: number) => {
    event.stopPropagation()
    presetList[idx].set(none)
    // presetList.set(presetList.value.filter((_, i) => i !== idx))
    localStorage.setItem('presets', JSON.stringify(presetList.value))
  }

  const handleRemoveLOD = (idx: number) => {
    lods.set((currentLods) => currentLods.filter((_, i) => i !== idx))
    if (selectedLODIndex.value >= lods.length) {
      selectedLODIndex.set(lods.length - 1)
    }
  }

  useEffect(() => {
    const firstFile = selectedFiles[0]
    if (firstFile == null) {
      return
    }

    const fullSrc = firstFile.url
    const fileName = fullSrc.split('/').pop()!.split('.').shift()!

    const defaults = defaultLODs.map((defaultLOD) => {
      const lod = JSON.parse(JSON.stringify(defaultLOD)) as LODVariantDescriptor
      lod.params.src = fullSrc
      lod.params.dst = fileName + lod.suffix
      lod.params.modelFormat = fullSrc.endsWith('.gltf') ? 'gltf' : fullSrc.endsWith('.vrm') ? 'vrm' : 'glb'
      lod.params.resourceUri = ''
      return lod
    })

    lods.set(defaults)
  }, [selectedFiles])

  const handleAddLOD = () => {
    const params = JSON.parse(JSON.stringify(lods[selectedLODIndex.value].params.value)) as ModelTransformParameters
    const suffix = '-LOD' + lods.length
    params.dst = params.dst.replace(lods[selectedLODIndex.value].suffix.value, suffix)
    lods.merge([
      {
        params: params,
        suffix: suffix,
        variantMetadata: {}
      }
    ])
    selectedLODIndex.set(lods.length - 1)
  }

  return (
    <div className="max-h-[80vh] w-[60vw] overflow-y-auto rounded-xl bg-[#0E0F11]">
      <div className="relative flex items-center justify-center px-8 py-3">
        <Text className="leading-6">{t('editor:properties.model.transform.compress')}</Text>
        <Button
          variant="outline"
          className="absolute right-0 border-0 dark:bg-transparent dark:text-[#A3A3A3]"
          startIcon={<MdClose />}
          onClick={() => PopoverState.hidePopupover()}
        />
      </div>
      <div className="px-8 pb-6 pt-2 text-left">
        <Text className="mb-6 font-semibold">{t('editor:properties.model.transform.lodLevels')}</Text>
        <div className="mb-8 flex gap-x-4">
          {lods.value.map((_lod, index) => (
            <span key={index} className="flex items-center">
              <Button
                variant="transparent"
                className={`rounded-none px-1 pb-4 text-sm font-medium ${
                  selectedLODIndex.value === index ? 'border-b border-blue-primary text-blue-primary' : 'text-[#9CA0AA]'
                }`}
                onClick={() => selectedLODIndex.set(Math.min(index, lods.length - 1))}
              >
                {t('editor:properties.model.transform.lodLevelNumber', { index: index + 1 })}
              </Button>
              {selectedLODIndex.value !== index && (
                <Button
                  className={twMerge('m-0 p-0 pb-1')}
                  variant="transparent"
                  onClick={() => handleRemoveLOD(index)}
                  startIcon={<HiXMark />}
                  title="remove"
                />
              )}
            </span>
          ))}
          <Button
            className="self-center rounded-md bg-[#162546] p-1 [&>*]:m-0"
            variant="transparent"
            onClick={handleAddLOD}
          >
            <HiPlus />
          </Button>
        </div>

        <div className="my-8 flex items-center justify-around gap-x-1 overflow-x-auto rounded-lg border border-theme-input p-2">
          {presetList.value.map((lodItem: LODVariantDescriptor, index) => (
            <Button
              key={index}
              variant="transparent"
              className="text-nowrap rounded-full bg-[#2F3137] px-2 py-0.5"
              onClick={() => applyPreset(lodItem.params)}
              endIcon={
                !LODList.find((l) => l.params.dst === lodItem.params.dst) && (
                  <HiXMark onClick={(event) => deletePreset(event, index)} />
                )
              }
            >
              {lodItem.params.dst}
            </Button>
          ))}
          <Button
            variant="transparent"
            className="text-nowrap rounded bg-[#162546] px-3 py-2"
            onClick={() => savePresetList()}
          >
            {t('editor:properties.model.transform.savePreset')}
          </Button>
        </div>

        <div className="ml-[16.66%] w-4/6">
          <GLTFTransformProperties
            transformParms={lods[selectedLODIndex.value].params}
            itemCount={selectedFiles.length}
          />
        </div>

        <div className="flex justify-end px-8">
          {compressionLoading.value ? (
            <LoadingView spinnerOnly className="mx-0 h-12 w-12" />
          ) : (
            <Button variant="primary" onClick={compressContentInBrowser}>
              {t('editor:properties.model.transform.compress')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
