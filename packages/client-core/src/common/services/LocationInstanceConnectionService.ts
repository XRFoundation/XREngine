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

import { Paginated } from '@feathersjs/feathers'
import { useEffect } from 'react'

import { API } from '@etherealengine/common'
import logger from '@etherealengine/common/src/logger'
import {
  InstanceID,
  instancePath,
  instanceProvisionPath,
  InstanceType,
  LocationID,
  RoomCode
} from '@etherealengine/common/src/schema.type.module'
import { defineState, getMutableState, getState, Identifiable, State, useState } from '@etherealengine/hyperflux'
import { NetworkState } from '@etherealengine/network'

import { SocketWebRTCClientNetwork } from '../../transports/SocketWebRTCClientFunctions'
import { AuthState } from '../../user/services/AuthService'

export type InstanceState = {
  ipAddress: string
  port: string
  locationId?: LocationID
  sceneId?: string
  roomCode: RoomCode
}

//State
export const LocationInstanceState = defineState({
  name: 'LocationInstanceState',
  initial: () => ({
    instances: {} as { [id: InstanceID]: InstanceState }
  })
})

export function useWorldNetwork() {
  const worldNetworkState = useState(getMutableState(NetworkState).networks)
  const worldHostId = useState(getMutableState(NetworkState).hostIds.world)
  return worldHostId.value
    ? (worldNetworkState[worldHostId.value] as State<SocketWebRTCClientNetwork, Identifiable>)
    : null
}

export function useWorldInstance() {
  const worldInstanceState = useState(getMutableState(LocationInstanceState).instances)
  const worldHostId = useState(getMutableState(NetworkState).hostIds.world)
  return worldHostId.value ? worldInstanceState[worldHostId.value] : null
}

//Service
export const LocationInstanceConnectionService = {
  provisionServer: async (
    locationId?: LocationID,
    instanceId?: InstanceID,
    sceneId?: string,
    roomCode?: RoomCode,
    createPrivateRoom?: boolean
  ) => {
    logger.info({ locationId, instanceId, sceneId }, 'Provision World Server')
    const token = getState(AuthState).authUser.accessToken
    if (instanceId != null) {
      const instance = (await API.instance.service(instancePath).find({
        query: {
          id: instanceId,
          ended: false
        }
      })) as Paginated<InstanceType>
      if (instance.total === 0) {
        instanceId = null!
      }
    }
    const provisionResult = await API.instance.service(instanceProvisionPath).find({
      query: {
        locationId,
        instanceId,
        sceneId,
        roomCode,
        token,
        createPrivateRoom
      }
    })
    if (provisionResult.ipAddress && provisionResult.port) {
      getMutableState(LocationInstanceState).instances.merge({
        [provisionResult.id]: {
          ipAddress: provisionResult.ipAddress,
          port: provisionResult.port,
          locationId: locationId!,
          sceneId: sceneId!,
          roomCode: provisionResult.roomCode as RoomCode
        }
      } as Partial<{ [id: InstanceID]: InstanceState }>)
    } else {
      logger.error('Failed to connect to expected instance')
      setTimeout(() => {
        LocationInstanceConnectionService.provisionServer(locationId, instanceId, sceneId, roomCode, createPrivateRoom)
      }, 1000)
    }
  },
  provisionExistingServer: async (locationId: LocationID, instanceId: InstanceID, sceneId: string) => {
    logger.info({ locationId, instanceId, sceneId }, 'Provision Existing World Server')
    const token = getState(AuthState).authUser.accessToken
    const instance = (await API.instance.service(instancePath).find({
      query: {
        id: instanceId,
        ended: false
      }
    })) as Paginated<InstanceType>
    if (instance.total === 0) {
      const parsed = new URL(window.location.href)
      const query = parsed.searchParams
      query.delete('instanceId')
      parsed.search = query.toString()
      if (typeof history.pushState !== 'undefined') {
        window.history.replaceState({}, '', parsed.toString())
      }
      return
    }
    const provisionResult = await API.instance.service(instanceProvisionPath).find({
      query: {
        locationId,
        instanceId,
        sceneId,
        token
      }
    })
    if (provisionResult.ipAddress && provisionResult.port) {
      getMutableState(LocationInstanceState).instances.merge({
        [provisionResult.id]: {
          ipAddress: provisionResult.ipAddress,
          port: provisionResult.port,
          locationId: locationId!,
          sceneId: sceneId!,
          roomCode: provisionResult.roomCode as RoomCode
        }
      } as Partial<{ [id: InstanceID]: InstanceState }>)
    } else {
      console.warn('Failed to connect to expected existing instance')
    }
  },
  provisionExistingServerByRoomCode: async (locationId: LocationID, roomCode: RoomCode, sceneId: string) => {
    logger.info({ locationId, roomCode, sceneId }, 'Provision Existing World Server')
    const token = getState(AuthState).authUser.accessToken
    const instance = (await API.instance.service(instancePath).find({
      query: {
        roomCode,
        ended: false
      }
    })) as Paginated<InstanceType>
    if (instance.total === 0) {
      const parsed = new URL(window.location.href)
      const query = parsed.searchParams
      query.delete('roomCode')
      parsed.search = query.toString()
      if (typeof history.pushState !== 'undefined') {
        window.history.replaceState({}, '', parsed.toString())
      }
      return
    }
    const provisionResult = await API.instance.service(instanceProvisionPath).find({
      query: {
        locationId,
        roomCode,
        instanceId: instance.data[0].id,
        sceneId,
        token
      }
    })
    if (provisionResult.ipAddress && provisionResult.port) {
      getMutableState(LocationInstanceState).instances.merge({
        [provisionResult.id]: {
          ipAddress: provisionResult.ipAddress,
          port: provisionResult.port,
          locationId: locationId!,
          sceneId: sceneId!,
          roomCode: provisionResult.roomCode
        }
      } as Partial<{ [id: InstanceID]: InstanceState }>)
    } else {
      console.warn('Failed to connect to expected existing instance')
    }
  },
  useAPIListeners: () => {
    useEffect(() => {
      const instanceProvisionCreatedListener = (params) => {
        if (params.locationId != null)
          getMutableState(LocationInstanceState).instances.merge({
            [params.instanceId]: {
              ipAddress: params.ipAddress,
              port: params.port,
              locationId: params.locationId,
              sceneId: params.sceneId,
              roomCode: params.roomCode
            }
          })
      }

      API.instance.service(instanceProvisionPath).on('created', instanceProvisionCreatedListener)

      return () => {
        API.instance.service(instanceProvisionPath).off('created', instanceProvisionCreatedListener)
      }
    }, [])
  }
}
