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

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { ECSState, createEntity, executeSystems, getComponent, setComponent } from '@etherealengine/ecs'
import { Engine, startEngine } from '@etherealengine/ecs/src/Engine'
import { UndefinedEntity } from '@etherealengine/ecs/src/Entity'
import { Timer } from '@etherealengine/ecs/src/Timer'
import { getMutableState } from '@etherealengine/hyperflux'
import { BoxGeometry, Group, Mesh, MeshNormalMaterial } from 'three'
import { CameraComponent } from './camera/components/CameraComponent'
import { NameComponent } from './common/NameComponent'
import { InputComponent } from './input/components/InputComponent'
import { EngineRenderer } from './renderer/WebGLRendererSystem'
import { addObjectToGroup } from './renderer/components/GroupComponent'
import { setObjectLayers } from './renderer/components/ObjectLayerComponent'
import { RendererComponent } from './renderer/components/RendererComponent'
import { VisibleComponent } from './renderer/components/VisibleComponent'
import { ObjectLayers } from './renderer/constants/ObjectLayers'
import { EntityTreeComponent } from './transform/components/EntityTree'
import { TransformComponent } from './transform/components/TransformComponent'
import { XRState } from './xr/XRState'

/**
 * Creates a new instance of the engine and engine renderer. This initializes all properties and state for the engine,
 * adds action receptors and creates a new world.
 * @returns {Engine}
 */
export const createEngine = () => {
  startEngine()

  Engine.instance.scene.matrixAutoUpdate = false
  Engine.instance.scene.matrixWorldAutoUpdate = false
  Engine.instance.scene.layers.set(ObjectLayers.Scene)

  Engine.instance.localFloorEntity = createEntity()
  setComponent(Engine.instance.localFloorEntity, NameComponent, 'origin')
  setComponent(Engine.instance.localFloorEntity, EntityTreeComponent, { parentEntity: UndefinedEntity })
  setComponent(Engine.instance.localFloorEntity, TransformComponent)
  setComponent(Engine.instance.localFloorEntity, VisibleComponent, true)
  const origin = new Group()
  addObjectToGroup(Engine.instance.localFloorEntity, origin)
  origin.name = 'world-origin'
  const originHelperMesh = new Mesh(new BoxGeometry(0.1, 0.1, 0.1), new MeshNormalMaterial())
  setObjectLayers(originHelperMesh, ObjectLayers.Gizmos)
  originHelperMesh.frustumCulled = false
  origin.add(originHelperMesh)

  Engine.instance.viewerEntity = createEntity()
  setComponent(Engine.instance.viewerEntity, NameComponent, 'camera')
  setComponent(Engine.instance.viewerEntity, CameraComponent)
  setComponent(Engine.instance.viewerEntity, VisibleComponent, true)
  setComponent(Engine.instance.viewerEntity, EntityTreeComponent, { parentEntity: UndefinedEntity })
  setComponent(Engine.instance.viewerEntity, InputComponent)
  const camera = getComponent(Engine.instance.viewerEntity, CameraComponent)
  camera.matrixAutoUpdate = false
  camera.matrixWorldAutoUpdate = false

  if (isClient) {
    EngineRenderer.instance = new EngineRenderer()
    EngineRenderer.instance.initialize()
    setComponent(Engine.instance.cameraEntity, RendererComponent, { renderer: EngineRenderer.instance.renderer })
  }
  getMutableState(ECSState).timer.set(
    Timer(
      (time, xrFrame) => {
        getMutableState(XRState).xrFrame.set(xrFrame)
        executeSystems(time)
        getMutableState(XRState).xrFrame.set(null)
      },
      EngineRenderer.instance?.renderer
    )
  )

  executeSystems(0)
}
