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
import { MeshBasicMaterial, VideoTexture } from 'three'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { getComponent, getMutableComponent, hasComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { PresentationSystemGroup } from '@etherealengine/ecs/src/SystemGroups'
import { getState } from '@etherealengine/hyperflux'
import { StandardCallbacks, setCallback } from '@etherealengine/spatial/src/common/CallbackComponent'
import { MeshComponent } from '@etherealengine/spatial/src/renderer/components/MeshComponent'

import { getAudioAsync } from '../../assets/functions/resourceLoaderHooks'
import { MediaComponent } from '../../scene/components/MediaComponent'
import { VideoComponent, VideoTexturePriorityQueueState } from '../../scene/components/VideoComponent'
import { AudioState, useAudioState } from '../AudioState'
import { PositionalAudioComponent } from '../components/PositionalAudioComponent'

export class AudioEffectPlayer {
  static instance = new AudioEffectPlayer()

  constructor() {
    // only init when running in client
    if (isClient) {
      this.#init()
    }
  }

  static SOUNDS = {
    notification: '/sfx/notification.mp3',
    message: '/sfx/message.mp3',
    alert: '/sfx/alert.mp3',
    ui: '/sfx/ui.mp3'
  }

  bufferMap = {} as { [path: string]: AudioBuffer }

  loadBuffer = async (path: string) => {
    const [buffer] = await getAudioAsync(path)
    return buffer
  }

  // pool of elements
  #els: HTMLAudioElement[] = []

  #init() {
    if (this.#els.length) return
    for (let i = 0; i < 20; i++) {
      const audioElement = document.createElement('audio')
      audioElement.crossOrigin = 'anonymous'
      audioElement.loop = false
      this.#els.push(audioElement)
    }
  }

  play = async (sound: string, volumeMultiplier = getState(AudioState).notificationVolume) => {
    await Promise.resolve()

    if (!this.#els.length) return

    if (!this.bufferMap[sound]) {
      // create buffer if doesn't exist
      const [buffer] = await getAudioAsync(sound)
      if (buffer) this.bufferMap[sound] = buffer
    }

    const source = getState(AudioState).audioContext.createBufferSource()
    source.buffer = this.bufferMap[sound]
    const el = this.#els.find((el) => el.paused) ?? this.#els[0]
    el.volume = getState(AudioState).masterVolume * volumeMultiplier
    if (el.src !== sound) el.src = sound
    el.currentTime = 0
    source.start()
    source.connect(getState(AudioState).audioContext.destination)
  }
}

globalThis.AudioEffectPlayer = AudioEffectPlayer

const mediaQuery = defineQuery([MediaComponent])
const videoQuery = defineQuery([VideoComponent])
const audioQuery = defineQuery([PositionalAudioComponent])

const execute = () => {
  for (const entity of mediaQuery.enter()) {
    const media = getMutableComponent(entity, MediaComponent)
    setCallback(entity, StandardCallbacks.PLAY, () => media.paused.set(false))
    setCallback(entity, StandardCallbacks.PAUSE, () => media.paused.set(true))
  }

  const videoPriorityQueue = getState(VideoTexturePriorityQueueState).queue

  /** Use a priority queue with videos to ensure only a few are updated each frame */
  for (const entity of VideoComponent.uniqueVideoEntities) {
    const videoMeshEntity = getComponent(entity, VideoComponent).videoMeshEntity
    const videoTexture = (getComponent(videoMeshEntity, MeshComponent).material as MeshBasicMaterial)
      .map as VideoTexture
    if (videoTexture?.isVideoTexture) {
      const video = videoTexture.image
      const hasVideoFrameCallback = 'requestVideoFrameCallback' in video
      if (hasVideoFrameCallback === false || video.readyState < video.HAVE_CURRENT_DATA) continue
      videoPriorityQueue.addPriority(entity, 1)
    }
  }

  videoPriorityQueue.update()

  for (const entity of videoPriorityQueue.priorityEntities) {
    if (!hasComponent(entity, VideoComponent)) continue
    const videoMeshEntity = getComponent(entity, VideoComponent).videoMeshEntity
    const videoTexture = (getComponent(videoMeshEntity, MeshComponent).material as MeshBasicMaterial)
      .map as VideoTexture
    if (!videoTexture?.isVideoTexture) continue
    videoTexture.needsUpdate = true
  }
}

const reactor = () => {
  if (!isClient) return null

  useEffect(() => {
    const enableAudioContext = () => {
      const audioContext = getState(AudioState).audioContext
      if (audioContext.state === 'suspended') audioContext.resume()
    }

    // This must be outside of the normal ECS flow by necessity, since we have to respond to user-input synchronously
    // in order to ensure media will play programmatically
    const handleAutoplay = () => {
      enableAudioContext()
      window.removeEventListener('pointerup', handleAutoplay)
      window.removeEventListener('keypress', handleAutoplay)
      window.removeEventListener('touchend', handleAutoplay)
      window.removeEventListener('pointerup', handleAutoplay)
      window.removeEventListener('touchend', handleAutoplay)
    }
    // TODO: add destroy callbacks
    window.addEventListener('pointerup', handleAutoplay)
    window.addEventListener('keypress', handleAutoplay)
    window.addEventListener('touchend', handleAutoplay)
    window.addEventListener('pointerup', handleAutoplay)
    window.addEventListener('touchend', handleAutoplay)

    return () => {
      for (const sound of Object.values(AudioEffectPlayer.SOUNDS)) delete AudioEffectPlayer.instance.bufferMap[sound]
    }
  }, [])

  useAudioState()

  return null
}

export const MediaSystem = defineSystem({
  uuid: 'ee.engine.MediaSystem',
  insert: { before: PresentationSystemGroup },
  execute,
  reactor
})
