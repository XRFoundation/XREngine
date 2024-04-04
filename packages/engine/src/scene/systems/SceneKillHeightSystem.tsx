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

import {
  SimulationSystemGroup,
  UUIDComponent,
  defineQuery,
  defineSystem,
  getComponent,
  setComponent
} from '@etherealengine/ecs'
import { getState } from '@etherealengine/hyperflux'
import { NetworkObjectAuthorityTag } from '@etherealengine/network'
import { SpawnPoseState, TransformComponent } from '@etherealengine/spatial'
import {
  RigidBodyComponent,
  RigidBodyFixedTagComponent
} from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { PhysicsState } from '@etherealengine/spatial/src/physics/state/PhysicsState'
import { XRControlsState } from '@etherealengine/spatial/src/xr/XRState'
import { Not } from 'bitecs'
import { Vector3 } from 'three'
import { updateReferenceSpaceFromAvatarMovement } from '../../avatar/functions/moveAvatar'
import { SceneSettingsComponent } from '../components/SceneSettingsComponent'

const heightKillApplicableQuery = defineQuery([
  RigidBodyComponent,
  NetworkObjectAuthorityTag,
  Not(RigidBodyFixedTagComponent)
])

const settingsQuery = defineQuery([SceneSettingsComponent])
const tempVector = new Vector3()

const execute = () => {
  const settingsEntities = settingsQuery()
  const sceneKillHeight = settingsEntities.reduce((min, entity) => {
    return Math.min(min, getComponent(entity, SceneSettingsComponent).sceneKillHeight)
  }, Number.MAX_VALUE)
  const killableEntities = heightKillApplicableQuery()

  for (const entity of killableEntities) {
    const rigidBodyPosition = getComponent(entity, RigidBodyComponent).position
    if (rigidBodyPosition.y < sceneKillHeight) {
      const uuid = getComponent(entity, UUIDComponent)
      const spawnState = getState(SpawnPoseState)[uuid]

      // reset entity to it's spawn position
      setComponent(entity, TransformComponent, {
        position: spawnState?.spawnPosition,
        rotation: spawnState?.spawnRotation
      })
      TransformComponent.dirtyTransforms[entity] = true

      const { cameraAttachedRigidbodyEntity } = getState(PhysicsState)
      if (entity !== cameraAttachedRigidbodyEntity) continue

      const { isCameraAttachedToAvatar } = getState(XRControlsState)
      if (!isCameraAttachedToAvatar) continue

      //@TODO see if we can implicitly update the reference space when the avatar teleports
      updateReferenceSpaceFromAvatarMovement(
        entity,
        tempVector.subVectors(spawnState?.spawnPosition, rigidBodyPosition)
      )
    }
  }
}

export const SceneKillHeightSystem = defineSystem({
  uuid: 'ee.engine.SceneKillHeightSystem',
  insert: { before: SimulationSystemGroup },
  execute
})
