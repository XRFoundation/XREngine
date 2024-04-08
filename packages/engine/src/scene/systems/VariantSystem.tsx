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

import { getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { PresentationSystemGroup } from '@etherealengine/ecs'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { SceneState } from '@etherealengine/engine/src/scene/Scene'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { PerformanceState } from '@etherealengine/spatial/src/renderer/PerformanceState'
import { MeshComponent } from '@etherealengine/spatial/src/renderer/components/MeshComponent'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import { Not } from 'bitecs'
import { useEffect } from 'react'
import { InstancingComponent } from '../components/InstancingComponent'
import { ModelComponent } from '../components/ModelComponent'
import { VariantComponent } from '../components/VariantComponent'
import {
  setInstancedMeshVariant,
  setMeshVariant,
  setModelVariant,
  setModelVariantLOD
} from '../functions/loaders/VariantFunctions'

const updateFrequency = 0.1
let lastUpdate = 0

export const modelVariantQuery = defineQuery([VariantComponent, ModelComponent, TransformComponent])
export const meshVariantQuery = defineQuery([
  VariantComponent,
  MeshComponent,
  TransformComponent,
  Not(InstancingComponent)
])
export const instancedMeshVariantQuery = defineQuery([
  VariantComponent,
  MeshComponent,
  TransformComponent,
  InstancingComponent
])

function execute() {
  const engineState = getState(EngineState)
  if (!getState(SceneState).sceneLoaded || engineState.isEditing) return

  const ecsState = getState(ECSState)

  if (ecsState.elapsedSeconds - lastUpdate < updateFrequency) return
  lastUpdate = ecsState.elapsedSeconds

  for (const entity of modelVariantQuery()) {
    setModelVariant(entity)
  }
  for (const entity of meshVariantQuery()) {
    setMeshVariant(entity)
  }
  for (const entity of instancedMeshVariantQuery()) {
    setInstancedMeshVariant(entity)
  }
}

function reactor() {
  const performanceState = useHookstate(getMutableState(PerformanceState))
  const sceneState = useHookstate(getMutableState(SceneState))

  useEffect(() => {
    if (!sceneState.sceneLoaded.value || getState(EngineState).isEditing) return
    const offset = performanceState.performanceOffset.value
    for (const entity of modelVariantQuery()) {
      setModelVariantLOD(entity, offset)
    }
  }, [performanceState.performanceOffset, sceneState.sceneLoaded])

  return null
}

export const VariantSystem = defineSystem({
  uuid: 'ee.engine.scene.VariantSystem',
  insert: { after: PresentationSystemGroup },
  execute,
  reactor
})
