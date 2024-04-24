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

import { getState } from '@etherealengine/hyperflux'
import { WebLayer3D } from '@etherealengine/xrui'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { getComponent, getOptionalComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { addInteractableUI } from '@etherealengine/engine/src/interaction/systems/InteractiveSystem'
import { MediaComponent } from '@etherealengine/engine/src/scene/components/MediaComponent'
import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { createTransitionState } from '@etherealengine/spatial/src/common/functions/createTransitionState'
import { InputState } from '@etherealengine/spatial/src/input/state/InputState'
import { GroupComponent } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import { TransformSystem } from '@etherealengine/spatial/src/transform/systems/TransformSystem'
import { XRUIComponent } from '@etherealengine/spatial/src/xrui/components/XRUIComponent'
import { createMediaControlsView } from './ui/MediaControlsUI'

export const createMediaControlsUI = (entity: Entity) => {
  const ui = createMediaControlsView(entity)

  setComponent(ui.entity, EntityTreeComponent, { parentEntity: entity })
  setComponent(ui.entity, NameComponent, 'mediacontrols-ui-' + entity)

  ui.container.rootLayer.traverseLayersPreOrder((layer: WebLayer3D) => {
    const mat = layer.contentMesh.material as THREE.MeshBasicMaterial
    mat.transparent = true
  })

  const transform = getComponent(entity, TransformComponent)
  const uiTransform = getComponent(ui.entity, TransformComponent)
  uiTransform.position.copy(transform.position)

  return ui
}

export const MediaFadeTransitions = new Map<Entity, ReturnType<typeof createTransitionState>>()

const onUpdate = (entity: Entity, mediaControls: ReturnType<typeof createMediaControlsUI>) => {
  const xrui = getComponent(mediaControls.entity, XRUIComponent)
  const transition = MediaFadeTransitions.get(entity)!
  const buttonLayer = xrui.rootLayer.querySelector('button')
  const group = getOptionalComponent(entity, GroupComponent)
  const pointerScreenRaycaster = getState(InputState).pointerScreenRaycaster
  const intersectObjects = group ? pointerScreenRaycaster.intersectObjects(group, true) : []
  if (intersectObjects.length) {
    transition.setState('IN')
  }
  if (!intersectObjects.length) {
    transition.setState('OUT')
  }
  const deltaSeconds = getState(ECSState).deltaSeconds
  transition.update(deltaSeconds, (opacity) => {
    buttonLayer?.scale.setScalar(0.9 + 0.1 * opacity * opacity)
    xrui.rootLayer.traverseLayersPreOrder((layer: WebLayer3D) => {
      const mat = layer.contentMesh.material as THREE.MeshBasicMaterial
      mat.opacity = opacity
    })
  })
}

const mediaQuery = defineQuery([MediaComponent])

const execute = () => {
  if (getState(EngineState).isEditor || !isClient) return

  for (const entity of mediaQuery.enter()) {
    if (!getComponent(entity, MediaComponent).controls) continue
    addInteractableUI(entity, createMediaControlsUI(entity), onUpdate)
    const transition = createTransitionState(0.25)
    transition.setState('OUT')
    MediaFadeTransitions.set(entity, transition)
  }

  for (const entity of mediaQuery.exit()) {
    if (MediaFadeTransitions.has(entity)) MediaFadeTransitions.delete(entity)
  }
}

export const MediaControlSystem = defineSystem({
  uuid: 'ee.engine.MediaControlSystem',
  insert: { before: TransformSystem },
  execute
})
