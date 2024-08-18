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

import assert from 'assert'

import { NetworkId } from '@etherealengine/common/src/interfaces/NetworkId'
import { InstanceID, UserID } from '@etherealengine/common/src/schema.type.module'
import { EntityUUID, UUIDComponent, getComponent } from '@etherealengine/ecs'
import { Engine, createEngine, destroyEngine } from '@etherealengine/ecs/src/Engine'
import { PeerID, applyIncomingActions, dispatchAction, getMutableState } from '@etherealengine/hyperflux'
import { initializeSpatialEngine } from '@etherealengine/spatial/src/initializeEngine'

import { SpawnObjectActions } from '../../../spatial/src/transform/SpawnObjectActions'
import { createMockNetwork } from '../../tests/createMockNetwork'
import { Network } from '../Network'
import { NetworkObjectComponent } from '../NetworkObjectComponent'
import { NetworkState } from '../NetworkState'
import { NetworkPeerFunctions } from './NetworkPeerFunctions'

describe('NetworkPeerFunctions', () => {
  beforeEach(() => {
    createEngine()
    createMockNetwork()
    Engine.instance.store.defaultDispatchDelay = () => 0
    initializeSpatialEngine()
  })

  afterEach(() => {
    return destroyEngine()
  })

  describe('addPeers', () => {
    it('should add peer', () => {
      const userId = 'user id' as UserID
      const peerID = Engine.instance.store.peerID
      Engine.instance.store.userID = 'another user id' as UserID

      const userIndex = 1
      const peerIndex = 2
      const network = NetworkState.worldNetwork as Network

      NetworkPeerFunctions.createPeer(network, peerID, peerIndex, userId, userIndex)

      assert(network.peers[peerID])
      assert.equal(network.peers[peerID]?.userId, userId)
      assert.equal(network.peers[peerID]?.userIndex, userIndex)
      assert.equal(network.peers[peerID]?.peerID, peerID)
      assert.equal(network.peers[peerID]?.peerIndex, peerIndex)
      assert.equal(network.userIndexToUserID[userIndex], userId)
      assert.equal(network.userIDToUserIndex[userId], userIndex)
      assert.equal(network.peerIndexToPeerID[peerIndex], peerID)
      assert.equal(network.peerIDToPeerIndex[peerID], peerIndex)
    })

    it('should update peer if it already exists', () => {
      const userId = 'user id' as UserID
      const peerID = Engine.instance.store.peerID
      Engine.instance.store.userID = 'another user id' as UserID

      const userIndex = 1
      const userIndex2 = 2
      const peerIndex = 3
      const peerIndex2 = 4
      const network = NetworkState.worldNetwork as Network

      NetworkPeerFunctions.createPeer(network, peerID, peerIndex, userId, userIndex)
      assert.equal(network.peers[peerID]!.userId, userId)
      assert.equal(network.peers[peerID]!.userIndex, userIndex)
      assert.equal(network.peers[peerID]!.peerID, peerID)
      assert.equal(network.peers[peerID]!.peerIndex, peerIndex)

      NetworkPeerFunctions.createPeer(network, peerID, peerIndex2, userId, userIndex2)
      assert.equal(network.peers[peerID]!.userId, userId)
      assert.equal(network.peers[peerID]!.userIndex, userIndex2)
      assert.equal(network.peers[peerID]!.peerID, peerID)
      assert.equal(network.peers[peerID]!.peerIndex, peerIndex2)
    })
  })

  describe('removePeer', () => {
    it('should remove peer', () => {
      const userId = 'user id' as UserID
      const peerID = 'peer id' as PeerID
      Engine.instance.store.userID = 'another user id' as UserID
      const userIndex = 1
      const peerIndex = 2
      const network = NetworkState.worldNetwork as Network

      NetworkPeerFunctions.createPeer(network, peerID, peerIndex, userId, userIndex)
      NetworkPeerFunctions.destroyPeer(network, peerID)

      assert(!network.peers[peerID])

      assert.equal(network.userIndexToUserID[userIndex], undefined)
      assert.equal(network.userIDToUserIndex[userId], undefined)
      assert.equal(network.peerIndexToPeerID[peerIndex], undefined)
      assert.equal(network.peerIDToPeerIndex[peerID], undefined)
    })

    it('should not remove self peer', () => {
      const userId = 'user id' as UserID
      const peerID = Engine.instance.store.peerID
      Engine.instance.store.userID = 'another user id' as UserID

      const userIndex = 1
      const peerIndex = 2
      const network = NetworkState.worldNetwork as Network

      NetworkPeerFunctions.createPeer(network, peerID, peerIndex, userId, userIndex)
      NetworkPeerFunctions.destroyPeer(network, peerID)

      assert(network.peers[peerID])

      assert.equal(network.userIndexToUserID[userIndex], userId)
      assert.equal(network.userIDToUserIndex[userId], userIndex)
      assert.equal(network.peerIndexToPeerID[peerIndex], peerID)
      assert.equal(network.peerIDToPeerIndex[peerID], peerIndex)
    })

    it('should remove peer and owned network objects', async () => {
      const userId = 'world' as UserID & InstanceID
      const anotherPeerID = 'another peer id' as PeerID
      Engine.instance.store.userID = 'another user id' as UserID
      const userIndex = 1
      const peerIndex = 5
      const network = NetworkState.worldNetwork as Network
      network.hostPeerID = Engine.instance.store.peerID
      getMutableState(NetworkState).hostIds.world.set(userId)

      NetworkPeerFunctions.createPeer(network, anotherPeerID, peerIndex, userId, userIndex)
      const networkId = 2 as NetworkId

      dispatchAction(
        SpawnObjectActions.spawnObject({
          parentUUID: getComponent(Engine.instance.originEntity, UUIDComponent),
          ownerID: userId, // from  user
          networkId: networkId,
          $peer: anotherPeerID,
          entityUUID: 'some uuid' as EntityUUID
        })
      )

      applyIncomingActions()

      // process remove actions and execute entity removal
      Engine.instance.store.defaultDispatchDelay = () => 0
      NetworkPeerFunctions.destroyPeer(network, anotherPeerID)

      applyIncomingActions()

      assert(!NetworkObjectComponent.getNetworkObject(userId, networkId))
    })
  })
})
