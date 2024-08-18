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

import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import '../../engine'

import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { useNetwork } from '@etherealengine/client-core/src/components/World/EngineHooks'
import { LocationService, LocationState } from '@etherealengine/client-core/src/social/services/LocationService'
import { AuthService } from '@etherealengine/client-core/src/user/services/AuthService'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { PresentationSystemGroup } from '@etherealengine/ecs/src/SystemGroups'
import { ECSRecordingActions } from '@etherealengine/engine/src/recording/ECSRecordingSystem'
import { defineActionQueue, useMutableState } from '@etherealengine/hyperflux'
import CaptureUI from '@etherealengine/ui/src/pages/Capture'

import '@etherealengine/client-core/src/world/ClientNetworkModule'

import { getMutableComponent, hasComponent, useQuery } from '@etherealengine/ecs'

import '@etherealengine/engine/src/EngineModule'

import Debug from '@etherealengine/client-core/src/components/Debug'
import { AvatarControllerComponent } from '@etherealengine/engine/src/avatar/components/AvatarControllerComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'

const ecsRecordingErrorActionQueue = defineActionQueue(ECSRecordingActions.error.matches)

const NotifyRecordingErrorSystem = defineSystem({
  uuid: 'notifyRecordingErrorSystem',
  insert: { after: PresentationSystemGroup },
  execute: () => {
    for (const action of ecsRecordingErrorActionQueue()) {
      NotificationService.dispatchNotify(action.error, { variant: 'error' })
    }
  }
})

export const CaptureLocation = () => {
  const locationState = useMutableState(LocationState)

  const params = useParams()

  const locationName = params?.locationName as string | undefined

  useEffect(() => {
    if (locationName) LocationState.setLocationName(locationName)
  }, [])

  useEffect(() => {
    if (locationState.locationName.value) LocationService.getLocationByName(locationState.locationName.value)
  }, [locationState.locationName.value])

  const avatarQuery = useQuery([AvatarControllerComponent, RigidBodyComponent])

  useEffect(() => {
    //removeComponent(avatarQuery[0], AvatarControllerComponent)
    if (hasComponent(avatarQuery[0], RigidBodyComponent))
      getMutableComponent(avatarQuery[0], RigidBodyComponent).type.set('fixed')
  }, [avatarQuery])

  useNetwork({ online: !!locationName })

  AuthService.useAPIListeners()

  return (
    <>
      <CaptureUI />
      <Debug />
    </>
  )
}

export default CaptureLocation
