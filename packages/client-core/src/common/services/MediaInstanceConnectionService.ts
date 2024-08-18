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

import { useEffect } from 'react'

import { API } from '@etherealengine/common'
import multiLogger from '@etherealengine/common/src/logger'
import { ChannelID, InstanceID, instanceProvisionPath, RoomCode } from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, getState, Identifiable, State, useState } from '@etherealengine/hyperflux'
import { NetworkState } from '@etherealengine/network'

import { SocketWebRTCClientNetwork } from '../../transports/SocketWebRTCClientFunctions'
import { AuthState } from '../../user/services/AuthService'

const logger = multiLogger.child({ component: 'client-core:service:media-instance' })

type InstanceState = {
  ipAddress: string
  port: string
  channelId: ChannelID
  roomCode: RoomCode
}

//State
export const MediaInstanceState = defineState({
  name: 'MediaInstanceState',
  initial: () => ({
    instances: {} as { [id: InstanceID]: InstanceState }
  })
})

export function useMediaNetwork() {
  const mediaNetworkState = useState(getMutableState(NetworkState).networks)
  const mediaHostId = useState(getMutableState(NetworkState).hostIds.media)
  return mediaHostId.value
    ? (mediaNetworkState[mediaHostId.value] as State<SocketWebRTCClientNetwork, Identifiable>)
    : null
}

export function useMediaInstance() {
  const mediaInstanceState = useState(getMutableState(MediaInstanceState).instances)
  const mediaHostId = useState(getMutableState(NetworkState).hostIds.media)
  return mediaHostId.value ? mediaInstanceState[mediaHostId.value] : null
}

//Service
export const MediaInstanceConnectionService = {
  provisionServer: async (channelID: ChannelID, createPrivateRoom = false) => {
    logger.info(`Provision Media Server, channelId: "${channelID}".`)
    const token = getState(AuthState).authUser.accessToken
    const provisionResult = await API.instance.service(instanceProvisionPath).find({
      query: {
        channelId: channelID,
        token,
        createPrivateRoom
      }
    })
    if (provisionResult.ipAddress && provisionResult.port) {
      getMutableState(MediaInstanceState).instances[provisionResult.id].set({
        ipAddress: provisionResult.ipAddress,
        port: provisionResult.port,
        channelId: channelID,
        roomCode: provisionResult.roomCode
      })
    } else {
      logger.error('Failed to connect to expected instance')
      setTimeout(() => {
        MediaInstanceConnectionService.provisionServer(channelID, createPrivateRoom)
      }, 1000)
    }
  },
  useAPIListeners: () => {
    useEffect(() => {
      const listener = (params) => {
        if (params.channelId != null) {
          getMutableState(MediaInstanceState).instances[params.instanceId].set({
            ipAddress: params.ipAddress,
            port: params.port,
            channelId: params.channelId,
            roomCode: params.roomCode
          })
        }
      }
      API.instance.service(instanceProvisionPath).on('created', listener)
      return () => {
        API.instance.service(instanceProvisionPath).off('created', listener)
      }
    }, [])
  }
}
