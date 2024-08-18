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

import React, { useCallback, useEffect } from 'react'
import { DoubleSide, Mesh } from 'three'

import { API } from '@etherealengine/common'
import { modelTransformPath } from '@etherealengine/common/src/schema.type.module'
import {
  ComponentType,
  getMutableComponent,
  hasComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import exportGLTF from '@etherealengine/editor/src/functions/exportGLTF'
import { SelectionState } from '@etherealengine/editor/src/services/SelectionServices'
import {
  DefaultModelTransformParameters,
  ModelTransformParameters
} from '@etherealengine/engine/src/assets/classes/ModelTransform'
import { transformModel as clientSideTransformModel } from '@etherealengine/engine/src/assets/compression/ModelTransformFunctions'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { getModelResources } from '@etherealengine/engine/src/scene/functions/loaders/ModelFunctions'
import { useHookstate } from '@etherealengine/hyperflux'
import { NO_PROXY, State, useMutableState } from '@etherealengine/hyperflux/functions/StateFunctions'
import { IoIosArrowBack, IoIosArrowDown } from 'react-icons/io'
import Accordion from '../../../../../primitives/tailwind/Accordion'
import Button from '../../../../../primitives/tailwind/Button'
import LoadingView from '../../../../../primitives/tailwind/LoadingView'
import BooleanInput from '../../../input/Boolean'
import InputGroup from '../../../input/Group'
import StringInput from '../../../input/String'
import TexturePreviewInput from '../../../input/Texture'
import GLTFTransformProperties from '../../gltf/transform'

export default function ModelTransformProperties({ entity, onChangeModel }: { entity: Entity; onChangeModel: any }) {
  const modelState = useComponent(entity, ModelComponent)
  const selectionState = useMutableState(SelectionState)
  const transforming = useHookstate<boolean>(false)
  const transformHistory = useHookstate<string[]>([])
  const isClientside = useHookstate<boolean>(true)
  const isBatchCompress = useHookstate<boolean>(false)
  const transformParms = useHookstate<ModelTransformParameters>({
    ...DefaultModelTransformParameters,
    src: modelState.src.value,
    modelFormat: modelState.src.value.endsWith('.gltf') ? 'gltf' : modelState.src.value.endsWith('.vrm') ? 'vrm' : 'glb'
  })

  const vertexBakeOptions = useHookstate({
    map: true,
    emissive: true,
    lightMap: true,
    matcapPath: ''
  })

  const doVertexBake = useCallback(
    (modelState: State<ComponentType<typeof ModelComponent>>) => async () => {
      // const attribs = [
      //   ...(vertexBakeOptions.map.value ? [{ field: 'map', attribName: 'uv' }] : []),
      //   ...(vertexBakeOptions.emissive.value ? [{ field: 'emissiveMap', attribName: 'uv' }] : []),
      //   ...(vertexBakeOptions.lightMap.value ? [{ field: 'lightMap', attribName: 'uv2' }] : [])
      // ] as { field: keyof MeshStandardMaterial; attribName: string }[]
      // const colors: (keyof MeshStandardMaterial)[] = ['color']
      // const src: MaterialSource = { type: SourceType.MODEL, path: modelState.src.value }
      // await Promise.all(
      //   materialsFromSource(src)?.map((matComponent) =>
      //     bakeToVertices<MeshStandardMaterial>(
      //       entity,
      //       matComponent.material as MeshStandardMaterial,
      //       colors,
      //       attribs,
      //       modelState.scene.value,
      //       MeshBasicMaterial.prototypeId
      //     )
      //   ) ?? []
      // )
    },
    [vertexBakeOptions]
  )

  const attribToDelete = useHookstate('uv uv2')

  const deleteAttribute = useCallback(
    (modelState: State<ComponentType<typeof ModelComponent>>) => () => {
      const toDeletes = attribToDelete.value.split(/\s+/)
      modelState.scene.value?.traverse((mesh: Mesh) => {
        if (!mesh?.isMesh) return
        const geometry = mesh.geometry
        if (!geometry?.isBufferGeometry) return
        toDeletes.map((toDelete) => {
          if (geometry.hasAttribute(toDelete)) {
            geometry.deleteAttribute(toDelete)
          }
        })
      })
    },
    [attribToDelete]
  )

  const onTransformModel = useCallback(
    (modelState: State<ComponentType<typeof ModelComponent>>) => async () => {
      transforming.set(true)
      const modelSrc = modelState.src.value
      const batchCompressed = isBatchCompress.value
      const clientside = isClientside.value
      const textureSizes = batchCompressed ? [2048, 1024, 512] : [transformParms.maxTextureSize.value]
      let nuPath: string | null = null

      const variants = batchCompressed
        ? textureSizes.map((maxTextureSize, index) => {
            const suffix = `-LOD_${index}`
            const dst = transformParms.dst.value.replace(/\.(glb|gltf|vrm)$/, `${suffix}.$1`)
            return { ...transformParms.get(NO_PROXY), maxTextureSize, dst }
          })
        : [transformParms.get(NO_PROXY)]

      for (const variant of variants) {
        if (clientside) {
          nuPath = await clientSideTransformModel(variant as ModelTransformParameters)
        } else {
          await API.instance.service(modelTransformPath).create(variant)
        }
      }

      if (!batchCompressed) {
        onChangeModel(nuPath)
      }
      transformHistory.set([modelSrc, ...transformHistory.value])
      transforming.set(false)
    },
    [transformParms]
  )

  const onUndoTransform = useCallback(async () => {
    const prev = transformHistory.value[0]
    onChangeModel(prev)
    transformHistory.set(transformHistory.value.slice(1))
  }, [transforming])

  const onBakeSelected = useCallback(async () => {
    const selectedModelEntities: Entity[] = SelectionState.getSelectedEntities()
      .filter((entity) => typeof entity !== 'string' && hasComponent(entity, ModelComponent))
      .map((entity: Entity) => entity)
    for (const entity of selectedModelEntities) {
      console.log('at entity ' + entity)
      const modelComponent = getMutableComponent(entity, ModelComponent)
      console.log('processing model from src ' + modelComponent.src.value)
      //bake lightmaps to vertices
      console.log('baking vertices...')
      await doVertexBake(modelComponent)()
      console.log('baked vertices')
      //delete uv and uv2 attributes
      console.log('deleting attributes...')
      await deleteAttribute(modelComponent)()
      console.log('deleted attributes')
      //set materials to be double-sided
      modelComponent.scene.value?.traverse((mesh: Mesh) => {
        if (!mesh?.isMesh) return
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        materials.map((material) => (material.side = DoubleSide))
      })
      //save changes to model
      const bakedPath = modelComponent.src.value.replace(/\.glb$/, '-baked.glb')
      console.log('saving baked model to ' + bakedPath + '...')
      await exportGLTF(entity, bakedPath)
      console.log('saved baked model')
      //perform gltf transform
      console.log('transforming model at ' + bakedPath + '...')
      const transformedPath = await API.instance.service(modelTransformPath).create(transformParms.value)
      console.log('transformed model into ' + transformedPath)
      onChangeModel(transformedPath)
    }
  }, [selectionState.selectedEntities])

  useEffect(() => {
    const fullSrc = modelState.src.value
    const fileName = fullSrc.split('/').pop()!.split('.').shift()!
    const dst = `${fileName}-transformed`
    transformParms.dst.set(dst)
  }, [modelState.src])

  useEffect(() => {
    transformParms.resources.set(getModelResources(entity, transformParms.value as ModelTransformParameters))
  }, [modelState.scene, transformParms])

  return (
    <Accordion
      className="space-y-4 p-4"
      title="Model Transform Properties"
      expandIcon={<IoIosArrowBack className="text-xl text-gray-300" />}
      shrinkIcon={<IoIosArrowDown className="text-xl text-gray-300" />}
      titleClassName="text-gray-300"
      titleFontSize="base"
    >
      <div className="mr-2 flex flex-col gap-2">
        <Accordion
          className="p-0"
          title="glTF-Transform"
          expandIcon={<IoIosArrowBack className="text-xl text-gray-300" />}
          shrinkIcon={<IoIosArrowDown className="text-xl text-gray-300" />}
          titleClassName="text-gray-300"
          titleFontSize="base"
        >
          <GLTFTransformProperties transformParms={transformParms} itemCount={1} />
        </Accordion>
        <Accordion
          className="p-0"
          title="Transform"
          expandIcon={<IoIosArrowBack className="text-xl text-gray-300" />}
          shrinkIcon={<IoIosArrowDown className="text-xl text-gray-300" />}
          titleClassName="text-gray-300"
          titleFontSize="base"
        >
          {!transforming.value && (
            <>
              <InputGroup name="Clientside Transform" label="Clientside Transform">
                <BooleanInput
                  value={isClientside.value}
                  onChange={(val: boolean) => {
                    isClientside.set(val)
                  }}
                />
              </InputGroup>
              <InputGroup name="Batch Compress" label="Batch Compress">
                <BooleanInput
                  value={isBatchCompress.value}
                  onChange={(val: boolean) => {
                    isBatchCompress.set(val)
                  }}
                />
              </InputGroup>
              <div className="flex flex-col items-end py-1">
                <Button variant="outline" onClick={onTransformModel(modelState)}>
                  Optimize
                </Button>
              </div>
            </>
          )}
          {transforming.value && (
            <LoadingView fullSpace className="mb-2 flex h-[10%] w-[10%] justify-center" title=" Transforming..." />
          )}
          {transformHistory.length > 0 && (
            <div className="flex flex-col items-end py-1">
              <Button onClick={onUndoTransform}>Undo</Button>
            </div>
          )}
        </Accordion>
        <Accordion
          className="p-0"
          title="Delete Attribute"
          expandIcon={<IoIosArrowBack className="text-xl text-gray-300" />}
          shrinkIcon={<IoIosArrowDown className="text-xl text-gray-300" />}
          titleClassName="text-gray-300"
          titleFontSize="base"
        >
          <InputGroup name="Attribute" label="Attribute">
            <StringInput value={attribToDelete.value} onChange={attribToDelete.set} />
          </InputGroup>
          <div className="flex flex-col items-end">
            <Button variant="outline" onClick={deleteAttribute(modelState)}>
              Delete Attribute
            </Button>
          </div>
        </Accordion>
        <Accordion
          className="p-0"
          title="Bake To Vertices"
          expandIcon={<IoIosArrowBack className="text-xl text-gray-300" />}
          shrinkIcon={<IoIosArrowDown className="text-xl text-gray-300" />}
          titleClassName="text-gray-300"
          titleFontSize="base"
        >
          <InputGroup name="map" label="map">
            <BooleanInput
              value={vertexBakeOptions.map.value}
              onChange={(val: boolean) => {
                vertexBakeOptions.map.set(val)
              }}
            />
          </InputGroup>
          <InputGroup name="lightMap" label="lightMap">
            <BooleanInput
              value={vertexBakeOptions.lightMap.value}
              onChange={(val: boolean) => {
                vertexBakeOptions.lightMap.set(val)
              }}
            />
          </InputGroup>
          <InputGroup name="emissive" label="emissive">
            <BooleanInput
              value={vertexBakeOptions.emissive.value}
              onChange={(val: boolean) => {
                vertexBakeOptions.emissive.set(val)
              }}
            />
          </InputGroup>
          <InputGroup name="matcap" label="matcap">
            <TexturePreviewInput
              value={vertexBakeOptions.matcapPath.value}
              onRelease={(val: string) => {
                vertexBakeOptions.matcapPath.set(val)
              }}
            />
          </InputGroup>
          <div className="flex flex-col items-end gap-2">
            <Button onClick={doVertexBake(modelState)}>Bake To Vertices</Button>
            <Button onClick={onBakeSelected}>Bake And Optimize</Button>
          </div>
        </Accordion>
      </div>
    </Accordion>
  )
}
