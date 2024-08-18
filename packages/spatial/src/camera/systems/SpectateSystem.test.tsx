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

import { act, render } from '@testing-library/react'
import assert from 'assert'
import React from 'react'

import { UserID } from '@etherealengine/common/src/schema.type.module'
import {
  Engine,
  EntityUUID,
  SystemDefinitions,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  destroyEngine,
  removeEntity,
  setComponent
} from '@etherealengine/ecs'
import { createEngine } from '@etherealengine/ecs/src/Engine'
import { PeerID, applyIncomingActions, dispatchAction, getState } from '@etherealengine/hyperflux'
import {
  Network,
  NetworkPeerFunctions,
  NetworkState,
  NetworkTopics,
  NetworkWorldUserStateSystem
} from '@etherealengine/network'
import { createMockNetwork } from '../../../../network/tests/createMockNetwork'
import { SpectateActions, SpectateEntityState } from './SpectateSystem'

describe('SpectateSystem', async () => {
  let viewerEntity = UndefinedEntity

  describe('SpectateEntityState', async () => {
    beforeEach(async () => {
      createEngine()
      createMockNetwork()
      Engine.instance.store.defaultDispatchDelay = () => 0
      viewerEntity = createEntity()
      setComponent(viewerEntity, UUIDComponent, UUIDComponent.generateUUID())
    })

    afterEach(() => {
      removeEntity(viewerEntity)
      return destroyEngine()
    })

    const NetworkWorldUserStateSystemReactor = SystemDefinitions.get(NetworkWorldUserStateSystem)!.reactor!
    const tag = <NetworkWorldUserStateSystemReactor />

    it('should start spectating an entity when the `spectateEntity` action is dispatched', async () => {
      const hostUserId = 'world' as UserID
      const userId = 'user id' as UserID
      const userUuid = userId as any as EntityUUID
      const peerID = Engine.instance.store.peerID
      const peerID2 = 'peer id 2' as PeerID
      const peerID3 = 'peer id 3' as PeerID
      const spectatorID = 'spectator id' as UserID

      Engine.instance.store.userID = userId
      const network: Network = NetworkState.worldNetwork

      NetworkPeerFunctions.createPeer(network, peerID, 0, hostUserId, 0)
      NetworkPeerFunctions.createPeer(network, peerID2, 1, userId, 1)
      NetworkPeerFunctions.createPeer(network, peerID3, 2, userId, 2)

      const { rerender, unmount } = render(tag)
      await act(() => rerender(tag))

      dispatchAction(
        SpectateActions.spectateEntity({
          spectatorUserID: spectatorID,
          spectatingEntity: userUuid,
          $topic: NetworkTopics.world,
          $peer: Engine.instance.store.peerID
        })
      )
      applyIncomingActions()
      const state = getState(SpectateEntityState)[spectatorID]
      assert.notEqual(state, undefined, "The spectator's SpectateEntityState should not be undefined after `getState`")
      assert.equal(state.spectating, userId, 'The spectator is not spectating the correct userID')

      unmount()
    })

    it('should stop spectating an entity when the `exitSpectate` action is dispatched', async () => {
      const hostUserId = 'world' as UserID
      const userId = 'user id' as UserID
      const userUuid = userId as any as EntityUUID
      const peerID = Engine.instance.store.peerID
      const peerID2 = 'peer id 2' as PeerID
      const peerID3 = 'peer id 3' as PeerID
      const spectatorID = 'spectator id' as UserID

      Engine.instance.store.userID = userId
      const network: Network = NetworkState.worldNetwork

      NetworkPeerFunctions.createPeer(network, peerID, 0, hostUserId, 0)
      NetworkPeerFunctions.createPeer(network, peerID2, 1, userId, 1)
      NetworkPeerFunctions.createPeer(network, peerID3, 2, userId, 2)

      const { rerender, unmount } = render(tag)
      await act(() => rerender(tag))

      dispatchAction(
        SpectateActions.spectateEntity({
          spectatorUserID: spectatorID,
          spectatingEntity: userUuid,
          $topic: NetworkTopics.world,
          $peer: Engine.instance.store.peerID
        })
      )
      applyIncomingActions()
      const before = getState(SpectateEntityState)[spectatorID]
      assert.notEqual(before, undefined, "The spectator's SpectateEntityState should not be undefined after `getState`")
      assert.equal(before.spectating, userId, 'The spectator is not spectating the correct userID')

      dispatchAction(
        SpectateActions.exitSpectate({
          spectatorUserID: spectatorID,
          $topic: NetworkTopics.world,
          $peer: Engine.instance.store.peerID
        })
      )
      applyIncomingActions()
      const after = getState(SpectateEntityState)[spectatorID]
      assert.equal(after, undefined, "The spectator's SpectateEntityState should be undefined after exitSpectate")

      unmount()
    })
  })
})
