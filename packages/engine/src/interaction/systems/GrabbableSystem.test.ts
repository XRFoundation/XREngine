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

import assert, { strictEqual } from 'assert'
import { Quaternion, Vector3 } from 'three'

import { NetworkId } from '@etherealengine/common/src/interfaces/NetworkId'
import { AvatarID, UserID } from '@etherealengine/common/src/schema.type.module'
import { Entity, EntityUUID, UUIDComponent } from '@etherealengine/ecs'
import { getComponent, hasComponent, removeComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Engine, createEngine, destroyEngine } from '@etherealengine/ecs/src/Engine'
import { createEntity } from '@etherealengine/ecs/src/EntityFunctions'
import { PeerID, applyIncomingActions, clearOutgoingActions, dispatchAction } from '@etherealengine/hyperflux'
import { NetworkObjectComponent, NetworkPeerFunctions, NetworkState } from '@etherealengine/network'
import { Physics } from '@etherealengine/spatial/src/physics/classes/Physics'
import { ColliderComponent } from '@etherealengine/spatial/src/physics/components/ColliderComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { BodyTypes, Shapes } from '@etherealengine/spatial/src/physics/types/PhysicsTypes'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'

import { SceneComponent } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { loadEmptyScene } from '../../../tests/util/loadEmptyScene'
import { getHandTarget } from '../../avatar/components/AvatarIKComponents'
import { spawnAvatarReceptor } from '../../avatar/functions/spawnAvatarReceptor'
import { AvatarNetworkAction } from '../../avatar/state/AvatarNetworkActions'
import { GrabbedComponent, GrabberComponent } from '../components/GrabbableComponent'
import { dropEntity, grabEntity } from '../functions/grabbableFunctions'

// @TODO this needs to be re-thought

describe.skip('EquippableSystem Integration Tests', () => {
  let equippableSystem
  let sceneEntity: Entity

  beforeEach(async () => {
    createEngine()
    await Physics.load()

    sceneEntity = loadEmptyScene()
    setComponent(sceneEntity, SceneComponent)
    const physicsWorld = Physics.createWorld(getComponent(sceneEntity, UUIDComponent))
    physicsWorld.timestep = 1 / 60
  })

  afterEach(() => {
    return destroyEngine()
  })

  it('system test', async () => {
    const player = createEntity()
    const item = createEntity()

    setComponent(player, NetworkObjectComponent, {
      ownerId: Engine.instance.userID,
      authorityPeerID: Engine.instance.store.peerID,
      networkId: 0 as NetworkId
    })
    const networkObject = getComponent(player, NetworkObjectComponent)

    dispatchAction(
      AvatarNetworkAction.spawn({
        parentUUID: getComponent(sceneEntity, UUIDComponent),
        networkId: networkObject.networkId,
        position: new Vector3(-0.48624888685311896, 0, -0.12087574159728942),
        rotation: new Quaternion(),
        entityUUID: Engine.instance.userID as string as EntityUUID,
        avatarID: '' as AvatarID,
        name: ''
      })
    )
    applyIncomingActions()

    spawnAvatarReceptor(Engine.instance.userID as string as EntityUUID)

    setComponent(item, GrabbedComponent, {
      grabberEntity: player,
      attachmentPoint: 'none'
    })
    const grabbedComponent = getComponent(player, GrabbedComponent)
    setComponent(player, GrabberComponent, { right: item })

    setComponent(item, TransformComponent)
    const equippableTransform = getComponent(item, TransformComponent)
    const attachmentPoint = grabbedComponent.attachmentPoint
    const { position, rotation } = getHandTarget(item, attachmentPoint)!

    equippableSystem()

    assert(!hasComponent(item, GrabberComponent))

    strictEqual(equippableTransform.position.x, position.x)
    strictEqual(equippableTransform.position.y, position.y)
    strictEqual(equippableTransform.position.z, position.z)

    strictEqual(equippableTransform.rotation.x, rotation.x)
    strictEqual(equippableTransform.rotation.y, rotation.y)
    strictEqual(equippableTransform.rotation.z, rotation.z)
    strictEqual(equippableTransform.rotation.w, rotation.w)

    removeComponent(item, GrabbedComponent)
    equippableSystem()
  })

  it('Can equip and unequip', async () => {
    const hostUserId = 'world' as UserID & PeerID
    NetworkState.worldNetwork.hostPeerID = hostUserId
    const hostIndex = 0

    NetworkPeerFunctions.createPeer(NetworkState.worldNetwork, hostUserId, hostIndex, hostUserId, hostIndex)

    const userId = 'user id' as UserID
    Engine.instance.store.userID = userId

    const grabbableEntity = createEntity()

    setComponent(grabbableEntity, TransformComponent)
    setComponent(grabbableEntity, RigidBodyComponent, { type: BodyTypes.Dynamic })
    setComponent(grabbableEntity, ColliderComponent, { shape: Shapes.Sphere })
    // network mock stuff
    // initially the object is owned by server
    setComponent(grabbableEntity, NetworkObjectComponent, {
      ownerId: NetworkState.worldNetwork.hostUserID,
      authorityPeerID: Engine.instance.store.peerID,
      networkId: 0 as NetworkId
    })

    // Equipper
    const grabberEntity = createEntity()
    setComponent(grabberEntity, TransformComponent)

    grabEntity(grabberEntity, grabbableEntity, 'right')

    // world.receptors.push(
    //     (a) => matches(a).when(WorldNetworkAction.setEquippedObject.matches, setEquippedObjectReceptor)
    // )
    clearOutgoingActions(NetworkState.worldNetwork.topic)
    applyIncomingActions()

    // equipperQueryEnter(grabberEntity)

    // validations for equip
    assert(hasComponent(grabberEntity, GrabberComponent))
    const grabberComponent = getComponent(grabberEntity, GrabberComponent)
    assert.equal(grabbableEntity, grabberComponent.right)
    // assert(hasComponent(grabbableEntity, NetworkObjectAuthorityTag))
    assert(hasComponent(grabbableEntity, GrabbedComponent))

    // unequip stuff
    dropEntity(grabberEntity)

    clearOutgoingActions(NetworkState.worldNetwork.topic)
    applyIncomingActions()

    // validations for unequip
    assert(!hasComponent(grabberEntity, GrabberComponent))
    // assert(!hasComponent(grabbableEntity, NetworkObjectAuthorityTag))
    assert(!hasComponent(grabbableEntity, GrabbedComponent))
  })
})
