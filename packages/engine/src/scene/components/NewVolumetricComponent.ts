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
  AnimationSystemGroup,
  Engine,
  Entity,
  defineComponent,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  getOptionalMutableComponent,
  hasComponent,
  setComponent,
  useComponent,
  useEntityContext,
  useExecute,
  useOptionalComponent
} from '@etherealengine/ecs'
import { NO_PROXY, State, getMutableState, getState } from '@etherealengine/hyperflux'
import { addObjectToGroup, removeObjectFromGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { useEffect, useRef } from 'react'
import {
  BufferGeometry,
  CompressedTexture,
  Group,
  LinearFilter,
  Material,
  Mesh,
  SRGBColorSpace,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2
} from 'three'
import { CORTOLoader } from '../../assets/loaders/corto/CORTOLoader'
import { AssetLoaderState } from '../../assets/state/AssetLoaderState'
import { AudioState } from '../../audio/AudioState'
import {
  DRACOTarget,
  FrameTargetInfo,
  GeometryFormatToType,
  GeometryType,
  KeyframeAttribute,
  PlayerManifest as ManifestSchema,
  OldManifestSchema,
  Pretrackbufferingcallback,
  TIME_UNIT_MULTIPLIER,
  TextureType,
  UniformSolveEncodeOptions,
  UniformSolveTarget,
  textureTypeToUniformKey
} from '../constants/NewUVOLTypes'
import { addError, clearErrors } from '../functions/ErrorFunctions'
import BufferDataContainer from '../util/BufferDataContainer'
import {
  bufferLimits,
  deleteUsedGeometryBuffers,
  deleteUsedTextureBuffers,
  fetchGeometry,
  fetchTextures
} from '../util/VolumetricBufferingUtils'
import {
  GetGeometryProps,
  createMaterial,
  getGeometry,
  getSortedSupportedTargets,
  getTexture,
  handleMediaAutoplay
} from '../util/VolumetricUtils'
import { AudioNodeGroups, MediaElementComponent, createAudioNodeGroup } from './MediaComponent'
import { PlaylistComponent } from './PlaylistComponent'

interface VolumetricMutables {
  material: ShaderMaterial | null
  mesh: Mesh<BufferGeometry, ShaderMaterial> | null
  group: Group
  manifest: OldManifestSchema | ManifestSchema | Record<string, never>
  geometryBufferData: BufferDataContainer
  geometryBuffer: Map<string, (Mesh<BufferGeometry, Material> | BufferGeometry | KeyframeAttribute)[]>
  texture: Partial<
    Record<
      TextureType,
      {
        bufferData: BufferDataContainer
        buffer: Map<string, CompressedTexture[]>
      }
    >
  >
}

export const volumeticMutables: Record<Entity, VolumetricMutables> = {}

const initialState = {
  useVideoTextureForBaseColor: false, // legacy for UVOL1
  useLoadingEffect: true,
  volume: 1,
  checkForEnoughBuffers: true,
  notEnoughBuffers: true,
  time: {
    start: 0,
    checkpointAbsolute: -1,
    checkpointRelative: 0,
    currentTime: 0,
    bufferedUntil: 0,
    duration: 0
  },
  geometry: {
    targets: [],
    initialBufferLoaded: false,
    firstFrameLoaded: false,
    currentTarget: 0,
    userTarget: -1
  } as FrameTargetInfo,
  geometryType: undefined as unknown as GeometryType,
  textureBuffer: undefined as unknown as Map<string, Map<string, CompressedTexture[]>>,
  setIntervalId: -1,
  texture: {} as Partial<Record<TextureType, FrameTargetInfo>>,
  textureInfo: {
    textureTypes: [] as TextureType[],
    initialBufferLoaded: {} as Partial<Record<TextureType, boolean>>,
    firstFrameLoaded: {} as Partial<Record<TextureType, boolean>>
  },
  paused: true,
  preTrackBufferingCallback: undefined as undefined | Pretrackbufferingcallback
}

const resetState = {
  useVideoTextureForBaseColor: false, // legacy for UVOL1

  checkForEnoughBuffers: true,
  notEnoughBuffers: true,
  time: {
    start: 0,
    checkpointAbsolute: -1,
    checkpointRelative: 0,
    currentTime: 0,
    bufferedUntil: 0,
    duration: 0
  },
  geometry: {
    targets: [],
    initialBufferLoaded: false,
    firstFrameLoaded: false,
    currentTarget: 0,
    userTarget: -1
  } as FrameTargetInfo,
  geometryType: undefined as unknown as GeometryType,
  textureBuffer: undefined as unknown as Map<string, Map<string, CompressedTexture[]>>,
  setIntervalId: -1,
  texture: {} as Partial<Record<TextureType, FrameTargetInfo>>,
  textureInfo: {
    textureTypes: [] as TextureType[],
    initialBufferLoaded: {} as Partial<Record<TextureType, boolean>>,
    firstFrameLoaded: {} as Partial<Record<TextureType, boolean>>
  },
  paused: true
}

export const NewVolumetricComponent = defineComponent({
  name: 'NewVolumetricComponent',
  jsonID: 'EE_NewVolumetric',
  onInit: (entity) => structuredClone(initialState),
  onSet: (entity, component, json) => {
    if (!json) return
    if (typeof json.useLoadingEffect === 'boolean') {
      component.useLoadingEffect.set(json.useLoadingEffect)
    }
    if (typeof json.volume === 'number') {
      component.volume.set(json.volume)
    }
  },
  toJSON: (entity, component) => ({
    useLoadingEffect: component.useLoadingEffect.value,
    volume: component.volume.value
  }),
  errors: ['INVALID_TRACK', 'GEOMETRY_ERROR', 'TEXTURE_ERROR', 'UNKNOWN_ERROR'],

  canPlayWithoutPause: (entity: Entity) => {
    const component = getMutableComponent(entity, NewVolumetricComponent)
    const manifest = volumeticMutables[entity].manifest
    if (Object.keys(manifest).length === 0) {
      return false
    }

    const currentTimeInMS = component.time.currentTime.value
    const geometryBufferDataContainer = volumeticMutables[entity].geometryBufferData

    let durationInMS = -1
    const geometryType = component.geometryType.value

    if (geometryType === GeometryType.Corto) {
      const frameCount = (manifest as OldManifestSchema).frameData.length
      const frameRate = (manifest as OldManifestSchema).frameRate
      durationInMS = (frameCount * 1000) / frameRate
    } else if (geometryType === GeometryType.Unify || geometryType === GeometryType.Draco) {
      durationInMS = (manifest as ManifestSchema).duration * 1000
    } else {
      console.error('Invalid geometry type')
      return false
    }

    if (!component.geometry.initialBufferLoaded.value) {
      return false
    }

    const startTime = (currentTimeInMS * TIME_UNIT_MULTIPLIER) / 1000
    const geometryEndTime = Math.min(
      (durationInMS * TIME_UNIT_MULTIPLIER) / 1000,
      startTime + bufferLimits.geometry[geometryType].minBufferDurationToPlay * TIME_UNIT_MULTIPLIER
    )

    const geometryBufferData = geometryBufferDataContainer.getIntersectionDuration(startTime, geometryEndTime)
    if (geometryBufferData.missingDuration > 0 || geometryBufferData.pendingDuration > 0) {
      NewVolumetricComponent.adjustGeometryTarget(entity, 1) // lower the target, by signalling that the metric is 1
      return false
    }

    if (component.useVideoTextureForBaseColor.value) {
      return true
    }

    const textureTypes = component.textureInfo.textureTypes.value
    for (const textureType of textureTypes) {
      const textureInfo = component.texture[textureType].get(NO_PROXY)

      const textureBufferInfo = volumeticMutables[entity].texture[textureType]

      if (!textureInfo || !textureBufferInfo) {
        return false
      }

      if (!component.textureInfo.initialBufferLoaded.value[textureType]) {
        return false
      }
      const textureBufferDataContainer = textureBufferInfo.bufferData
      const target = textureInfo.targets[textureInfo.currentTarget]
      const format = (manifest as ManifestSchema).texture[textureType]!.targets[target].format

      const endTime = Math.min(
        (durationInMS * TIME_UNIT_MULTIPLIER) / 1000,
        startTime + bufferLimits.texture[format].minBufferDurationToPlay * TIME_UNIT_MULTIPLIER
      )

      const textureBufferData = textureBufferDataContainer.getIntersectionDuration(startTime, endTime)
      if (textureBufferData.missingDuration > 0 || textureBufferData.pendingDuration > 0) {
        NewVolumetricComponent.adjustTextureTarget(entity, textureType, 1) // lower the target, by signalling that the metric is 1
        return false
      }
    }

    return true
  },

  adjustGeometryTarget: (entity: Entity, externalMetric?: number) => {
    const component = getMutableComponent(entity, NewVolumetricComponent)
    if (component.geometry.userTarget.value !== -1) {
      if (component.geometry.currentTarget.value !== component.geometry.userTarget.value) {
        component.geometry.currentTarget.set(component.geometry.userTarget.value)
      }
      return
    }

    const geometryType = component.geometryType.value
    const bufferData = volumeticMutables[entity].geometryBufferData

    if (geometryType !== GeometryType.Corto) {
      const { totalFetchTime, totalPlayTime } = bufferData.getMetrics()
      if (externalMetric === undefined && totalPlayTime < 4 * TIME_UNIT_MULTIPLIER) {
        return
      }

      const metric = externalMetric === undefined ? totalFetchTime / totalPlayTime : externalMetric
      if (metric >= 0.5) {
        if (component.geometry.currentTarget.value > 0) {
          console.log('Decreasing geometry target, from ', component.geometry.currentTarget.value)
          component.geometry.currentTarget.set((v) => v - 1)
        }
      } else if (metric <= 0.1) {
        if (component.geometry.currentTarget.value < component.geometry.targets.value.length - 1) {
          console.log('Increasing geometry target from ', component.geometry.currentTarget.value)
          component.geometry.currentTarget.set((v) => v + 1)
        }
      }
      if (externalMetric === undefined) {
        bufferData.resetMetrics()
      }
    }
  },

  adjustTextureTarget: (entity: Entity, textureType: TextureType, externalMetric?: number) => {
    const component = getMutableComponent(entity, NewVolumetricComponent)
    const textureInfo = component.texture[textureType].get(NO_PROXY)
    const textureBufferInfo = volumeticMutables[entity].texture[textureType]

    if (textureInfo && textureBufferInfo) {
      if (textureInfo.userTarget !== -1) {
        if (textureInfo.currentTarget !== textureInfo.userTarget) {
          component.texture[textureType].merge({
            currentTarget: textureInfo.userTarget
          })
        }
        return
      }

      const bufferData = textureBufferInfo.bufferData
      const { totalFetchTime, totalPlayTime } = bufferData.getMetrics()
      if (externalMetric === undefined && totalPlayTime < 4 * TIME_UNIT_MULTIPLIER) {
        return
      }

      const metric = externalMetric === undefined ? totalFetchTime / totalPlayTime : externalMetric
      if (metric >= 0.5) {
        if (textureInfo.currentTarget > 0) {
          component.texture[textureType].merge({
            currentTarget: textureInfo.currentTarget - 1
          })
        }
      } else if (metric <= 0.1) {
        if (textureInfo.currentTarget < textureInfo.targets.length - 1) {
          component.texture[textureType].merge({
            currentTarget: textureInfo.currentTarget + 1
          })
        }
      }
      if (externalMetric === undefined) {
        bufferData.resetMetrics()
      }
    }
  },

  cleanupTrack: (entity: Entity) => {
    const component = getMutableComponent(entity, NewVolumetricComponent)

    console.log('Cleaning up track')
    clearInterval(component.setIntervalId.value)
    console.log('Cleared buffer loop interval: ', component.setIntervalId.value)

    const mesh = volumeticMutables[entity].mesh
    if (mesh && volumeticMutables[entity].group) {
      volumeticMutables[entity].group.remove(mesh)
    }
    if (volumeticMutables[entity].group) {
      removeObjectFromGroup(entity, volumeticMutables[entity].group)
    }

    const material = volumeticMutables[entity].material

    const MAX_DURATION = 5 * 60 * 1000 // 5 minutes
    const geometryBuffer = volumeticMutables[entity].geometryBuffer

    const textureTypes = Object.keys(volumeticMutables[entity].texture) as TextureType[]
    textureTypes.forEach((textureType) => {
      const textureBufferInfo = volumeticMutables[entity].texture[textureType]
      if (textureBufferInfo) {
        const textureBuffer = textureBufferInfo.buffer

        deleteUsedTextureBuffers({
          currentTimeInMS: MAX_DURATION,
          textureBuffer: textureBuffer,
          textureType: textureType as TextureType,
          clearAll: true
        })

        textureBuffer.clear()
      }
    })

    const geometryType = material?.vertexShader.includes('keyframeANormal') ? GeometryType.Unify : GeometryType.Corto
    deleteUsedGeometryBuffers({
      currentTimeInMS: MAX_DURATION,
      geometryBuffer: geometryBuffer,
      geometryType: geometryType,
      mesh: mesh!,
      clearAll: true
    })
    geometryBuffer.clear()

    if (material) {
      material.dispose()
    }

    if (mesh) {
      mesh.geometry.dispose()
    }

    console.log('Setting track to initial state: ', initialState)

    component.merge(structuredClone(resetState))

    volumeticMutables[entity].geometryBufferData = new BufferDataContainer()

    const mediaElement = getOptionalMutableComponent(entity, MediaElementComponent)
    if (mediaElement) {
      const element = mediaElement.element.get(NO_PROXY)
      // @ts-ignore
      element.src = ''
    }

    if (hasComponent(entity, NewVolumetricComponent)) {
      clearErrors(entity, NewVolumetricComponent)
    }
  },

  onRemove: (entity) => {
    NewVolumetricComponent.cleanupTrack(entity)
  },

  reactor: NewVolumetricComponentReactor
})

function NewVolumetricComponentReactor() {
  const entity = useEntityContext()
  const playlistComponent = useOptionalComponent(entity, PlaylistComponent)
  const component = useComponent(entity, NewVolumetricComponent)
  const bufferLoopIntervalId = useRef(-1)

  const audioContext = getState(AudioState).audioContext
  const gainNodeMixBuses = getState(AudioState).gainNodeMixBuses

  // Used by GeometryType.Unify
  const repeat = useRef(new Vector2(1, 1))
  const offset = useRef(new Vector2(0, 0))

  useEffect(() => {
    if (!component.geometry.initialBufferLoaded.value) {
      return
    }
    if (component.useVideoTextureForBaseColor.value) {
      addObjectToGroup(entity, volumeticMutables[entity].group)
      const media = getComponent(entity, MediaElementComponent).element
      handleMediaAutoplay({
        audioContext,
        media,
        paused: playlistComponent?.paused!
      })
      return
    }
    const textureInitialBufferLoaded = component.textureInfo.initialBufferLoaded.get(NO_PROXY)
    const textureTypes = component.textureInfo.textureTypes.value
    for (const textureType of textureTypes) {
      if (!textureInitialBufferLoaded[textureType]) {
        return
      }
    }
    if (playlistComponent?.autoplay.value && playlistComponent?.paused.value) {
      playlistComponent.paused.set(false)
    } else if (playlistComponent?.autoplay.value && !playlistComponent?.paused.value) {
      component.time.checkpointAbsolute.set(Date.now())
      component.paused.set(false)
    }

    console.log('All initial buffers loaded')
    addObjectToGroup(entity, volumeticMutables[entity].group)
  }, [component.geometry.initialBufferLoaded, component.textureInfo.initialBufferLoaded])

  const bufferLoop = () => {
    if (!hasComponent(entity, NewVolumetricComponent)) {
      clearInterval(bufferLoopIntervalId.current)
      return
    }

    const currentTimeInMS = component.time.currentTime.value
    const geometryTarget = component.geometry.targets[component.geometry.currentTarget.value].value
    const manifest = volumeticMutables[entity].manifest
    const geometryType = component.geometryType.value
    const manifestPath = playlistComponent?.tracks.value.find(
      (track) => track.uuid === playlistComponent.currentTrackUUID.value
    )?.src
    if (!manifestPath) {
      return
    }

    fetchGeometry({
      currentTimeInMS,
      bufferData: volumeticMutables[entity].geometryBufferData,
      target: geometryTarget,
      manifest,
      geometryType,
      manifestPath,
      geometryBuffer: volumeticMutables[entity].geometryBuffer,
      mesh: volumeticMutables[entity].mesh!,
      startTimeInMS: component.time.start.value,
      initialBufferLoaded: component.geometry.initialBufferLoaded,
      repeat: repeat,
      offset: offset
    })
    if (!component.useVideoTextureForBaseColor.value) {
      component.textureInfo.textureTypes.value.forEach((textureType) => {
        const textureTypeData = component.texture[textureType].get(NO_PROXY)
        const textureBufferInfo = volumeticMutables[entity].texture[textureType]

        if (textureTypeData && textureBufferInfo) {
          const bufferData = textureBufferInfo.bufferData
          const textureBuffer = textureBufferInfo.buffer

          const target = textureTypeData.targets[textureTypeData.currentTarget]
          const format = (manifest as ManifestSchema).texture[textureType]!.targets[target].format
          if (!(textureType in component.textureInfo.initialBufferLoaded.value)) {
            component.textureInfo.initialBufferLoaded.merge({
              [textureType]: false
            })
          }
          const initialBufferLoadedState = component.textureInfo.initialBufferLoaded[textureType] as State<boolean>

          fetchTextures({
            currentTimeInMS,
            bufferData,
            target,
            manifest,
            textureType,
            manifestPath,
            textureBuffer: textureBuffer,
            textureFormat: format,
            startTimeInMS: component.time.start.value,
            initialBufferLoaded: initialBufferLoadedState
          })
        }
      })
    }
  }

  useEffect(() => {
    if (!hasComponent(entity, MediaElementComponent)) {
      setComponent(entity, MediaElementComponent, {
        element: document.createElement('video')
      })
    }

    volumeticMutables[entity] = {
      material: null,
      mesh: null,
      group: new Group(),
      manifest: {},
      geometryBufferData: new BufferDataContainer(),
      geometryBuffer: new Map(),
      texture: {}
    }

    const mediaElement = getComponent(entity, MediaElementComponent)
    const element = mediaElement.element

    if (!AudioNodeGroups.get(element)) {
      const source = audioContext.createMediaElementSource(element)
      const audioNodes = createAudioNodeGroup(element, source, gainNodeMixBuses.soundEffects)

      audioNodes.gain.gain.setTargetAtTime(component.volume.value, audioContext.currentTime, 0.1)
    }
  }, [])

  useEffect(() => {
    const volume = component.volume.value
    const mediaElement = getOptionalComponent(entity, MediaElementComponent)
    if (mediaElement) {
      const element = mediaElement.element
      const audioNodes = AudioNodeGroups.get(element)
      if (audioNodes) {
        audioNodes.gain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.1)
      }
    }
  }, [component.volume])

  const validateManifest = (manifest: OldManifestSchema | ManifestSchema) => {
    try {
      if (!manifest) {
        addError(entity, NewVolumetricComponent, 'INVALID_TRACK', 'Manifest is empty')
        return false
      }

      if (
        (manifest as OldManifestSchema).frameData !== undefined &&
        (manifest as OldManifestSchema).frameRate !== undefined
      ) {
        component.useVideoTextureForBaseColor.set(true)
        component.geometryType.set(GeometryType.Corto)
        component.textureInfo.textureTypes.set(['baseColor'])
        component.time.duration.set(
          (manifest as OldManifestSchema).frameData.length / (manifest as OldManifestSchema).frameRate
        )
        component.texture.set({
          baseColor: {
            targets: [],
            initialBufferLoaded: false,
            firstFrameLoaded: false,
            currentTarget: 0,
            userTarget: -1
          }
        })
        component.geometry.targets.set(['corto'])
        if (!getState(AssetLoaderState).cortoLoader) {
          const loader = new CORTOLoader()
          loader.setDecoderPath(Engine.instance.store.publicPath + '/loader_decoders/')
          loader.preload()
          const assetLoaderState = getMutableState(AssetLoaderState)
          assetLoaderState.cortoLoader.set(loader)
        }
      } else if ((manifest as ManifestSchema).duration !== undefined) {
        const _manifest = manifest as ManifestSchema
        if (_manifest.duration <= 0 || _manifest.duration > 10800) {
          addError(entity, NewVolumetricComponent, 'INVALID_TRACK', `Invalid duration: ${_manifest.duration}`)
          return false
        }

        component.useVideoTextureForBaseColor.set(false)
        component.time.duration.set(_manifest.duration)
        const geometryTargets = Object.keys(_manifest.geometry.targets)
        if (geometryTargets.length === 0) {
          addError(entity, NewVolumetricComponent, 'GEOMETRY_ERROR', 'No geometry targets found')
          return false
        } else {
          geometryTargets.sort((a, b) => {
            const aData = _manifest.geometry.targets[a]
            const bData = _manifest.geometry.targets[b]

            // @ts-ignore
            const aSimplificationRatio = aData.settings.simplificationRatio ?? 1

            // @ts-ignore
            const bSimplificationRatio = bData.settings.simplificationRatio ?? 1

            const aMetric = aData.frameRate * aSimplificationRatio
            const bMetric = bData.frameRate * bSimplificationRatio
            return aMetric - bMetric
          })
          geometryTargets.forEach((target, index) => {
            _manifest.geometry.targets[target].priority = index
          })
          component.geometry.targets.set(geometryTargets)
        }

        const geometryType = GeometryFormatToType[_manifest.geometry.targets[geometryTargets[0]].format]
        if (geometryType === undefined) {
          addError(entity, NewVolumetricComponent, 'GEOMETRY_ERROR', 'Invalid geometry format')
          return false
        }
        component.geometryType.set(geometryType)

        const textureTypes = Object.keys(_manifest.texture) as TextureType[]
        if (textureTypes.length === 0) {
          addError(entity, NewVolumetricComponent, 'TEXTURE_ERROR', 'No texture types found')
          return false
        }
        if (!textureTypes.includes('baseColor')) {
          addError(entity, NewVolumetricComponent, 'TEXTURE_ERROR', 'No baseColor texture found')
          return false
        }

        component.textureInfo.textureTypes.set(textureTypes)
        textureTypes.forEach((textureType) => {
          const targets = _manifest.texture[textureType]?.targets
          if (targets) {
            const targetKeys = Object.keys(targets)
            if (targetKeys.length === 0) {
              addError(
                entity,
                NewVolumetricComponent,
                'TEXTURE_ERROR',
                `No texture targets found for type: ${textureType}`
              )
              return false
            }

            const supportedTargets = getSortedSupportedTargets(targets)
            supportedTargets.forEach((target, index) => {
              targets[target].priority = index
            })

            component.texture.merge({
              [textureType]: {
                targets: supportedTargets,
                initialBufferLoaded: false,
                firstFrameLoaded: false,
                currentTarget: 0,
                userTarget: -1
              } as FrameTargetInfo
            })
            volumeticMutables[entity].texture[textureType] = {
              bufferData: new BufferDataContainer(),
              buffer: new Map()
            }
          } else {
            addError(
              entity,
              NewVolumetricComponent,
              'TEXTURE_ERROR',
              `No texture targets found for type: ${textureType}`
            )
            return false
          }
        })
      }
    } catch (err) {
      addError(entity, NewVolumetricComponent, 'UNKNOWN_ERROR', 'Error in reading the manifest')
      console.error('Error in reading the manifest: ', err)
      return false
    }

    clearErrors(entity, NewVolumetricComponent)
    console.log('Manifest read successfully')
    return manifest
  }

  useEffect(() => {
    if (!playlistComponent?.currentTrackUUID.value) {
      return
    }

    NewVolumetricComponent.cleanupTrack(entity)
    const track = playlistComponent.tracks.value.find(
      (track) => track.uuid === playlistComponent.currentTrackUUID.value
    )
    if (!track || !track.src) {
      addError(entity, NewVolumetricComponent, 'INVALID_TRACK', 'Track source is empty')
      return
    }

    let trackSource = track.src
    if (track.src.endsWith('.mp4')) {
      trackSource = track.src.replace('.mp4', '.manifest')
    }

    fetch(trackSource)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`Unable to load the manifest: ${resp.statusText}`)
        }

        return resp.json()
      })
      .then((data) => {
        const manifest = validateManifest(data)

        if (!manifest) {
          return
        }
        volumeticMutables[entity].manifest = manifest

        const preTrackBufferingCallback = component.preTrackBufferingCallback.value
        if (preTrackBufferingCallback) {
          preTrackBufferingCallback(component)
        }
        component.time.currentTime.set(component.time.start.value)
        const firstGeometryTarget =
          component.geometryType.value !== GeometryType.Corto ? component.geometry.targets[0].value : ''

        const hasNormals =
          component.geometryType.value === GeometryType.Unify &&
          !((manifest as ManifestSchema).geometry.targets[firstGeometryTarget].settings as UniformSolveEncodeOptions)
            .excludeNormals

        const overrideMaterialProperties =
          component.geometryType.value !== GeometryType.Corto
            ? (manifest as ManifestSchema).materialProperties
            : undefined

        volumeticMutables[entity].material = createMaterial(
          component.geometryType.value,
          component.useVideoTextureForBaseColor.value,
          hasNormals,
          component.textureInfo.textureTypes.value,
          // @ts-ignore
          overrideMaterialProperties
        )
        volumeticMutables[entity].mesh = new Mesh(
          new SphereGeometry(0.001, 32, 32) as BufferGeometry,
          volumeticMutables[entity].material!
        )

        volumeticMutables[entity].group.add(volumeticMutables[entity].mesh!)
        volumeticMutables[entity].mesh!.material = volumeticMutables[entity].material!
        volumeticMutables[entity].mesh!.material.needsUpdate = true

        const intervalId = setInterval(bufferLoop, 500)
        component.setIntervalId.set(intervalId as unknown as number)
        bufferLoopIntervalId.current = intervalId as unknown as number
        console.log('Buffer loop started: ', intervalId)

        const mediaElement = getMutableComponent(entity, MediaElementComponent)

        if (component.useVideoTextureForBaseColor.value) {
          const element = mediaElement.element.get(NO_PROXY) as HTMLVideoElement
          if (component.useVideoTextureForBaseColor.value) {
            element.playsInline = true
            element.preload = 'auto'
            element.crossOrigin = 'anonymous'

            element.src = track.src.replace('.manifest', '.mp4')

            element.currentTime = component.time.currentTime.value / 1000
            element.load()

            element.addEventListener('ended', () => {
              if (playlistComponent) {
                PlaylistComponent.playNextTrack(entity)
              }
            })

            const setTexture = () => {
              const firstFrameLoaded = component.textureInfo.firstFrameLoaded.get(NO_PROXY)

              if (!firstFrameLoaded['baseColor']) {
                const videoTexture = new Texture(element)
                videoTexture.generateMipmaps = false
                videoTexture.minFilter = LinearFilter
                videoTexture.magFilter = LinearFilter
                ;(videoTexture as any).isVideoTexture = true
                ;(videoTexture as any).update = () => {}
                videoTexture.colorSpace = SRGBColorSpace
                videoTexture.flipY = true

                volumeticMutables[entity].mesh!.material.uniforms['map'].value = videoTexture
                videoTexture.needsUpdate = true
                component.textureInfo.firstFrameLoaded['baseColor'].set(true)
                console.log('Video source set: ', element.src, element, videoTexture)
                element.removeEventListener('canplay', setTexture)
              }
            }

            element.addEventListener('canplay', setTexture)

            let recheckForBuffersIntervalId = -1

            const processFrame = (now: DOMHighResTimeStamp, metadata) => {
              const currentTimeInMS = metadata.mediaTime * 1000
              updateBufferedUntil(currentTimeInMS)

              component.time.currentTime.set(currentTimeInMS)

              if (!NewVolumetricComponent.canPlayWithoutPause(entity)) {
                if (!element.paused) {
                  element.pause()
                  recheckForBuffersIntervalId = setInterval(() => {
                    if (NewVolumetricComponent.canPlayWithoutPause(entity) && recheckForBuffersIntervalId !== -1) {
                      clearInterval(recheckForBuffersIntervalId)
                      recheckForBuffersIntervalId = -1
                      if (!playlistComponent?.paused.value && component.geometry.initialBufferLoaded.value) {
                        element.play()
                      }
                    }
                  }, 500) as unknown as number
                }
              }

              const frameNo = Math.round(metadata.mediaTime * (manifest as OldManifestSchema).frameRate)
              const collection = volumeticMutables[entity].geometryBuffer.get('corto')
              if (collection && collection[frameNo]) {
                updateGeometry(currentTimeInMS)
                volumeticMutables[entity].material!.uniforms['map'].value
                if (volumeticMutables[entity].material!.uniforms['map'].value) {
                  volumeticMutables[entity].material!.uniforms['map'].value.needsUpdate = true
                }
              }

              element.requestVideoFrameCallback(processFrame)
            }

            element.requestVideoFrameCallback(processFrame)
          }
        }
      })
      .catch((err) => {
        addError(entity, NewVolumetricComponent, 'INVALID_TRACK', 'Error in loading the manifest')
        console.error(`Error in loading the manifest: ${track.src}: `, err)
      })
  }, [playlistComponent?.currentTrackUUID])

  useEffect(() => {
    console.log('Paused: ', component.paused.value)
    const now = Date.now()
    const mediaElement = getOptionalComponent(entity, MediaElementComponent)

    if (!playlistComponent || playlistComponent?.paused.value) {
      component.paused.set(true)
      if (component.useVideoTextureForBaseColor.value && mediaElement && !mediaElement.element.paused) {
        mediaElement.element.pause()
      }

      const currentCheckpointAbsolute = component.time.checkpointAbsolute.value

      const currentTimeRelative =
        currentCheckpointAbsolute !== -1
          ? component.time.checkpointRelative.value + now - currentCheckpointAbsolute
          : component.time.start.value
      const newCheckpointAbsolute = now

      component.time.merge({
        checkpointAbsolute: newCheckpointAbsolute,
        checkpointRelative: currentTimeRelative
      })
    } else {
      const currentTimeAbs = now
      component.time.checkpointAbsolute.set(currentTimeAbs)
      if (
        component.useVideoTextureForBaseColor.value &&
        mediaElement &&
        mediaElement.element.paused &&
        mediaElement.element.src
      ) {
        mediaElement.element.play()
      }
      component.paused.set(false)
    }
  }, [playlistComponent?.paused])

  const updateGeometry = (currentTimeInMS: number) => {
    const geometryBuffer = volumeticMutables[entity].geometryBuffer
    const mesh = volumeticMutables[entity].mesh!

    const geometryType = component.geometryType.value
    const targetData =
      component.geometryType.value !== GeometryType.Corto
        ? (volumeticMutables[entity].manifest as ManifestSchema).geometry.targets
        : undefined
    const frameRate =
      component.geometryType.value === GeometryType.Corto
        ? (volumeticMutables[entity].manifest as OldManifestSchema).frameRate
        : undefined

    NewVolumetricComponent.adjustGeometryTarget(entity)
    const geometryTarget = component.geometry.targets[component.geometry.currentTarget.value].value

    deleteUsedGeometryBuffers({
      geometryBuffer,
      currentTimeInMS: currentTimeInMS - 500,
      geometryType,
      targetData,
      frameRate,
      mesh,
      bufferData: volumeticMutables[entity].geometryBufferData
    })

    const result = getGeometry({
      geometryBuffer,
      currentTimeInMS,
      preferredTarget: geometryTarget,
      geometryType,
      targets: component.geometry.targets.value,
      ...(geometryType === GeometryType.Corto && { frameRate: frameRate as number }),
      ...(geometryType !== GeometryType.Corto && {
        targetData: targetData as Record<string, DRACOTarget | UniformSolveTarget>
      }),
      ...(geometryType === GeometryType.Unify && { keyframeName: 'keyframeA' })
    } as GetGeometryProps)

    if (!result) {
      if (geometryType !== GeometryType.Unify) {
        console.warn('Geometry frame not found at time: ', currentTimeInMS / 1000)
        return
      }
    } else {
      if (geometryType === GeometryType.Corto || geometryType === GeometryType.Draco) {
        const geometry = result.geometry as BufferGeometry
        if (mesh.geometry !== geometry) {
          mesh.geometry = geometry
          mesh.geometry.attributes['position'].needsUpdate = true
        }
      }
    }

    if (geometryType === GeometryType.Unify) {
      const keyframeAResult = result as
        | {
            geometry: KeyframeAttribute
            index: number
            target: string
          }
        | false
      const keyframeBResult = getGeometry({
        geometryBuffer: geometryBuffer,
        currentTimeInMS,
        preferredTarget: geometryTarget,
        geometryType,
        targets: component.geometry.targets.value,
        targetData: targetData as Record<string, DRACOTarget | UniformSolveTarget>,
        ...(geometryType === GeometryType.Unify && { keyframeName: 'keyframeB' })
      } as GetGeometryProps) as
        | {
            geometry: KeyframeAttribute
            index: number
            target: string
          }
        | false

      if (keyframeAResult) {
        if (mesh.geometry.attributes['keyframeAPosition'] !== keyframeAResult.geometry.position) {
          mesh.geometry.attributes['keyframeAPosition'] = keyframeAResult.geometry.position
          mesh.geometry.attributes['keyframeAPosition'].needsUpdate = true
        }
        if (
          keyframeAResult.geometry.normal &&
          mesh.geometry.attributes['keyframeANormal'] !== keyframeAResult.geometry.normal
        ) {
          mesh.geometry.attributes['keyframeANormal'] = keyframeAResult.geometry.normal
          mesh.geometry.attributes['keyframeANormal'].needsUpdate = true
        }
      }
      if (keyframeBResult) {
        if (mesh.geometry.attributes['keyframeBPosition'] !== keyframeBResult.geometry.position) {
          mesh.geometry.attributes['keyframeBPosition'] = keyframeBResult.geometry.position
          mesh.geometry.attributes['keyframeBPosition'].needsUpdate = true
        }
        if (
          keyframeBResult.geometry.normal &&
          mesh.geometry.attributes['keyframeBNormal'] !== keyframeBResult.geometry.normal
        ) {
          mesh.geometry.attributes['keyframeBNormal'] = keyframeBResult.geometry.normal
          mesh.geometry.attributes['keyframeBNormal'].needsUpdate = true
        }
      }

      if (!keyframeAResult && !keyframeBResult) {
        return
      } else if (!keyframeAResult && keyframeBResult) {
        mesh.material.uniforms.mixRatio.value = 1
      } else if (keyframeAResult && !keyframeBResult) {
        mesh.material.uniforms.mixRatio.value = 0
      } else if (keyframeAResult && keyframeBResult) {
        const keyframeATimeInMS = (keyframeAResult.index * 1000) / targetData![keyframeAResult.target].frameRate
        const keyframeBTimeInMS = (keyframeBResult.index * 1000) / targetData![keyframeBResult.target].frameRate

        const distanceFromA = Math.abs(currentTimeInMS - keyframeATimeInMS)
        const distanceFromB = Math.abs(currentTimeInMS - keyframeBTimeInMS)

        const mixRatio = distanceFromA + distanceFromB > 0 ? distanceFromA / (distanceFromA + distanceFromB) : 0.5

        mesh.material.uniforms.mixRatio.value = mixRatio
      }
    }
  }

  const updateTexture = (currentTimeInMS: number) => {
    const textureTypes = component.textureInfo.textureTypes.value
    const manifest = volumeticMutables[entity].manifest as ManifestSchema
    const material = volumeticMutables[entity].material!

    textureTypes.forEach((textureType) => {
      const textureInfo = component.texture[textureType].get(NO_PROXY)
      const targetData = manifest.texture[textureType]!.targets
      const textureBufferInfo = volumeticMutables[entity].texture[textureType]

      if (textureInfo && textureBufferInfo) {
        NewVolumetricComponent.adjustTextureTarget(entity, textureType)
        deleteUsedTextureBuffers({
          textureBuffer: textureBufferInfo.buffer,
          currentTimeInMS: currentTimeInMS - 500,
          bufferData: textureBufferInfo.bufferData,
          textureType,
          targetData
        })

        const targets = textureInfo.targets
        const preferredTarget = textureInfo.targets[textureInfo.currentTarget]
        const result = getTexture({
          textureBuffer: textureBufferInfo.buffer,
          currentTimeInMS,
          preferredTarget,
          targets,
          textureType,
          // @ts-ignore
          targetData
        })

        if (!result) {
          console.warn(`Texture frame not found at time: ${currentTimeInMS / 1000}`)
          console.log(textureBufferInfo.buffer, textureInfo)
          return
        }
        const textureKey = textureTypeToUniformKey[textureType]
        const tranformKey = `${textureKey}Transform`

        if (material.uniforms[textureKey].value !== result.texture) {
          result.texture.repeat.set(repeat.current.x, repeat.current.y)
          result.texture.offset.set(offset.current.x, offset.current.y)
          result.texture.updateMatrix()
          result.texture.matrixAutoUpdate = false
          if (textureKey in material.uniforms) {
            material.uniforms[textureKey].value = result.texture
          } else {
            material.uniforms[textureKey] = {
              value: result.texture
            }
          }
          material.uniforms[textureKey].value.needsUpdate = true

          if (tranformKey in material.uniforms) {
            material.uniforms[tranformKey].value.copy(result.texture.matrix)
          } else {
            material.uniforms[tranformKey] = {
              value: result.texture.matrix
            }
          }
        }
      }
    })
  }

  const updateBufferedUntil = (currentTimeInMS: number) => {
    let bufferedUntil = Number.MAX_VALUE
    const geometryBufferData = volumeticMutables[entity].geometryBufferData
    bufferedUntil = Math.min(
      bufferedUntil,
      geometryBufferData.getBufferedUntil((currentTimeInMS * TIME_UNIT_MULTIPLIER) / 1000)
    )

    if (!component.useVideoTextureForBaseColor.value) {
      const textureTypes = component.textureInfo.textureTypes.value
      for (const textureType of textureTypes) {
        const textureInfo = component.texture[textureType].get(NO_PROXY)
        const textureBufferInfo = volumeticMutables[entity].texture[textureType]
        if (textureInfo && textureBufferInfo) {
          const textureBufferData = textureBufferInfo.bufferData
          bufferedUntil = Math.min(
            bufferedUntil,
            textureBufferData.getBufferedUntil((currentTimeInMS * TIME_UNIT_MULTIPLIER) / 1000)
          )
        }
      }
    }

    component.time.bufferedUntil.set((bufferedUntil * 1000) / TIME_UNIT_MULTIPLIER)
  }

  useExecute(
    () => {
      const playlistComponent = getOptionalComponent(entity, PlaylistComponent)
      if (!playlistComponent) {
        return
      }

      if (component.geometryType.value === GeometryType.Corto && component.useVideoTextureForBaseColor.value) {
        return
      }

      if (playlistComponent.paused) {
        return
      }

      if (!playlistComponent.currentTrackUUID) {
        return
      }

      const now = Date.now()

      const __currentTime =
        component.paused.value || playlistComponent.paused || component.notEnoughBuffers.value
          ? component.time.checkpointRelative.value
          : component.time.checkpointRelative.value + now - component.time.checkpointAbsolute.value

      if (__currentTime > component.time.duration.value * 1000) {
        console.log('CurrentTime: ', __currentTime, ' Duration: ', component.time.duration.value * 1000)
        console.log('Track ended')
        PlaylistComponent.playNextTrack(entity)
        return
      }

      updateBufferedUntil(__currentTime)

      if (component.checkForEnoughBuffers.value) {
        if (!NewVolumetricComponent.canPlayWithoutPause(entity)) {
          if (component.notEnoughBuffers.value) {
            return
          } else {
            component.notEnoughBuffers.set(true)
            const currentCheckpointAbsolute = component.time.checkpointAbsolute.value

            const currentTimeRelative =
              currentCheckpointAbsolute !== -1
                ? component.time.checkpointRelative.value + now - currentCheckpointAbsolute
                : component.time.start.value
            const newCheckpointAbsolute = now

            component.time.merge({
              checkpointAbsolute: newCheckpointAbsolute,
              checkpointRelative: currentTimeRelative
            })
            return
          }
        } else {
          if (component.notEnoughBuffers.value) {
            component.notEnoughBuffers.set(false)
            const currentTimeAbs = now
            component.time.checkpointAbsolute.set(currentTimeAbs)
          } else {
            // Continue
          }
        }
      }

      const currentTime = __currentTime
      component.time.currentTime.set(currentTime)

      updateGeometry(__currentTime)

      if (!component.useVideoTextureForBaseColor.value) {
        updateTexture(__currentTime)
      }
    },
    {
      with: AnimationSystemGroup
    }
  )

  return null
}
