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

import { Object3D } from 'three'

import { defineComponent, useComponent, useEntityContext, useOptionalComponent } from '@etherealengine/ecs'

import { NO_PROXY, useImmediateEffect } from '@etherealengine/hyperflux'
import { NameComponent } from '../../common/NameComponent'

export const Object3DComponent = defineComponent({
  name: 'Object3D Component',
  jsonID: 'EE_object3d',

  onInit: (entity) => null! as Object3D,
  onSet: (entity, component, object3d: Object3D) => {
    if (!object3d || !object3d.isObject3D) throw new Error('Object3DComponent: Invalid object3d')
    component.set(object3d)
  },

  reactor: () => {
    const entity = useEntityContext()
    const object3DComponent = useComponent(entity, Object3DComponent)
    const nameComponent = useOptionalComponent(entity, NameComponent)

    useImmediateEffect(() => {
      if (!nameComponent) return
      const object = object3DComponent.get(NO_PROXY) as Object3D
      object.name = nameComponent.value
    }, [nameComponent?.value])

    return null
  }
})
