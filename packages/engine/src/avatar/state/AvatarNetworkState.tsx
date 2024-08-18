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

import { Paginated } from '@feathersjs/feathers'
import React, { useEffect, useLayoutEffect } from 'react'

import { API } from '@etherealengine/common'
import { AvatarID, avatarPath, AvatarType, userAvatarPath } from '@etherealengine/common/src/schema.type.module'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { EntityUUID, getOptionalComponent, setComponent, UUIDComponent } from '@etherealengine/ecs'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { entityExists } from '@etherealengine/ecs/src/EntityFunctions'
import {
  defineState,
  dispatchAction,
  getMutableState,
  none,
  useHookstate,
  useMutableState
} from '@etherealengine/hyperflux'
import { WorldNetworkAction } from '@etherealengine/network'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'

import { AvatarColliderComponent } from '../components/AvatarControllerComponent'
import { loadAvatarModelAsset, unloadAvatarForUser } from '../functions/avatarFunctions'
import { spawnAvatarReceptor } from '../functions/spawnAvatarReceptor'
import { AvatarNetworkAction } from './AvatarNetworkActions'

export const AvatarState = defineState({
  name: 'ee.engine.avatar.AvatarState',

  initial: {} as Record<
    EntityUUID,
    {
      avatarID: AvatarID
      name: string
    }
  >,

  receptors: {
    onSpawn: AvatarNetworkAction.spawn.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].set({ avatarID: action.avatarID, name: action.name })
    }),
    onSetAvatarID: AvatarNetworkAction.setAvatarID.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].merge({ avatarID: action.avatarID })
    }),
    onSetAvatarName: AvatarNetworkAction.setName.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].merge({ name: action.name })
    }),
    onDestroyObject: WorldNetworkAction.destroyEntity.receive((action) => {
      getMutableState(AvatarState)[action.entityUUID].set(none)
    })
  },

  selectRandomAvatar() {
    API.instance
      .service(avatarPath)
      .find({})
      .then((avatars: Paginated<AvatarType>) => {
        const randomAvatar = avatars.data[Math.floor(Math.random() * avatars.data.length)]
        AvatarState.updateUserAvatarId(randomAvatar.id)
      })
  },

  updateUserAvatarId(avatarId: AvatarID) {
    API.instance
      .service(userAvatarPath)
      .patch(null, { avatarId: avatarId }, { query: { userId: Engine.instance.userID } })
      .then(() => {
        dispatchAction(
          AvatarNetworkAction.setAvatarID({
            avatarID: avatarId as AvatarID,
            entityUUID: (Engine.instance.userID + '_avatar') as any as EntityUUID
          })
        )
      })
  },

  reactor: () => {
    const avatarState = useMutableState(AvatarState)
    return (
      <>
        {avatarState.keys.map((entityUUID: EntityUUID) => (
          <AvatarReactor key={entityUUID} entityUUID={entityUUID} />
        ))}
      </>
    )
  }
})

const AvatarReactor = ({ entityUUID }: { entityUUID: EntityUUID }) => {
  const { avatarID, name } = useHookstate(getMutableState(AvatarState)[entityUUID])
  const userAvatarDetails = useHookstate(null as string | null)
  const entity = UUIDComponent.useEntityByUUID(entityUUID)

  useLayoutEffect(() => {
    if (!entity) return
    spawnAvatarReceptor(entityUUID)
  }, [entity])

  useEffect(() => {
    let aborted = false

    API.instance
      .service(avatarPath)
      .get(avatarID.value!)
      .then((avatarDetails) => {
        if (aborted) return

        if (!avatarDetails.modelResource?.url) return

        userAvatarDetails.set(avatarDetails.modelResource.url)
      })

    return () => {
      aborted = true
    }
  }, [avatarID])

  useEffect(() => {
    if (!isClient) return
    if (!entity || !userAvatarDetails.value) return

    loadAvatarModelAsset(entity, userAvatarDetails.value)

    return () => {
      if (!entityExists(entity)) return
      unloadAvatarForUser(entity)
    }
  }, [userAvatarDetails, entity])

  useEffect(() => {
    if (!entity) return
    setComponent(entity, NameComponent, name.value + "'s avatar")
    const colliderEntity = getOptionalComponent(entity, AvatarColliderComponent)?.colliderEntity
    if (colliderEntity) {
      setComponent(colliderEntity, NameComponent, name.value + "'s collider")
    }
  }, [name, entity])

  return null
}
