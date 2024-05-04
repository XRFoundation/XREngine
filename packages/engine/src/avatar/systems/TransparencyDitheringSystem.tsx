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

import {
  Entity,
  PresentationSystemGroup,
  QueryReactor,
  UUIDComponent,
  defineQuery,
  defineSystem,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  useComponent,
  useEntityContext,
  useOptionalComponent
} from '@etherealengine/ecs'
import { useHookstate } from '@etherealengine/hyperflux'
import {
  MaterialComponent,
  MaterialComponents,
  pluginByName
} from '@etherealengine/spatial/src/renderer/materials/MaterialComponent'
import React, { useEffect } from 'react'
import { FrontSide } from 'three'
import { ModelComponent } from '../../scene/components/ModelComponent'
import { SourceComponent } from '../../scene/components/SourceComponent'
import { useModelSceneID } from '../../scene/functions/loaders/ModelFunctions'
import {
  TransparencyDitheringComponent,
  TransparencyDitheringPlugin,
  maxDitherPoints
} from '../components/TransparencyDitheringComponent'

const TransparencyDitheringQuery = defineQuery([TransparencyDitheringComponent[0]])
const execute = () => {
  const pluginEntity = pluginByName[TransparencyDitheringPlugin.id]
  const pluginComponent = getComponent(pluginEntity, MaterialComponent[MaterialComponents.Plugin])

  for (const entity of TransparencyDitheringQuery()) {
    const ditherComponent = getComponent(entity, TransparencyDitheringComponent[0])
    for (const uuid of ditherComponent.materialUUIDs) {
      const materialComponent = getComponent(
        UUIDComponent.getEntityByUUID(uuid),
        MaterialComponent[MaterialComponents.State]
      )
      const material = materialComponent.material
      if (!material) continue
      for (let i = 0; i < maxDitherPoints; i++) {
        const ditherComponent = getOptionalComponent(entity, TransparencyDitheringComponent[i])
        if (!ditherComponent) break
        if (!material.shader || !pluginComponent.shader) break
        const shader = pluginComponent.shader[material.name]
        shader.uniforms.centers.value[i] = ditherComponent.center
        shader.uniforms.exponents.value[i] = ditherComponent.exponent
        shader.uniforms.distances.value[i] = ditherComponent.distance
        shader.uniforms.useWorldCalculation.value[i] = ditherComponent.calculationType
      }
    }
  }
}

const reactor = () => {
  return <>{<QueryReactor Components={[TransparencyDitheringComponent[0]]} ChildEntityReactor={DitherReactor} />}</>
}

const DitherReactor = () => {
  const entity = useEntityContext()

  const modelComponent = useComponent(entity, ModelComponent)
  useEffect(() => {
    getMutableComponent(entity, TransparencyDitheringComponent[0]).materialUUIDs.set([])
  }, [modelComponent.src])

  const sceneInstanceID = useModelSceneID(entity)
  const childEntities = useHookstate(SourceComponent.entitiesBySourceState[sceneInstanceID])
  return (
    <>
      {childEntities.value?.map((childEntity) => (
        <DitherChildReactor key={childEntity} entity={childEntity} rootEntity={entity} />
      ))}
    </>
  )
}

/**@todo rather than mutating the source materials, we should use clones for a specific entity to prevent unintended dithering */
const DitherChildReactor = (props: { entity: Entity; rootEntity: Entity }) => {
  const { entity, rootEntity } = props

  const materialUUIDs = useComponent(rootEntity, TransparencyDitheringComponent[0]).materialUUIDs
  const materialComponentUUID = useOptionalComponent(entity, MaterialComponent[MaterialComponents.Instance])?.uuid
  useEffect(() => {
    if (!materialComponentUUID?.value) return
    for (const materialUUID of materialComponentUUID.value) {
      const material = UUIDComponent.getEntityByUUID(materialUUID)
      const materialComponent = getMutableComponent(material, MaterialComponent[MaterialComponents.State])
      if (materialComponent.pluginEntities.value)
        materialComponent.pluginEntities.set([
          ...materialComponent.pluginEntities.value,
          pluginByName[TransparencyDitheringPlugin.id]
        ])
      materialComponent.material.value!.alphaTest = 0.5
      materialComponent.material.value!.side = FrontSide
      const ditheringComponent = getMutableComponent(rootEntity, TransparencyDitheringComponent[0])
      ditheringComponent.materialUUIDs.set([...ditheringComponent.materialUUIDs.value, materialUUID])
    }
  }, [materialComponentUUID])

  return null
}

export const TransparencyDitheringSystem = defineSystem({
  uuid: 'TransparencyDitheringSystem',
  insert: { with: PresentationSystemGroup },
  execute,
  reactor
})
