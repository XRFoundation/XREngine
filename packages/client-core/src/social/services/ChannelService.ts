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
import {
  ChannelID,
  channelPath,
  ChannelType,
  channelUserPath,
  ChannelUserType,
  InstanceID,
  UserID
} from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { defineState, getMutableState, none } from '@etherealengine/hyperflux'
import { NetworkState } from '@etherealengine/network'

import { NotificationService } from '../../common/services/NotificationService'
import { leaveNetwork, SocketWebRTCClientNetwork } from '../../transports/SocketWebRTCClientFunctions'

export const ChannelState = defineState({
  name: 'ChannelState',
  initial: () => ({
    channels: {
      channels: [] as ChannelType[],
      limit: 5,
      skip: 0,
      total: 0
    },
    /** This channel ID is used to connect to a media server. Setting it will automatically connect. */
    targetChannelId: '' as ChannelID,
    instanceChannelFetching: false,
    instanceChannelFetched: false,
    messageCreated: false
  }),
  onCreate: (store, state) => {
    // syncStateWithLocalStorage(ChannelState, ['targetChannelId'])
  }
})

export const ChannelService = {
  getChannels: async () => {
    try {
      const channelResult = (await API.instance
        .service(channelPath)
        .find({ query: { paginate: false } })) as any as ChannelType[]
      const channelState = getMutableState(ChannelState)
      channelState.channels.merge({
        channels: channelResult
      })
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  leaveInstanceChannel: async () => {
    getMutableState(ChannelState).merge({
      channels: {
        channels: [] as ChannelType[],
        limit: 5,
        skip: 0,
        total: 0
      },
      targetChannelId: '' as ChannelID,
      instanceChannelFetching: false,
      instanceChannelFetched: false,
      messageCreated: false
    })
  },
  getInstanceChannel: async (instanceID: InstanceID) => {
    try {
      const channelResult = (await API.instance.service(channelPath).find({
        query: {
          instanceId: instanceID,
          paginate: false
        }
      })) as any as ChannelType[]
      if (channelResult.length === 0) return setTimeout(() => ChannelService.getInstanceChannel(instanceID), 2000)

      const channel = channelResult[0]

      const channelState = getMutableState(ChannelState)
      let findIndex
      if (typeof channel.id === 'string')
        findIndex = channelState.channels.channels.findIndex((c) => c.id.value === channel.id)
      const idx = findIndex > -1 ? findIndex : channelState.channels.channels.length
      channelState.channels.channels[idx].set(channel)
      const endedInstanceChannelIndex = channelState.channels.channels.findIndex(
        (_channel) => channel.id !== _channel.id.value
      )
      if (endedInstanceChannelIndex > -1) channelState.channels.channels[endedInstanceChannelIndex].set(none)
      channelState.merge({
        instanceChannelFetched: true,
        instanceChannelFetching: false,
        targetChannelId: channel.id,
        messageCreated: true
      })
      channelState.merge({ messageCreated: true })
    } catch (err) {
      console.error(err)
      //Occasionally, the client attempts to fetch the instance's channel after it's been created, but before the user's
      //channel-user has been created, which occurs when connecting to the instance server.
      //If it's a 403, it is almost definitely because of this issue, so just wait a second and try again.
      //The second part of the if condition is to handle the scenario when its channel resolver calling message service.
      if (err.code == 403 || (err.data && err.data.length > 0 && err.data[0].data?.code === 403)) {
        return setTimeout(() => ChannelService.getInstanceChannel(instanceID), 1000)
      }
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  createChannel: async (users: UserID[]) => {
    try {
      const channel = await API.instance.service(channelPath).create({
        users
      })
      await ChannelService.getChannels()
      return channel
    } catch (err) {
      console.error(err)
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  joinChannelInstance: (channelID: ChannelID) => {
    getMutableState(ChannelState).targetChannelId.set(channelID)
    if (channelID === '' && NetworkState.worldNetwork) {
      ChannelService.getInstanceChannel(NetworkState.worldNetwork.id)
    } else {
      getMutableState(ChannelState).targetChannelId.set(channelID)
    }
    const network = NetworkState.mediaNetwork as SocketWebRTCClientNetwork
    if (!network) return
    /** @todo reassess if this is necessary */
    leaveNetwork(network)
  },
  removeUserFromChannel: async (channelId: ChannelID, userId: UserID) => {
    try {
      await API.instance.service(channelUserPath).remove(null, {
        query: {
          channelId,
          userId
        }
      })
      await ChannelService.getChannels()
    } catch (err) {
      console.log(err)
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  removeChannel: async (channelId: ChannelID) => {
    try {
      await API.instance.service(channelPath).remove(channelId)
      await ChannelService.getChannels()
    } catch (err) {
      NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },
  clearChatTargetIfCurrent: (targetChannelId: ChannelID) => {
    getMutableState(ChannelState).targetChannelId.set(targetChannelId)
  },
  useAPIListeners: () => {
    useEffect(() => {
      const channelCreatedListener = (params: ChannelType) => {
        const channelState = getMutableState(ChannelState)
        const channelId = params.id
        const channel = channelState.channels.channels.find((c) => c.id.value === channelId)

        if (channel) {
          channel.merge(params)
        } else {
          channelState.channels.channels[channelState.channels.channels.length].set(params)
        }
      }

      const channelPatchedListener = (params: ChannelType) => {
        const channelState = getMutableState(ChannelState)
        const channelId = params.id
        const channel = channelState.channels.channels.find((c) => c.id.value === channelId)

        if (channel) {
          channel.merge(params)
        } else {
          channelState.channels.channels[channelState.channels.channels.length].set(params)
        }
        channelState.merge({ messageCreated: false })
      }

      const channelRemovedListener = (params: ChannelType) => {
        const channelState = getMutableState(ChannelState)
        const channelId = params.id
        const channelIdx = channelState.channels.channels.findIndex((c) => c.id.value === channelId)
        if (channelIdx > -1) {
          channelState.channels.channels[channelIdx].set(none)
        }
      }

      const channelUserRemovedListener = (params: ChannelUserType) => {
        ChannelService.getChannels()
        const channelState = getMutableState(ChannelState)
        if (params.userId === Engine.instance.userID && params.channelId === channelState.targetChannelId.value) {
          channelState.targetChannelId.set('' as ChannelID)
          ChannelService.getInstanceChannel(NetworkState.worldNetwork.id)
        }
      }

      API.instance.service(channelPath).on('created', channelCreatedListener)
      API.instance.service(channelPath).on('patched', channelPatchedListener)
      API.instance.service(channelPath).on('removed', channelRemovedListener)
      API.instance.service(channelUserPath).on('removed', channelUserRemovedListener)

      return () => {
        API.instance.service(channelPath).off('created', channelCreatedListener)
        API.instance.service(channelPath).off('patched', channelPatchedListener)
        API.instance.service(channelPath).off('removed', channelRemovedListener)
        API.instance.service(channelUserPath).off('removed', channelUserRemovedListener)
      }
    }, [])
  }
}
