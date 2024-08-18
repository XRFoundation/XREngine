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
  InstanceState,
  LocationInstanceState
} from '@etherealengine/client-core/src/common/services/LocationInstanceConnectionService'
import { AuthState } from '@etherealengine/client-core/src/user/services/AuthService'
import { API } from '@etherealengine/common'
import logger from '@etherealengine/common/src/logger'
import {
  InstanceActiveType,
  InstanceID,
  LocationID,
  instanceActivePath,
  instanceProvisionPath
} from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, getState } from '@etherealengine/hyperflux'

export const EditorActiveInstanceState = defineState({
  name: 'EditorActiveInstanceState',
  initial: () => ({
    activeInstances: [] as InstanceActiveType[],
    fetching: false
  }),

  provisionServer: async (locationId: LocationID, instanceId: InstanceID, sceneId: string) => {
    logger.info({ locationId, instanceId, sceneId }, 'Provision World Server Editor')
    const token = getState(AuthState).authUser.accessToken
    const provisionResult = await API.instance.service(instanceProvisionPath).find({
      query: {
        locationId: locationId,
        instanceId: instanceId,
        sceneId: sceneId,
        token: token
      }
    })
    if (provisionResult.ipAddress && provisionResult.port) {
      getMutableState(LocationInstanceState).instances.merge({
        [provisionResult.id]: {
          ipAddress: provisionResult.ipAddress,
          port: provisionResult.port,
          locationId: locationId,
          sceneId: sceneId,
          roomCode: provisionResult.roomCode
        }
      } as Partial<{ [id: InstanceID]: InstanceState }>)
    }
  },

  getActiveInstances: async (sceneId: string) => {
    getMutableState(EditorActiveInstanceState).merge({ fetching: true })
    const activeInstances = await API.instance.service(instanceActivePath).find({
      query: { sceneId }
    })
    getMutableState(EditorActiveInstanceState).merge({ activeInstances, fetching: false })
  }
})
