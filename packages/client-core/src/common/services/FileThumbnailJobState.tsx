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

import { API } from '@etherealengine/common'
import {
  FileBrowserContentType,
  fileBrowserUploadPath,
  staticResourcePath
} from '@etherealengine/common/src/schema.type.module'
import {
  EntityUUID,
  UUIDComponent,
  UndefinedEntity,
  createEntity,
  getComponent,
  removeEntity,
  setComponent,
  useOptionalComponent
} from '@etherealengine/ecs'
import { useTexture } from '@etherealengine/engine/src/assets/functions/resourceLoaderHooks'
import { GLTFDocumentState } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { ModelComponent } from '@etherealengine/engine/src/scene/components/ModelComponent'
import { getModelSceneID } from '@etherealengine/engine/src/scene/functions/loaders/ModelFunctions'
import { NO_PROXY, defineState, getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { DirectionalLightComponent, TransformComponent } from '@etherealengine/spatial'
import { CameraComponent } from '@etherealengine/spatial/src/camera/components/CameraComponent'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import {
  RendererComponent,
  getNestedVisibleChildren,
  getSceneParameters,
  initializeEngineRenderer,
  render
} from '@etherealengine/spatial/src/renderer/WebGLRendererSystem'
import { ObjectLayerMaskComponent } from '@etherealengine/spatial/src/renderer/components/ObjectLayerComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import createReadableTexture from '@etherealengine/spatial/src/renderer/functions/createReadableTexture'
import {
  BoundingBoxComponent,
  updateBoundingBox
} from '@etherealengine/spatial/src/transform/components/BoundingBoxComponents'
import { computeTransformMatrix } from '@etherealengine/spatial/src/transform/systems/TransformSystem'
import React, { useEffect } from 'react'
import { Color, Euler, Material, MathUtils, Matrix4, Mesh, Quaternion, Sphere, SphereGeometry, Vector3 } from 'three'

import config from '@etherealengine/common/src/config'
import { ErrorComponent } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { ShadowComponent } from '@etherealengine/engine/src/scene/components/ShadowComponent'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@etherealengine/spatial/src/renderer/components/MeshComponent'
import { loadMaterialGLTF } from '@etherealengine/spatial/src/renderer/materials/materialFunctions'
import { uploadToFeathersService } from '../../util/upload'
import { getCanvasBlob } from '../utils'

type ThumbnailJob = {
  key: string
  project: string // the project name
  id: string // the existing static resource ID
}

const seekVideo = (video: HTMLVideoElement, time: number): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    video.currentTime = time
    video.onerror = reject
    video.onseeked = () => {
      video.onerror = null
      video.onseeked = null
      resolve()
    }
  })

const drawToCanvas = (source: CanvasImageSource): Promise<HTMLCanvasElement | null> => {
  const canvas = document.createElement('canvas')
  canvas.width = 90
  canvas.height = 90
  const ctx = canvas.getContext('2d')
  if (ctx == null) {
    return Promise.reject()
  }
  ctx.drawImage(source, 0, 0, 90, 90)
  return Promise.resolve(canvas)
}

const uploadThumbnail = async (src: string, projectName: string, staticResourceId: string, blob: Blob | null) => {
  if (!blob) return
  const thumbnailMode = 'automatic'
  const thumbnailKey = `${decodeURI(stripSearchFromURL(src).replace(/^.*?\/projects\//, ''))
    .replaceAll(/[^a-zA-Z0-9\.\-_\s]/g, '')
    .replaceAll(/\s/g, '-')}-thumbnail.png`
  const file = new File([blob], thumbnailKey)
  const thumbnailURL = new URL(
    await uploadToFeathersService(fileBrowserUploadPath, [file], {
      args: [
        {
          fileName: file.name,
          project: projectName,
          path: 'public/thumbnails/' + file.name,
          contentType: file.type,
          type: 'thumbnail',
          thumbnailKey,
          thumbnailMode
        }
      ]
    }).promise
  )
  thumbnailURL.search = ''
  thumbnailURL.hash = ''
  const _thumbnailKey = thumbnailURL.href.replace(config.client.fileServer + '/', '')
  await API.instance.service(staticResourcePath).patch(staticResourceId, { thumbnailKey: _thumbnailKey, thumbnailMode })
}

const seenResources = new Set<string>()

export const FileThumbnailJobState = defineState({
  name: 'FileThumbnailJobState',
  initial: [] as ThumbnailJob[],
  reactor: () => <ThumbnailJobReactor />,
  useGenerateThumbnails: async (files: readonly FileBrowserContentType[]) => {
    const resourceQuery = useFind(staticResourcePath, {
      query: {
        key: {
          $in: files.map((file) => file.key).filter((key) => !seenResources.has(key))
        },
        thumbnailKey: 'null'
      }
    })

    /**
     * This useEffect will continuously check for new resources that need thumbnails generated until all resources have thumbnails
     */
    useEffect(() => {
      for (const resource of resourceQuery.data) {
        if (seenResources.has(resource.key)) continue
        seenResources.add(resource.key)

        if (resource.type === 'thumbnail') {
          //set thumbnail's thumbnail as itself
          API.instance.service(staticResourcePath).patch(resource.id, { thumbnailKey: resource.key })
          continue
        }

        if (resource.thumbnailKey != null || !extensionCanHaveThumbnail(resource.key.split('.').pop() ?? '')) continue

        getMutableState(FileThumbnailJobState).merge([
          {
            key: resource.url,
            project: resource.project!,
            id: resource.id
          }
        ])
      }

      // If there are more files left to be processed in the list we have specified, refetch the query
      if (resourceQuery.total > resourceQuery.data.length) resourceQuery.refetch()
    }, [resourceQuery.data])
  }
})

type ThumbnailFileType = 'image' | 'model' | 'texture' | 'video' | 'material'

const extensionThumbnailTypes: { extensions: string[]; thumbnailType: ThumbnailFileType }[] = [
  { extensions: ['material.gltf'], thumbnailType: 'material' },
  { extensions: ['gltf', 'glb', 'vrm', 'usdz', 'fbx'], thumbnailType: 'model' },
  { extensions: ['png', 'jpeg', 'jpg'], thumbnailType: 'image' },
  { extensions: ['ktx2'], thumbnailType: 'texture' },
  { extensions: ['mp4', 'm3u8'], thumbnailType: 'video' }
]
const extensionThumbnailTypeMap = new Map<string, ThumbnailFileType>()
for (const { extensions, thumbnailType } of extensionThumbnailTypes) {
  for (const extension of extensions) {
    extensionThumbnailTypeMap.set(extension, thumbnailType)
  }
}

const stripSearchFromURL = (url: string): string => {
  if (!url.includes('?')) return url
  const cleanURL = new URL(url)
  cleanURL.search = ''
  return cleanURL.href
}

export const extensionCanHaveThumbnail = (ext: string): boolean => extensionThumbnailTypeMap.has(ext)

const ThumbnailJobReactor = () => {
  const jobState = useHookstate(getMutableState(FileThumbnailJobState))
  const currentJob = useHookstate(null as ThumbnailJob | null)
  const { key: src, project, id } = currentJob.value ?? { key: '', project: '', id: '' }
  const strippedSrc = stripSearchFromURL(src)
  const extension = strippedSrc.endsWith('.material.gltf') ? 'material.gltf' : strippedSrc.split('.').pop() ?? ''
  const fileType = extensionThumbnailTypeMap.get(extension)

  const state = useHookstate({
    cameraEntity: UndefinedEntity,
    modelEntity: UndefinedEntity,
    lightEntity: UndefinedEntity,
    thumbnailCanvas: null as HTMLCanvasElement | null
  })
  const loadPromiseState = useHookstate(null as Promise<any> | null) // for asset loading
  const sceneState = useHookstate(getMutableState(GLTFDocumentState)) // for model rendering
  const [tex] = useTexture(fileType === 'texture' ? src : '') // for texture loading
  const lightComponent = useOptionalComponent(state.lightEntity.value, DirectionalLightComponent)
  const errorComponent = useOptionalComponent(state.modelEntity.value, ErrorComponent)

  const materialLoaded = useHookstate(false)

  const tryCatch = (fn: any) => {
    try {
      fn()
    } catch (e) {
      console.error('failed to generate thumbnail for', src)
      console.error(e)
      jobState.set(jobState.get(NO_PROXY).slice(1))
    }
  }

  function cleanupState() {
    if (state.cameraEntity.value) {
      removeEntity(state.cameraEntity.value)
      state.cameraEntity.set(UndefinedEntity)
    }
    if (state.modelEntity.value) {
      removeEntity(state.modelEntity.value)
      state.modelEntity.set(UndefinedEntity)
    }
    if (state.lightEntity.value) {
      removeEntity(state.lightEntity.value)
      state.lightEntity.set(UndefinedEntity)
    }
    if (state.thumbnailCanvas.get(NO_PROXY)) {
      state.thumbnailCanvas.get(NO_PROXY)?.remove()
      state.thumbnailCanvas.set(null)
    }
  }

  useEffect(() => {
    if (jobState.length > 0) {
      const newJob = jobState[0].get(NO_PROXY)
      currentJob.set(JSON.parse(JSON.stringify(newJob)))
    } else {
      cleanupState()
    }
  }, [jobState.length])

  // Load and render image
  useEffect(() => {
    if (src === '') return
    if (fileType !== 'image') return
    if (loadPromiseState.promised || loadPromiseState.value != null) return
    tryCatch(() => {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = src
      loadPromiseState.set(
        image
          .decode()
          .then(() => drawToCanvas(image))
          .then(getCanvasBlob)
          .then((blob) => tryCatch(() => uploadThumbnail(src, project, id, blob)))
          .then(() => jobState.set(jobState.get(NO_PROXY).slice(1)))
      )
    })
  }, [fileType, id])

  // Load and render video
  useEffect(() => {
    if (src === '') return
    if (fileType !== 'video') return
    if (loadPromiseState.value != null) return
    tryCatch(() => {
      const video = document.createElement('video')
      video.src = src
      video.crossOrigin = 'anonymous'
      loadPromiseState.set(
        seekVideo(video, 1)
          .then(() => drawToCanvas(video))
          .then(getCanvasBlob)
          .then((blob) => tryCatch(() => uploadThumbnail(src, project, id, blob)))
          .then(() => video.remove())
          .then(() => jobState.set(jobState.get(NO_PROXY).slice(1)))
      )
    })
  }, [fileType, id])

  // Load and render texture
  useEffect(() => {
    if (src === '') return
    if (fileType !== 'texture') return
    if (loadPromiseState.value != null) return
    if (!tex) return
    tryCatch(() => {
      const image = new Image()
      image.crossOrigin = 'anonymous'

      loadPromiseState.set(
        createReadableTexture(tex, { url: true })
          .then((result) => {
            image.src = result as string
            return image.decode()
          })
          .then(() => drawToCanvas(image))
          .then(getCanvasBlob)
          .then((blob) => tryCatch(() => uploadThumbnail(src, project, id, blob)))
          .then(() => image.remove())
          .then(() => jobState.set(jobState.get(NO_PROXY).slice(1)))
      )
    })
  }, [fileType, tex, id])

  // Load models
  useEffect(() => {
    if (src === '' || (fileType !== 'model' && fileType !== 'material')) {
      cleanupState()
      return
    }

    const entity = createEntity()
    setComponent(entity, NameComponent, 'thumbnail job asset ' + src)
    const uuid = MathUtils.generateUUID() as EntityUUID
    setComponent(entity, UUIDComponent, uuid)
    setComponent(entity, VisibleComponent)
    setComponent(entity, ShadowComponent, { cast: true, receive: true })
    setComponent(entity, BoundingBoxComponent)
    if (fileType === 'model') {
      setComponent(entity, ModelComponent, { src, cameraOcclusion: false })
    } else {
      if (materialLoaded.value) {
        materialLoaded.set(false)
      }
      loadMaterialGLTF(src, (material) => {
        if (!material) {
          console.error('Failed to load material for thumbnail', src)
        } else {
          const sphere = new Mesh(new SphereGeometry(1), material)
          if (Object.hasOwn(sphere.material, 'flatShading')) {
            ;(sphere.material as Material & { flatShading: boolean }).flatShading = false
          }
          addObjectToGroup(entity, sphere)
          setComponent(entity, MeshComponent, sphere)
          materialLoaded.set(true)
        }
      })
    }

    const lightEntity = createEntity()
    setComponent(lightEntity, TransformComponent, { rotation: new Quaternion().setFromEuler(new Euler(-4, -0.5, 0)) })
    setComponent(lightEntity, NameComponent, 'thumbnail job light for ' + src)
    setComponent(lightEntity, VisibleComponent)
    setComponent(lightEntity, DirectionalLightComponent, { intensity: 1, color: new Color(0xffffff) })

    if (!state.cameraEntity.value) {
      let canvasContainer = document.getElementById('thumbnail-camera-container')
      if (!canvasContainer) {
        canvasContainer = document.createElement('div')
        canvasContainer.id = 'thumbnail-camera-container'
        canvasContainer.style.width = '256px'
        canvasContainer.style.height = '256px'
        document.body.append(canvasContainer)
      }
      const thumbnailCanvas = document.createElement('canvas')
      thumbnailCanvas.width = 256
      thumbnailCanvas.height = 256
      canvasContainer.appendChild(thumbnailCanvas)
      state.thumbnailCanvas.set(thumbnailCanvas)

      const cameraEntity = createEntity()
      setComponent(cameraEntity, CameraComponent)
      setComponent(cameraEntity, RendererComponent, { canvas: thumbnailCanvas })
      initializeEngineRenderer(cameraEntity)
      setComponent(cameraEntity, VisibleComponent, true)
      state.cameraEntity.set(cameraEntity)
    }

    state.modelEntity.set(entity)
    state.lightEntity.set(lightEntity)
  }, [fileType, id])

  // Render model to canvas
  useEffect(() => {
    if (errorComponent?.keys.includes(ModelComponent.name)) {
      console.error('failed to load model for thumbnail', src)
      jobState.set(jobState.get(NO_PROXY).slice(1))
      return
    }
    if (src === '') return
    if (
      (fileType !== 'model' && fileType !== 'material') ||
      !state.cameraEntity.value ||
      !state.modelEntity.value ||
      !lightComponent?.light.value
    )
      return

    if (fileType === 'material' && !materialLoaded.value) return

    const modelEntity = state.modelEntity.value
    const lightEntity = state.lightEntity.value

    const sceneID = getModelSceneID(modelEntity)
    if (!sceneState.value[sceneID]) return

    try {
      updateBoundingBox(modelEntity)

      const bbox = getComponent(modelEntity, BoundingBoxComponent).box
      // const length = bbox.getSize(new Vector3(0, 0, 0)).length()
      // const normalizedSize = new Vector3().setScalar(length / 2)

      //const canvas = document.getElementById('preview-canvas') as HTMLCanvasElement
      // Create the camera entity
      const cameraEntity = state.cameraEntity.value
      setComponent(cameraEntity, NameComponent, 'thumbnail job camera for ' + src)

      // Assuming bbox is already defined
      // const size = bbox.getSize(new Vector3())
      const center = bbox.getCenter(new Vector3())

      // Calculate the bounding sphere radius
      const boundingSphere = bbox.getBoundingSphere(new Sphere())
      const radius = boundingSphere.radius

      const camera = getComponent(cameraEntity, CameraComponent)
      const fov = camera.fov * (Math.PI / 180) // convert vertical fov to radians

      // Calculate the camera direction vector with the desired angle offsets
      const angleY = 30 * (Math.PI / 180) // 30 degrees in radians
      const angleX = 15 * (Math.PI / 180) // 15 degrees in radians

      const direction = new Vector3(
        Math.sin(angleY) * Math.cos(angleX),
        Math.sin(angleX),
        Math.cos(angleY) * Math.cos(angleX)
      ).normalize()

      // Calculate the distance from the camera to the bounding sphere such that it fully frames the content
      const distance = radius / Math.sin(fov / 2)

      // Calculate the camera position
      const cameraPosition = direction.multiplyScalar(distance).add(center)

      // Set the camera transform component
      setComponent(cameraEntity, TransformComponent, { position: cameraPosition })
      computeTransformMatrix(cameraEntity)

      // Calculate the quaternion rotation to look at the center
      const lookAtMatrix = new Matrix4()
      lookAtMatrix.lookAt(cameraPosition, center, new Vector3(0, 1, 0))
      const targetRotation = new Quaternion().setFromRotationMatrix(lookAtMatrix)

      // Apply the rotation to the camera's TransfortexturemComponent
      setComponent(cameraEntity, TransformComponent, { rotation: targetRotation })
      computeTransformMatrix(cameraEntity)
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert()

      // Update the view camera matrices
      const viewCamera = camera.cameras[0]
      viewCamera.matrixWorld.copy(camera.matrixWorld)
      viewCamera.matrixWorldInverse.copy(camera.matrixWorldInverse)
      viewCamera.projectionMatrix.copy(camera.projectionMatrix)
      viewCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse)

      viewCamera.layers.mask = getComponent(cameraEntity, ObjectLayerMaskComponent)
      setComponent(cameraEntity, RendererComponent, { scenes: [modelEntity, lightEntity] })

      const renderer = getComponent(cameraEntity, RendererComponent)
      const { scene, canvas, scenes } = renderer
      const entitiesToRender = scenes.map(getNestedVisibleChildren).flat()
      const { children } = getSceneParameters(entitiesToRender)
      scene.children = children
      render(renderer, renderer.scene, getComponent(cameraEntity, CameraComponent), 0, false)
      function cleanup() {
        jobState.set(jobState.get(NO_PROXY).slice(1))
        materialLoaded.set(false)
      }
      canvas!.toBlob((blob: Blob) => {
        try {
          uploadThumbnail(src, project, id, blob).then(cleanup)
        } catch (e) {
          console.error('failed to upload model thumbnail for', src)
          console.error(e)
          cleanup()
        }
      })
    } catch (e) {
      console.error('failed to generate model thumbnail for', src)
      console.error(e)
      jobState.set(jobState.get(NO_PROXY).slice(1))
    }
  }, [
    state.cameraEntity,
    state.modelEntity,
    lightComponent?.light,
    sceneState.keys,
    errorComponent?.keys,
    materialLoaded
  ])

  return null
}
