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

import { MathUtils } from 'three'

import { defineState, getState, useImmediateEffect, useMutableState } from '@etherealengine/hyperflux'

import { defineComponent, setComponent, useComponent } from './ComponentFunctions'
import { Entity, EntityUUID, UndefinedEntity } from './Entity'
import { createEntity, useEntityContext } from './EntityFunctions'

export const UUIDState = defineState({
  name: 'UUIDState',
  initial: () => ({}) as Record<EntityUUID, Entity>
})

export const UUIDComponent = defineComponent({
  name: 'UUIDComponent',
  jsonID: 'EE_uuid',

  onInit: () => '' as EntityUUID,

  onSet: (entity, component, uuid: EntityUUID) => {
    if (!uuid) throw new Error('UUID cannot be empty')
    if (component.value === uuid) return
    component.set(uuid)
  },

  toJSON(entity, component) {
    return component.value
  },

  reactor: () => {
    const entity = useEntityContext()
    const uuidComponent = useComponent(entity, UUIDComponent)
    const uuidState = useMutableState(UUIDState)

    useImmediateEffect(() => {
      const uuid = uuidComponent.value

      // throw error if uuid is already in use
      const currentEntity = uuidState[uuid].value
      if (currentEntity && currentEntity !== entity) {
        throw new Error(`UUID ${uuid} is already in use for entity ${currentEntity}, cannot use for entity ${entity}`)
      }

      // set new uuid
      uuidState.merge({ [uuid]: entity })

      return () => {
        // remove old uuid
        uuidState.merge({ [uuid]: UndefinedEntity })
      }
    }, [uuidComponent.value])

    return null
  },

  useEntityByUUID(uuid: EntityUUID) {
    return useMutableState(UUIDState)[uuid].value || UndefinedEntity
  },

  getEntityByUUID(uuid: EntityUUID) {
    return getState(UUIDState)[uuid] || UndefinedEntity
  },

  getOrCreateEntityByUUID(uuid: EntityUUID) {
    let entity = getState(UUIDState)[uuid]
    if (!entity) {
      entity = createEntity()
      setComponent(entity, UUIDComponent, uuid)
    }
    return entity
  },

  generateUUID() {
    return MathUtils.generateUUID() as EntityUUID
  }
})
