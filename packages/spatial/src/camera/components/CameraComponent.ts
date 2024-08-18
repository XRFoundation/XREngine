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

import { ArrayCamera, PerspectiveCamera } from 'three'

import { defineComponent, useComponent } from '@etherealengine/ecs/src/ComponentFunctions'

import { useEntityContext } from '@etherealengine/ecs'
import { useImmediateEffect } from '@etherealengine/hyperflux'
import { addObjectToGroup, removeObjectFromGroup } from '../../renderer/components/GroupComponent'

export const CameraComponent = defineComponent({
  name: 'CameraComponent',
  jsonID: 'EE_camera',

  onInit: (entity) => {
    const camera = new ArrayCamera()
    camera.fov = 60
    camera.aspect = 1
    camera.near = 0.1
    camera.far = 1000
    camera.cameras = [new PerspectiveCamera().copy(camera, false)]
    return camera
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (typeof json.fov === 'number') component.fov.set(json.fov)
    if (typeof json.aspect === 'number') component.aspect.set(json.aspect)
    if (typeof json.near === 'number') component.near.set(json.near)
    if (typeof json.far === 'number') component.far.set(json.far)
  },

  toJSON: (entity, component) => {
    return {
      fov: component.fov.value,
      aspect: component.aspect.value,
      near: component.near.value,
      far: component.far.value
    }
  },

  reactor: () => {
    const entity = useEntityContext()
    const cameraComponent = useComponent(entity, CameraComponent)

    useImmediateEffect(() => {
      const camera = cameraComponent.value as ArrayCamera
      addObjectToGroup(entity, camera)
      return () => {
        removeObjectFromGroup(entity, camera)
      }
    }, [])
    return null
  }
})
