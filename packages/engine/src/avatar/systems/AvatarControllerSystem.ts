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
  Engine,
  UUIDComponent,
  defineQuery,
  defineSystem,
  getComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  setComponent
} from '@etherealengine/ecs'
import { defineActionQueue, dispatchAction, getState } from '@etherealengine/hyperflux'
import { NetworkObjectAuthorityTag, NetworkState, WorldNetworkAction } from '@etherealengine/network'
import { FollowCameraComponent } from '@etherealengine/spatial/src/camera/components/FollowCameraComponent'
import { TargetCameraRotationComponent } from '@etherealengine/spatial/src/camera/components/TargetCameraRotationComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { XRAction, XRControlsState } from '@etherealengine/spatial/src/xr/XRState'
import { AvatarControllerComponent } from '../components/AvatarControllerComponent'
import { AvatarHeadDecapComponent } from '../components/AvatarIKComponents'
import { respawnAvatar } from '../functions/respawnAvatar'
import { AvatarInputSystem } from './AvatarInputSystem'

const controllerQuery = defineQuery([AvatarControllerComponent])
const sessionChangedActions = defineActionQueue(XRAction.sessionChanged.matches)

const execute = () => {
  for (const action of sessionChangedActions()) {
    if (action.active) {
      for (const avatarEntity of controllerQuery()) {
        const controller = getComponent(avatarEntity, AvatarControllerComponent)
        removeComponent(controller.cameraEntity, FollowCameraComponent)
      }
    } else {
      for (const avatarEntity of controllerQuery()) {
        const controller = getComponent(avatarEntity, AvatarControllerComponent)
        const targetCameraRotation = getComponent(controller.cameraEntity, TargetCameraRotationComponent)
        setComponent(controller.cameraEntity, FollowCameraComponent, {
          targetEntity: avatarEntity,
          phi: targetCameraRotation.phi,
          theta: targetCameraRotation.theta
        })
      }
    }
  }

  for (const avatarEntity of controllerQuery.enter()) {
    const controller = getComponent(avatarEntity, AvatarControllerComponent)

    const targetCameraRotation = getComponent(controller.cameraEntity, TargetCameraRotationComponent)
    setComponent(controller.cameraEntity, FollowCameraComponent, {
      targetEntity: avatarEntity,
      phi: targetCameraRotation.phi,
      theta: targetCameraRotation.theta
    })
  }

  /** @todo non-immersive camera should utilize isCameraAttachedToAvatar */
  if (!getState(XRControlsState).isCameraAttachedToAvatar)
    for (const entity of controllerQuery()) {
      const controller = getComponent(entity, AvatarControllerComponent)
      const followCamera = getOptionalComponent(controller.cameraEntity, FollowCameraComponent)
      if (followCamera) {
        // todo calculate head size and use that as the bound #7263
        if (followCamera.distance < 0.3) setComponent(entity, AvatarHeadDecapComponent, true)
        else removeComponent(entity, AvatarHeadDecapComponent)
      }
    }

  const controlledEntity = Engine.instance.localClientEntity

  if (hasComponent(controlledEntity, AvatarControllerComponent)) {
    const controller = getComponent(controlledEntity, AvatarControllerComponent)

    if (!controller.movementCaptured.length) {
      if (
        !hasComponent(controlledEntity, NetworkObjectAuthorityTag) &&
        NetworkState.worldNetwork &&
        controller.gamepadLocalInput.lengthSq() > 0
      ) {
        dispatchAction(
          WorldNetworkAction.transferAuthorityOfObject({
            ownerID: Engine.instance.userID,
            entityUUID: getComponent(controlledEntity, UUIDComponent),
            newAuthority: Engine.instance.peerID
          })
        )
        setComponent(controlledEntity, NetworkObjectAuthorityTag)
      }
    }

    const rigidbody = getComponent(controlledEntity, RigidBodyComponent)
    if (rigidbody.position.y < -10) respawnAvatar(controlledEntity)
  }
}

export const AvatarControllerSystem = defineSystem({
  uuid: 'ee.engine.AvatarControllerSystem',
  insert: { after: AvatarInputSystem },
  execute
})
