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

import { Consumer, DataProducer, Producer, TransportInternal, WebRtcTransport } from 'mediasoup/node/lib/types'

import { UserID } from '@etherealengine/common/src/schema.type.module'
import { PeerID, getState } from '@etherealengine/hyperflux'
import { Action, Topic } from '@etherealengine/hyperflux/functions/ActionFunctions'
import { MediaStreamAppData, NetworkState, createNetwork } from '@etherealengine/network'
import { Application } from '@etherealengine/server-core/declarations'
import multiLogger from '@etherealengine/server-core/src/ServerLogger'

import { InstanceID } from '@etherealengine/common/src/schema.type.module'
import { DataChannelRegistryState, DataChannelType, NetworkActionFunctions } from '@etherealengine/network'
import { encode } from 'msgpackr'
import { InstanceServerState } from './InstanceServerState'
import { startWebRTC } from './WebRTCFunctions'

const logger = multiLogger.child({ component: 'instanceserver:webrtc:network' })

export type WebRTCTransportExtension = Omit<WebRtcTransport, 'appData'> & {
  appData: MediaStreamAppData
  internal: TransportInternal
}
export type ProducerExtension = Omit<Producer, 'appData'> & { appData: MediaStreamAppData }
export type ConsumerExtension = Omit<Consumer, 'appData'> & { appData: MediaStreamAppData }

export const initializeNetwork = async (app: Application, id: InstanceID, hostId: UserID, topic: Topic) => {
  const { workers, routers } = await startWebRTC()

  const outgoingDataTransport = await routers[0].createDirectTransport()

  logger.info('Server transport initialized.')

  const transport = {
    messageToPeer: (peerId: PeerID, data: any) => {
      const spark = network.peers[peerId]?.spark
      if (spark) spark.write(data)
    },

    messageToAll: (data: any) => {
      for (const peer of Object.values(network.peers)) peer.spark?.write(data)
    },

    onMessage: (fromPeerID: PeerID, message: any) => {
      const networkPeer = network.peers[fromPeerID]
      if (!networkPeer) return

      networkPeer.lastSeenTs = Date.now()
      if (!message?.length) {
        // logger.info('Got heartbeat from ' + peerID + ' at ' + Date.now())
        return
      }

      const actions = /*decode(new Uint8Array(*/ message /*))*/ as Required<Action>[]
      NetworkActionFunctions.receiveIncomingActions(network, fromPeerID, actions)
    },

    bufferToPeer: (dataChannelType: DataChannelType, fromPeerID: PeerID, toPeerID: PeerID, data: any) => {
      /** @todo - for now just send to everyone */
      network.transport.bufferToAll(dataChannelType, fromPeerID, data)
    },

    bufferToAll: (dataChannelType: DataChannelType, fromPeerID: PeerID, message: any) => {
      const dataProducer = network.transport.outgoingDataProducers[dataChannelType]
      if (!dataProducer) return
      const fromPeerIndex = network.peerIDToPeerIndex[fromPeerID]
      if (typeof fromPeerIndex === 'undefined') return
      dataProducer.send(Buffer.from(new Uint8Array(encode([fromPeerIndex, message]))))
    },

    onBuffer: (dataChannelType: DataChannelType, fromPeerID: PeerID, data: any) => {
      const dataChannelFunctions = getState(DataChannelRegistryState)[dataChannelType]
      if (dataChannelFunctions) {
        for (const func of dataChannelFunctions) func(network, dataChannelType, fromPeerID, data)
      }
    },

    workers,
    routers,
    outgoingDataTransport,
    outgoingDataProducers: {} as Record<DataChannelType, DataProducer>
  }

  const network = createNetwork(id, hostId, topic, transport)

  return network
}

export type SocketWebRTCServerNetwork = Awaited<ReturnType<typeof initializeNetwork>>

export const getServerNetwork = (app: Application) =>
  (getState(InstanceServerState).isMediaInstance
    ? NetworkState.mediaNetwork
    : NetworkState.worldNetwork) as SocketWebRTCServerNetwork
