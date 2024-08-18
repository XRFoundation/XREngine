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

import React, { useEffect, useLayoutEffect } from 'react'

import { NetworkId } from '@etherealengine/common/src/interfaces/NetworkId'
import { UserID } from '@etherealengine/common/src/schema.type.module'
import {
  Engine,
  EntityUUID,
  getOptionalComponent,
  removeEntity,
  setComponent,
  UUIDComponent
} from '@etherealengine/ecs'
import {
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  none,
  PeerID,
  useHookstate,
  useMutableState
} from '@etherealengine/hyperflux'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'

import { WorldNetworkAction } from './functions/WorldNetworkAction'
import { NetworkObjectComponent } from './NetworkObjectComponent'
import { NetworkState, SceneUser } from './NetworkState'
import { NetworkWorldUserState } from './NetworkUserState'

export const EntityNetworkState = defineState({
  name: 'ee.EntityNetworkState',

  initial: {} as Record<
    EntityUUID,
    {
      parentUUID: EntityUUID
      ownerId: UserID | typeof SceneUser
      ownerPeer: PeerID
      networkId: NetworkId
      authorityPeerId: PeerID
      requestingPeerId?: PeerID
    }
  >,

  receptors: {
    onSpawnObject: WorldNetworkAction.spawnEntity.receive((action) => {
      // const userId = getState(NetworkState).networks[action.$network].peers[action.$peer].userId
      getMutableState(EntityNetworkState)[action.entityUUID].merge({
        parentUUID: action.parentUUID,
        ownerId: action.ownerID,
        networkId: action.networkId,
        authorityPeerId: action.authorityPeerId ?? action.$peer,
        ownerPeer: action.$peer
      })
    }),

    onRequestAuthorityOverObject: WorldNetworkAction.requestAuthorityOverObject.receive((action) => {
      getMutableState(EntityNetworkState)[action.entityUUID].requestingPeerId.set(action.newAuthority)
    }),

    onTransferAuthorityOfObject: WorldNetworkAction.transferAuthorityOfObject.receive((action) => {
      const fromUserId = action.ownerID
      const state = getMutableState(EntityNetworkState)
      const ownerUserId = state[action.entityUUID].ownerId.value
      if (fromUserId !== ownerUserId) return // Authority transfer can only be initiated by owner
      state[action.entityUUID].authorityPeerId.set(action.newAuthority)
      state[action.entityUUID].requestingPeerId.set(none)
    }),

    onDestroyObject: WorldNetworkAction.destroyEntity.receive((action) => {
      getMutableState(EntityNetworkState)[action.entityUUID].set(none)
    })
  },

  reactor: () => {
    const state = useMutableState(EntityNetworkState)
    return (
      <>
        {state.keys.map((uuid: EntityUUID) => (
          <EntityNetworkReactor uuid={uuid} key={uuid} />
        ))}
      </>
    )
  }
})

const EntityNetworkReactor = (props: { uuid: EntityUUID }) => {
  const state = useHookstate(getMutableState(EntityNetworkState)[props.uuid])
  const ownerID = state.ownerId.value
  const isOwner = ownerID === SceneUser || ownerID === Engine.instance.userID
  const userConnected = !!useHookstate(getMutableState(NetworkWorldUserState)[ownerID]).value || isOwner
  const isWorldNetworkConnected = !!useHookstate(NetworkState.worldNetworkState).value

  useLayoutEffect(() => {
    if (!userConnected) return
    const entity =
      ownerID === SceneUser
        ? UUIDComponent.getEntityByUUID(props.uuid)
        : UUIDComponent.getOrCreateEntityByUUID(props.uuid)
    return () => {
      removeEntity(entity)
    }
  }, [userConnected])

  useLayoutEffect(() => {
    if (!userConnected) return
    const entity = UUIDComponent.getEntityByUUID(props.uuid)
    const parentEntity = UUIDComponent.getEntityByUUID(state.parentUUID.value)
    if (!parentEntity || !entity) return
    setComponent(entity, EntityTreeComponent, { parentEntity })
  }, [userConnected, state.parentUUID])

  useLayoutEffect(() => {
    if (!userConnected) return
    const entity = UUIDComponent.getEntityByUUID(props.uuid)
    if (!entity) return
    const worldNetwork = NetworkState.worldNetwork

    setComponent(entity, NetworkObjectComponent, {
      ownerId:
        ownerID === SceneUser ? (isWorldNetworkConnected ? worldNetwork.hostUserID : Engine.instance.userID) : ownerID,
      ownerPeer: state.ownerPeer.value,
      authorityPeerID: state.authorityPeerId.value,
      networkId: state.networkId.value
    })
  }, [isWorldNetworkConnected, userConnected, state.ownerId.value, state.authorityPeerId.value, state.networkId.value])

  useLayoutEffect(() => {
    if (!userConnected || !state.requestingPeerId.value) return
    // Authority request can only be processed by owner

    const entity = UUIDComponent.getEntityByUUID(props.uuid)
    if (!entity) return
    const ownerID = getOptionalComponent(entity, NetworkObjectComponent)?.ownerId
    if (!ownerID || ownerID !== Engine.instance.userID) return
    console.log('Requesting authority over object', props.uuid, state.requestingPeerId.value)
    dispatchAction(
      WorldNetworkAction.transferAuthorityOfObject({
        ownerID: state.ownerId.value,
        entityUUID: props.uuid,
        newAuthority: state.requestingPeerId.value
      })
    )
  }, [userConnected, state.requestingPeerId.value])

  return <>{isOwner && isWorldNetworkConnected && <OwnerPeerReactor uuid={props.uuid} />}</>
}

const OwnerPeerReactor = (props: { uuid: EntityUUID }) => {
  const state = useHookstate(getMutableState(EntityNetworkState)[props.uuid])
  const ownerPeer = state.ownerPeer.value
  const networkState = useHookstate(NetworkState.worldNetworkState)

  /** If the owner peer does not exist in the network, and we are the owner user, dispatch a spawn action so we take ownership */
  useEffect(() => {
    return () => {
      // ensure reactor isn't completely unmounting
      if (!getState(EntityNetworkState)[props.uuid]) return
      if (ownerPeer !== Engine.instance.store.peerID && Engine.instance.store.userID === state.ownerId.value) {
        const lowestPeer = [...networkState.users[Engine.instance.userID].value].sort((a, b) => (a > b ? 1 : -1))[0]
        if (lowestPeer !== Engine.instance.store.peerID) return
        dispatchAction(
          WorldNetworkAction.spawnEntity({
            entityUUID: props.uuid,
            parentUUID: state.parentUUID.value,
            // if the authority peer is not connected, we need to take authority
            authorityPeerId: networkState.users[Engine.instance.userID].value.includes(ownerPeer)
              ? undefined
              : Engine.instance.store.peerID
          })
        )
      }
    }
  }, [networkState.peers, networkState.users])

  return null
}
