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
import { strictEqual } from 'assert'
import React from 'react'
import { Quaternion, Vector3 } from 'three'

import { API } from '@etherealengine/common'
import { AvatarID, UserID } from '@etherealengine/common/src/schema.type.module'
import { Entity, EntityUUID, SystemDefinitions, UUIDComponent } from '@etherealengine/ecs'
import { getComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { Engine, createEngine, destroyEngine } from '@etherealengine/ecs/src/Engine'
import { applyIncomingActions, dispatchAction, getMutableState } from '@etherealengine/hyperflux'
import { Network, NetworkPeerFunctions, NetworkState, NetworkWorldUserStateSystem } from '@etherealengine/network'
import { createMockNetwork } from '@etherealengine/network/tests/createMockNetwork'
import { EventDispatcher } from '@etherealengine/spatial/src/common/classes/EventDispatcher'
import { initializeSpatialEngine } from '@etherealengine/spatial/src/initializeEngine'
import { Physics, PhysicsWorld } from '@etherealengine/spatial/src/physics/classes/Physics'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'

import { SceneComponent } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { loadEmptyScene } from '../../../tests/util/loadEmptyScene'
import { AvatarComponent } from '../components/AvatarComponent'
import { AvatarControllerComponent } from '../components/AvatarControllerComponent'
import { AvatarNetworkAction } from '../state/AvatarNetworkActions'
import { applyGamepadInput } from './moveAvatar'
import { spawnAvatarReceptor } from './spawnAvatarReceptor'

describe('moveAvatar function tests', () => {
  let sceneEntity: Entity
  let physicsWorld: PhysicsWorld
  beforeEach(async () => {
    createEngine()
    initializeSpatialEngine()
    await Physics.load()
    Engine.instance.store.userID = 'userId' as UserID
    sceneEntity = loadEmptyScene()
    setComponent(sceneEntity, SceneComponent)
    physicsWorld = Physics.createWorld(getComponent(sceneEntity, UUIDComponent))
    physicsWorld.timestep = 1 / 60

    createMockNetwork()

    const eventDispatcher = new EventDispatcher()
    ;(API.instance as any) = {
      service: () => {
        return {
          on: (serviceName, cb) => {
            eventDispatcher.addEventListener(serviceName, cb)
          },
          off: (serviceName, cb) => {
            eventDispatcher.removeEventListener(serviceName, cb)
          }
        }
      }
    }
  })

  afterEach(() => {
    return destroyEngine()
  })

  const NetworkWorldUserStateSystemReactor = SystemDefinitions.get(NetworkWorldUserStateSystem)!.reactor!
  const tag = <NetworkWorldUserStateSystemReactor />

  it('should apply world.fixedDelta @ 60 tick to avatar movement, consistent with physics simulation', async () => {
    const ecsState = getMutableState(ECSState)
    ecsState.simulationTimestep.set(1000 / 60)

    const network = NetworkState.worldNetwork as Network
    NetworkPeerFunctions.createPeer(network, Engine.instance.store.peerID, 0, Engine.instance.userID, 0)

    const { rerender, unmount } = render(tag)
    await act(() => rerender(tag))

    dispatchAction(
      AvatarNetworkAction.spawn({
        parentUUID: getComponent(sceneEntity, UUIDComponent),
        position: new Vector3(),
        rotation: new Quaternion(),
        entityUUID: Engine.instance.userID as string as EntityUUID,
        avatarID: '' as AvatarID,
        name: ''
      })
    )

    applyIncomingActions()

    spawnAvatarReceptor(Engine.instance.userID as string as EntityUUID)
    const entity = AvatarComponent.getUserAvatarEntity(Engine.instance.userID)

    const velocity = getComponent(entity, RigidBodyComponent).linearVelocity
    const avatar = getComponent(entity, AvatarControllerComponent)

    avatar.gamepadWorldMovement.setZ(-1)

    // velocity starts at 0
    strictEqual(velocity.x, 0)
    strictEqual(velocity.z, 0)

    /* run */
    applyGamepadInput(entity)

    unmount()
  })

  it('should apply world.fixedDelta @ 120 tick to avatar movement, consistent with physics simulation', async () => {
    const ecsState = getMutableState(ECSState)
    ecsState.simulationTimestep.set(1000 / 60)

    const network = NetworkState.worldNetwork as Network
    NetworkPeerFunctions.createPeer(network, Engine.instance.store.peerID, 0, Engine.instance.userID, 0)

    const { rerender, unmount } = render(tag)
    await act(() => rerender(tag))

    dispatchAction(
      AvatarNetworkAction.spawn({
        parentUUID: getComponent(sceneEntity, UUIDComponent),
        position: new Vector3(),
        rotation: new Quaternion(),
        entityUUID: Engine.instance.userID as string as EntityUUID,
        avatarID: '' as AvatarID,
        name: ''
      })
    )

    applyIncomingActions()

    spawnAvatarReceptor(Engine.instance.userID as string as EntityUUID)
    const entity = AvatarComponent.getUserAvatarEntity(Engine.instance.userID)

    const velocity = getComponent(entity, RigidBodyComponent).linearVelocity

    // velocity starts at 0
    strictEqual(velocity.x, 0)
    strictEqual(velocity.z, 0)

    /* run */
    applyGamepadInput(entity)

    unmount()
  })

  it('should take world.physics.timeScale into account when moving avatars, consistent with physics simulation', async () => {
    Engine.instance.store.userID = 'user' as UserID

    const ecsState = getMutableState(ECSState)
    ecsState.simulationTimestep.set(1000 / 60)

    const network = NetworkState.worldNetwork as Network
    NetworkPeerFunctions.createPeer(network, Engine.instance.store.peerID, 0, Engine.instance.userID, 0)

    const { rerender, unmount } = render(tag)
    await act(() => rerender(tag))

    /* mock */
    physicsWorld.timestep = 1 / 2

    dispatchAction(
      AvatarNetworkAction.spawn({
        parentUUID: getComponent(sceneEntity, UUIDComponent),
        position: new Vector3(),
        rotation: new Quaternion(),
        entityUUID: Engine.instance.userID as string as EntityUUID,
        avatarID: '' as AvatarID,
        name: ''
      })
    )

    applyIncomingActions()

    spawnAvatarReceptor(Engine.instance.userID as string as EntityUUID)
    const entity = AvatarComponent.getUserAvatarEntity(Engine.instance.userID)

    const velocity = getComponent(entity, RigidBodyComponent).linearVelocity

    // velocity starts at 0
    strictEqual(velocity.x, 0)
    strictEqual(velocity.z, 0)

    /* run */
    applyGamepadInput(entity)

    unmount()
  })

  it('should not allow velocity to breach a full unit through multiple frames', async () => {
    Engine.instance.store.userID = 'user' as UserID

    const ecsState = getMutableState(ECSState)
    ecsState.simulationTimestep.set(1000 / 60)

    const network = NetworkState.worldNetwork as Network
    NetworkPeerFunctions.createPeer(network, Engine.instance.store.peerID, 0, Engine.instance.userID, 0)

    const { rerender, unmount } = render(tag)
    await act(() => rerender(tag))

    dispatchAction(
      AvatarNetworkAction.spawn({
        parentUUID: getComponent(sceneEntity, UUIDComponent),
        position: new Vector3(),
        rotation: new Quaternion(),
        entityUUID: Engine.instance.userID as string as EntityUUID,
        avatarID: '' as AvatarID,
        name: ''
      })
    )

    applyIncomingActions()

    spawnAvatarReceptor(Engine.instance.userID as string as EntityUUID)
    const entity = AvatarComponent.getUserAvatarEntity(Engine.instance.userID)

    const velocity = getComponent(entity, RigidBodyComponent).linearVelocity

    // velocity starts at 0
    strictEqual(velocity.x, 0)
    strictEqual(velocity.z, 0)

    /* run */
    applyGamepadInput(entity)

    physicsWorld.step()
    applyGamepadInput(entity)
    physicsWorld.step()
    applyGamepadInput(entity)
    physicsWorld.step()
    applyGamepadInput(entity)
    physicsWorld.step()
    applyGamepadInput(entity)
    physicsWorld.step()
    applyGamepadInput(entity)

    unmount()
  })
})
