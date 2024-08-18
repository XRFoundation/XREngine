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

import { decode, encode } from 'msgpackr'
import { PassThrough } from 'stream'
import matches, { Validator } from 'ts-matches'

import { API } from '@etherealengine/common'
import multiLogger from '@etherealengine/common/src/logger'
import {
  RecordingID,
  recordingPath,
  RecordingSchemaType,
  UserID,
  userPath
} from '@etherealengine/common/src/schema.type.module'
import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import {
  defineSystem,
  ECSState,
  Engine,
  EntityUUID,
  getComponent,
  PresentationSystemGroup,
  UUIDComponent
} from '@etherealengine/ecs'
import { AvatarNetworkAction } from '@etherealengine/engine/src/avatar/state/AvatarNetworkActions'
import {
  ECSDeserializer,
  ECSSerialization,
  ECSSerializer,
  SerializedChunk
} from '@etherealengine/engine/src/recording/ECSSerializerSystem'
import {
  defineAction,
  defineActionQueue,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  PeerID,
  Topic
} from '@etherealengine/hyperflux'
import {
  addDataChannelHandler,
  DataChannelRegistryState,
  DataChannelType,
  matchesUserID,
  Network,
  NetworkPeerFunctions,
  NetworkState,
  NetworkTopics,
  removeDataChannelHandler,
  SerializationSchema,
  updatePeers,
  webcamAudioDataChannelType,
  webcamVideoDataChannelType,
  WorldNetworkAction
} from '@etherealengine/network'
import { checkScope } from '@etherealengine/spatial/src/common/functions/checkScope'
import { PhysicsSerialization } from '@etherealengine/spatial/src/physics/PhysicsSerialization'

import { AvatarComponent } from '../avatar/components/AvatarComponent'
import { mocapDataChannelType } from '../mocap/MotionCaptureSystem'

const logger = multiLogger.child({ component: 'engine:recording' })

export class ECSRecordingActions {
  static startRecording = defineAction({
    type: 'ee.core.motioncapture.START_RECORDING' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>
  })

  static recordingStarted = defineAction({
    type: 'ee.core.motioncapture.RECORDING_STARTED' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>
  })

  static stopRecording = defineAction({
    type: 'ee.core.motioncapture.STOP_RECORDING' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>
  })

  static startPlayback = defineAction({
    type: 'ee.core.motioncapture.PLAY_RECORDING' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>,
    targetUser: matchesUserID.optional(),
    autoplay: matches.boolean
  })

  static playbackChanged = defineAction({
    type: 'ee.core.motioncapture.PLAYBACK_CHANGED' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>,
    playing: matches.boolean
  })

  static stopPlayback = defineAction({
    type: 'ee.core.motioncapture.STOP_PLAYBACK' as const,
    recordingID: matches.string as Validator<unknown, RecordingID>
  })

  static error = defineAction({
    type: 'ee.core.motioncapture.ERROR' as const,
    error: matches.string
  })
}

export type RecordingConfigSchema = {
  user: {
    Avatar: boolean
  }
  peers: Record<PeerID, { Audio: boolean; Video: boolean; Mocap: boolean }>
}

export const RecordingState = defineState({
  name: 'ee.RecordingState',

  /** @todo - support multiple recording */
  initial: {
    active: false,
    startedAt: null as number | null,
    recordingID: null as RecordingID | null
  },

  receptors: {
    onStartRecording: ECSRecordingActions.startRecording.receive((action) => {
      const state = getMutableState(RecordingState)
      state.active.set(true)
      state.startedAt.set(null)
      state.recordingID.set(null)
    }),
    onRecordingStarted: ECSRecordingActions.recordingStarted.receive((action) => {
      const state = getMutableState(RecordingState)
      state.startedAt.set(Date.now())
      state.recordingID.set(action.recordingID)
    }),
    onStopRecording: ECSRecordingActions.stopRecording.receive((action) => {
      const state = getMutableState(RecordingState)
      state.active.set(false)
      state.startedAt.set(null)
      state.recordingID.set(null)
    }),
    onError: ECSRecordingActions.error.receive((action) => {
      const state = getMutableState(RecordingState)
      state.active.set(false)
      state.startedAt.set(null)
      state.recordingID.set(null)
    })
  },

  requestRecording: async (peerSchema: RecordingConfigSchema) => {
    try {
      const userSchema = [] as string[]
      if (peerSchema.user.Avatar) userSchema.push(PhysicsSerialization.ID)

      const schema = {
        user: userSchema,
        peers: {}
      } as RecordingSchemaType

      if (peerSchema.user.Avatar) schema

      Object.entries(peerSchema.peers).forEach(([peerID, value]) => {
        const peerSchema = [] as string[]
        if (value.Mocap) peerSchema.push(mocapDataChannelType)
        if (value.Video) peerSchema.push(webcamVideoDataChannelType)
        if (value.Audio) peerSchema.push(webcamAudioDataChannelType)
        if (peerSchema.length) schema.peers[peerID] = peerSchema
      })

      const recording = await API.instance.service(recordingPath).create({ schema: schema })

      if (recording.id) RecordingState.startRecording({ recordingID: recording.id })
    } catch (err) {
      console.error(err)
      // NotificationService.dispatchNotify(err.message, { variant: 'error' })
    }
  },

  startRecording(args: { recordingID: RecordingID }) {
    const { recordingID } = args
    const action = ECSRecordingActions.startRecording({
      recordingID
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.world,
      $to: NetworkState.worldNetwork.hostPeerID
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.media,
      $to: NetworkState.mediaNetwork.hostPeerID
    })
  },

  stopRecording(args: { recordingID: RecordingID }) {
    const recording = ECSRecordingActions.stopRecording({
      recordingID: args.recordingID
    })
    dispatchAction({
      ...recording,
      $topic: NetworkTopics.world,
      $to: NetworkState.worldNetwork.hostPeerID
    })
    // todo - check that video actually needs to be stopped
    dispatchAction({
      ...recording,
      $topic: NetworkTopics.media,
      $to: NetworkState.mediaNetwork.hostPeerID
    })
  }
})

export const PlaybackState = defineState({
  name: 'ee.PlaybackState',

  /** @todo - support multiple playback */
  initial: {
    recordingID: null as RecordingID | null,
    playing: false,
    currentTime: null as number | null
  },

  receptors: {
    onPlaybackChanged: ECSRecordingActions.playbackChanged.receive((action) => {
      const state = getMutableState(PlaybackState)
      state.playing.set(action.playing)
      state.recordingID.set(action.playing ? action.recordingID : null)
      state.currentTime.set(action.playing ? 0 : null)
    })
  },

  startPlaybackOnServer(args: { recordingID: RecordingID; targetUser?: UserID }) {
    const { recordingID, targetUser } = args
    const action = ECSRecordingActions.startPlayback({
      recordingID,
      targetUser,
      autoplay: false
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.world,
      $to: NetworkState.worldNetwork.hostPeerID
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.media,
      $to: NetworkState.mediaNetwork.hostPeerID
    })
  },

  stopPlaybackOnServer(args: { recordingID: RecordingID }) {
    const { recordingID } = args
    const action = ECSRecordingActions.stopPlayback({
      recordingID
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.world,
      $to: NetworkState.worldNetwork.hostPeerID
    })

    dispatchAction({
      ...action,
      $topic: NetworkTopics.media,
      $to: NetworkState.mediaNetwork.hostPeerID
    })
  }
})

interface ActiveRecording {
  userID: UserID
  serializer?: ECSSerializer
  dataChannelRecorder?: any // todo
  mediaChannelRecorder?: Awaited<ReturnType<MediaChannelRecorderType>>
}

interface ActivePlayback {
  userID: UserID
  deserializer?: ECSDeserializer
  entityChunks: SerializedChunk[]
  dataChannelChunks: Map<DataChannelType, DataChannelFrames<any>>
  startTime: number
  endTime: number
  durationSeconds: number
  entitiesSpawned: (EntityUUID | UserID)[]
  peerIDs?: PeerID[]
  mediaPlayback?: any // todo
}

export interface DataChannelFrames<T> {
  frames: {
    data: T
    timecode: number
  }[]
  fromPeerID: PeerID
}

export type MediaChannelRecorderType = (
  recordingID: RecordingID,
  schema: RecordingSchemaType['peers']
) => Promise<{
  recordings: Array<{
    stopRecording: () => void
    stream: PassThrough
    peerID: PeerID
    mediaType: 'webcam' | 'screenshare'
    format: string
  }>
  activeUploads: any[]
}>

export type UploadRecordingChunkType = (args: {
  recordingID: RecordingID
  key: string
  body: Buffer
  mimeType: string
}) => Promise<void>

export const RecordingAPIState = defineState({
  name: 'ee.engine.recording.RecordingAPIState',
  initial: {
    createMediaChannelRecorder: null as null | MediaChannelRecorderType,
    uploadRecordingChunk: null as null | UploadRecordingChunkType
  }
})

/** @deprecated @todo merge with RecordingService */
export const activeRecordings = new Map<RecordingID, ActiveRecording>()
/** @deprecated @todo merge with RecordingService */
export const activePlaybacks = new Map<RecordingID, ActivePlayback>()

export const dispatchError = (error: string, targetPeer: PeerID, topic: Topic) => {
  logger.error('Recording Error: ' + error)
  dispatchAction(ECSRecordingActions.error({ error, $to: targetPeer, $topic: topic }))
}

export const onStartRecording = async (action: ReturnType<typeof ECSRecordingActions.startRecording>) => {
  const api = API.instance

  const recording = await api.service(recordingPath).get(action.recordingID)
  if (!recording) return dispatchError('Recording not found', action.$peer, action.$topic)

  let schema = recording.schema

  if (typeof schema === 'string') {
    schema = JSON.parse(schema)
  }

  const user = await api.service(userPath).get(recording.userId)
  if (!user) return dispatchError('Invalid user', action.$peer, action.$topic)

  const userID = user.id

  const hasScopes = await checkScope(user, 'recording', 'write')
  if (!hasScopes) return dispatchError('User does not have record:write scope', action.$peer, action.$topic)

  const dataChannelsRecording = new Map<DataChannelType, DataChannelFrames<any>>()

  const startTime = Date.now()

  const chunkLength = Math.floor((1000 / getState(ECSState).simulationTimestep) * 60) // 1 minute

  const dataChannelRecorder = (network: Network, dataChannel: DataChannelType, fromPeerID: PeerID, message: any) => {
    try {
      const data = decode(new Uint8Array(message))
      if (!dataChannelsRecording.has(dataChannel)) {
        dataChannelsRecording.set(dataChannel, { fromPeerID, frames: [] })
      }
      dataChannelsRecording.get(dataChannel)!.frames.push({ data, timecode: Date.now() - startTime })
    } catch (error) {
      logger.error('Could not decode data channel message', error)
    }
  }

  const activeRecording = {
    userID,
    dataChannelRecorder
  } as ActiveRecording

  const uploadRecordingChunk = getState(RecordingAPIState).uploadRecordingChunk
  if (!uploadRecordingChunk)
    return dispatchError('Recording not available - no upload method provided', action.$peer, action.$topic)

  if (NetworkState.worldNetwork) {
    const serializationSchema = schema.user
      .map((component) => getState(NetworkState).networkSchema[component] as SerializationSchema)
      .filter(Boolean)

    activeRecording.serializer = ECSSerialization.createSerializer({
      entities: () => {
        return [AvatarComponent.getUserAvatarEntity(userID)]
      },
      schema: serializationSchema,
      chunkLength,
      onCommitChunk(chunk, chunkIndex) {
        const key = 'recordings/' + recording.id + '/entities-' + chunkIndex + '.ee'
        const buffer = encode(chunk)
        uploadRecordingChunk({
          recordingID: recording.id,
          key,
          body: buffer,
          mimeType: 'application/octet-stream'
        }).then(() => {
          logger.info('Uploaded entities chunk', chunkIndex)
        })

        for (const [dataChannel, data] of dataChannelsRecording.entries()) {
          if (data.frames.length) {
            const key =
              'recordings/' + recording.id + '/' + data.fromPeerID + '_' + dataChannel + '_' + chunkIndex + '.ee'
            const buffer = encode(data)
            uploadRecordingChunk({
              recordingID: recording.id,
              key,
              body: buffer,
              mimeType: 'application/octet-stream'
            }).then(() => {
              logger.info('Uploaded raw chunk', chunkIndex)
            })
          }
          data.frames = []
        }
      }
    })

    // activeRecording.serializer.active = true

    const dataChannelSchema = Object.values(schema.peers)
      .flat()
      .filter((component: DataChannelType) => !!getState(DataChannelRegistryState)[component])
      .filter(Boolean) as DataChannelType[]

    for (const dataChannel of dataChannelSchema) {
      addDataChannelHandler(dataChannel, dataChannelRecorder)
    }
  }

  if (NetworkState.mediaNetwork) {
    const createMediaRecording = getState(RecordingAPIState).createMediaChannelRecorder
    if (!createMediaRecording) return dispatchError('Media recording not available', action.$peer, action.$topic)

    try {
      activeRecording.mediaChannelRecorder = await createMediaRecording(recording.id, schema.peers)

      dispatchAction(
        ECSRecordingActions.recordingStarted({
          recordingID: recording.id,
          $to: action.$peer,
          $topic: action.$topic
        })
      )
    } catch (e) {
      logger.error('Could not start media recording')
      console.log(e)
      dispatchError('Could not start media recording', action.$peer, action.$topic)
    }
  }

  activeRecordings.set(recording.id, activeRecording)
}

export const onStopRecording = async (action: ReturnType<typeof ECSRecordingActions.stopRecording>) => {
  const api = API.instance

  const activeRecording = activeRecordings.get(action.recordingID)
  if (!activeRecording) return dispatchError('Recording not found', action.$peer, action.$topic)

  const user = await api.service(userPath).get(activeRecording.userID)

  const hasScopes = await checkScope(user, 'recording', 'write')
  if (!hasScopes) return dispatchError('User does not have record:write scope', action.$peer, action.$topic)

  api.service(recordingPath).patch(action.recordingID, { ended: true }, { isInternal: true })

  const recording = await api.service(recordingPath).get(action.recordingID)

  let schema = recording.schema

  if (typeof schema === 'string') {
    schema = JSON.parse(schema)
  }

  if (activeRecording.serializer) {
    activeRecording.serializer.end()
  }

  if (activeRecording.mediaChannelRecorder) {
    await Promise.all([
      ...activeRecording.mediaChannelRecorder.recordings.map((recording) => recording.stopRecording()),
      ...activeRecording.mediaChannelRecorder.activeUploads
    ])
    // stop recording data channel
  }

  if (activeRecording.dataChannelRecorder) {
    const dataChannelSchema = Object.values(schema.peers)
      .flat()
      .filter((component: DataChannelType) => !!getState(DataChannelRegistryState)[component])
      .filter(Boolean) as DataChannelType[]

    for (const dataChannel of dataChannelSchema) {
      removeDataChannelHandler(dataChannel, activeRecording.dataChannelRecorder)
    }
  }
  activeRecordings.delete(action.recordingID)
}

export const onStartPlayback = async (action: ReturnType<typeof ECSRecordingActions.startPlayback>) => {
  const api = API.instance

  const recording = await api.service(recordingPath).get(action.recordingID, { isInternal: true })

  let schema = recording.schema

  if (typeof schema === 'string') {
    schema = JSON.parse(schema)
  }

  const isClone = !action.targetUser

  const user = await api.service(userPath).get(recording.userId)
  if (!user) return dispatchError('User not found', action.$peer, action.$topic)

  if (!isClone && Array.from(activePlaybacks.values()).find((rec) => rec.userID === action.targetUser)) {
    return dispatchError('User already has an active playback', action.$peer, action.$topic)
  }

  const hasScopes = await checkScope(user, 'recording', 'read')
  if (!hasScopes) return dispatchError('User does not have record:read scope', action.$peer, action.$topic)

  if (!recording.resources?.length) return dispatchError('Recording has no resources', action.$peer, action.$topic)

  const entityFiles = recording.resources.filter((resource) => resource.key.includes('entities-'))

  const rawFiles = recording.resources.filter(
    (resource) =>
      !resource.key.includes('entities-') &&
      resource.key.substring(resource.key.length - 3, resource.key.length) === '.ee'
  )

  const entityChunks = (await Promise.all(
    entityFiles.map(async (resource) => {
      const data = await fetch(resource.url)
      const buffer = await data.arrayBuffer()
      return decode(new Uint8Array(buffer))
    })
  )) as SerializedChunk[]

  const dataChannelChunks = new Map<DataChannelType, DataChannelFrames<any>>()

  await Promise.all(
    rawFiles.map(async (resource) => {
      const keyPieces = resource.key.split('/')[2].split('_')
      const fromPeerID = keyPieces[0] as PeerID
      const dataChannel = keyPieces[1] as DataChannelType
      if (!dataChannelChunks.has(dataChannel)) dataChannelChunks.set(dataChannel, { fromPeerID, frames: [] })
      const data = await fetch(resource.url)
      const buffer = await data.arrayBuffer()
      const decodedData = decode(new Uint8Array(buffer)) as DataChannelFrames<any>
      dataChannelChunks.get(dataChannel)!.frames.push(...decodedData.frames)
    })
  )

  const startTime = new Date(recording.createdAt).getTime()
  const endTime = new Date(recording.updatedAt).getTime()
  const durationSeconds = (endTime - startTime) / 1000

  const activePlayback = {
    userID: action.targetUser,
    entityChunks,
    dataChannelChunks,
    startTime,
    endTime,
    durationSeconds
  } as ActivePlayback

  const network = getState(NetworkState).networks[action.$network]

  const entitiesSpawned = [] as (EntityUUID | UserID)[]

  activePlayback.deserializer = ECSSerialization.createDeserializer({
    id: recording.id,
    chunks: entityChunks,
    schema: schema.user
      .map((component) => getState(NetworkState).networkSchema[component] as SerializationSchema)
      .filter(Boolean),
    onChunkStarted: (chunkIndex) => {
      if (!entityChunks[chunkIndex]) return
      for (let i = 0; i < entityChunks[chunkIndex].entities.length; i++) {
        const uuid = entityChunks[chunkIndex].entities[i]
        // override entity ID such that it is actually unique, by appendig the recording id
        const entityID = ((isClone ? uuid + '_' + recording.id : uuid) ?? Engine.instance.userID) as UserID & EntityUUID
        entityChunks[chunkIndex].entities[i] = entityID
        api
          .service(userPath)
          .get(uuid)
          .then((user) => {
            if (network && network.topic === NetworkTopics.world) {
              const network = NetworkState.worldNetwork
              const peerIDs = Object.keys(schema.peers) as PeerID[]

              // todo, this is a hack
              for (const peerID of peerIDs) {
                if (network.peers[peerID]) continue
                activePlayback.peerIDs!.push(peerID)
                NetworkPeerFunctions.createPeer(
                  network,
                  peerID,
                  network.peerIndexCount++,
                  entityID as any as UserID,
                  network.userIndexCount++
                )
                updatePeers(network)
              }
            }

            if (!UUIDComponent.getEntityByUUID(entityID) && isClone) {
              dispatchAction(
                AvatarNetworkAction.spawn({
                  parentUUID: getComponent(Engine.instance.originEntity, UUIDComponent),
                  ownerID: entityID,
                  entityUUID: (entityID + '_avatar') as EntityUUID,
                  avatarID: user.avatar.id!,
                  name: user.name + "'s Clone"
                })
              )
              entitiesSpawned.push(entityID)
            }
          })
          .catch((e) => {
            // console.log('not a user', e)
          })
      }
    },
    onEnd: () => {
      playbackStopped(activePlayback.userID, recording.id, network)
    }
  })

  // activePlayback.deserializer.active = action.autoplay
  activePlayback.entitiesSpawned = entitiesSpawned

  activePlayback.peerIDs = []

  activePlaybacks.set(action.recordingID, activePlayback)

  /** We only need to dispatch once, so do it on the media server which takes longer to start */
  if (!network || network.topic === NetworkTopics.media) {
    dispatchAction(
      ECSRecordingActions.playbackChanged({
        recordingID: action.recordingID,
        playing: true,
        $topic: network?.topic
      })
    )
  }
}

export const onStopPlayback = async (action: ReturnType<typeof ECSRecordingActions.stopPlayback>) => {
  const api = API.instance

  const recording = await api.service(recordingPath).get(action.recordingID)

  let schema = recording.schema

  if (typeof schema === 'string') {
    schema = JSON.parse(schema)
  }

  const user = await api.service(userPath).get(recording.userId)

  const hasScopes = await checkScope(user, 'recording', 'read')
  if (!hasScopes) throw new Error('User does not have record:read scope')

  const activePlayback = activePlaybacks.get(action.recordingID)
  if (!activePlayback) return

  if (activePlayback.deserializer) {
    activePlayback.deserializer.end()
  }

  if (activePlayback.mediaPlayback) {
    /** @todo */
  }

  playbackStopped(user.id, recording.id, getState(NetworkState).networks[action.$network])
}

const playbackStopped = (userId: UserID, recordingID: RecordingID, network?: Network) => {
  const activePlayback = activePlaybacks.get(recordingID)!

  for (const entityUUID of activePlayback.entitiesSpawned) {
    dispatchAction(
      WorldNetworkAction.destroyEntity({
        entityUUID: entityUUID as EntityUUID
      })
    )
  }

  if (network) {
    if (activePlayback.peerIDs) {
      for (const peerID of activePlayback.peerIDs) {
        NetworkPeerFunctions.destroyPeer(network, peerID)
      }
    }

    updatePeers(network)

    /** If syncing multipile instance servers, only need to dispatch once, so do it on the world server */
    if (network.topic === NetworkTopics.world) {
      dispatchAction(
        ECSRecordingActions.playbackChanged({
          recordingID,
          playing: false,
          $topic: network.topic
        })
      )
    }
  } else {
    dispatchAction(
      ECSRecordingActions.playbackChanged({
        recordingID,
        playing: false
      })
    )
  }

  activePlaybacks.delete(recordingID)
}

const startRecordingActionQueue = defineActionQueue(ECSRecordingActions.startRecording.matches)
const stopRecordingActionQueue = defineActionQueue(ECSRecordingActions.stopRecording.matches)
const startPlaybackActionQueue = defineActionQueue(ECSRecordingActions.startPlayback.matches)
const stopPlaybackActionQueue = defineActionQueue(ECSRecordingActions.stopPlayback.matches)

const execute = () => {
  const recordingState = getState(RecordingState)
  const playbackState = getState(PlaybackState)

  // todo - client side recording
  if (!isClient) {
    for (const action of startRecordingActionQueue()) onStartRecording(action)
    for (const action of stopRecordingActionQueue()) onStopRecording(action)
  }

  for (const action of startPlaybackActionQueue()) onStartPlayback(action)
  for (const action of stopPlaybackActionQueue()) onStopPlayback(action)

  // todo - only set deserializer.active to true once avatar spawns, if clone mode

  const network = NetworkState.worldNetwork // TODO - support buffer playback in media server

  if (!network) return

  if (recordingState.active) {
    for (const [id, recording] of activeRecordings) {
      const { serializer } = recording
      if (serializer) {
        serializer.write()
      }
    }
  }

  if (playbackState.playing) {
    const activePlayback = activePlaybacks.get(playbackState.recordingID!)!
    /** @todo use playback speed from metadata in recording */
    const timestep = 1 / 60 // TODO this is hardcoded in server timer
    getMutableState(PlaybackState).currentTime.set(playbackState.currentTime! + timestep)

    if (playbackState.currentTime! >= activePlayback.durationSeconds) {
      getMutableState(PlaybackState).playing.set(false)
    }
  }

  for (const [id, playback] of activePlaybacks) {
    const { deserializer } = playback
    const currentTime = playbackState.currentTime!
    const chunkLength = playback.entityChunks[0].changes.length

    const chunkIndex = Math.floor(currentTime / chunkLength)
    const frameIndex = Math.floor(currentTime * 60) % chunkLength

    if (deserializer) {
      deserializer.read(chunkIndex, frameIndex!)
    }

    for (const [dataChannel, chunks] of Array.from(playback.dataChannelChunks.entries())) {
      /** @todo optimize this by caching a coherent timeseries map of timecodes */
      const currentTimeMS = currentTime * 1000
      /** @todo reengineer chunking with seeking */
      const frame = chunks.frames.find((frame) => frame.timecode > currentTimeMS)
      if (frame) {
        const encodedData = encode(frame.data)

        /** PeerID must be the original peerID if server playback, otherwise it is our peerID */
        const peerID = isClient ? Engine.instance.store.peerID : chunks.fromPeerID
        if (isClient) {
          const dataChannelFunctions = getState(DataChannelRegistryState)[dataChannel]
          if (dataChannelFunctions) {
            for (const func of dataChannelFunctions) func(network, dataChannel, peerID, encodedData)
          }
        }
        network.bufferToAll(dataChannel, peerID, encodedData)
      }
    }
    // }
  }
}

export const ECSRecordingSystem = defineSystem({
  uuid: 'ee.engine.ECSRecordingSystem',
  insert: { after: PresentationSystemGroup },
  execute
})
