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

import { GLTF } from '@gltf-transform/core'
import { useEffect } from 'react'
import { Texture } from 'three'
import { v4 as uuidv4 } from 'uuid'

import { Entity, UndefinedEntity } from '@etherealengine/ecs'
import { NO_PROXY, State, useHookstate, useImmediateEffect } from '@etherealengine/hyperflux'
import { ResourceAssetType, ResourceManager, ResourceType } from '@etherealengine/spatial/src/resources/ResourceState'

import { ResourcePendingComponent } from '../../gltf/ResourcePendingComponent'
import { GLTF as GLTFAsset } from '../loaders/gltf/GLTFLoader'
import { loadResource } from './resourceLoaderFunctions'

function useLoader<T extends ResourceAssetType>(
  url: string,
  resourceType: ResourceType,
  entity: Entity = UndefinedEntity,
  //Called when the asset url is changed, mostly useful for editor functions when changing an asset
  onUnload: (url: string) => void = (url: string) => {}
): [T | null, ErrorEvent | Error | null, ProgressEvent<EventTarget> | null, () => void] {
  const value = useHookstate<T | null>(null)
  const error = useHookstate<ErrorEvent | Error | null>(null)
  const progress = useHookstate<ProgressEvent<EventTarget> | null>(null)
  const uuid = useHookstate<string>(uuidv4)

  const unload = () => {
    if (url) ResourceManager.unload(url, entity, uuid.value)
  }

  useEffect(() => {
    return unload
  }, [])

  useImmediateEffect(() => {
    const _url = url
    if (!_url) return
    let completed = false

    if (entity) {
      ResourcePendingComponent.setResource(entity, _url, 0, 0)
    }

    const controller = new AbortController()
    loadResource<T>(
      _url,
      resourceType,
      entity,
      (response) => {
        completed = true
        value.set(response)
        if (entity) {
          ResourcePendingComponent.removeResource(entity, _url)
        }
      },
      (request) => {
        progress.set(request)
        if (entity) {
          ResourcePendingComponent.setResource(entity, _url, request.loaded, request.total)
        }
      },
      (err) => {
        // Effect was unmounted, can't set error state safely
        if (controller.signal.aborted) return
        completed = true
        error.set(err)
        if (entity) {
          ResourcePendingComponent.removeResource(entity, _url)
        }
      },
      controller.signal,
      uuid.value
    )

    return () => {
      if (!completed)
        controller.abort(
          `resourceHooks:useLoader Component loading ${resourceType} at url ${url} for entity ${entity} was unmounted`
        )

      ResourceManager.unload(_url, entity, uuid.value)
      value.set(null)
      progress.set(null)
      error.set(null)
      onUnload(_url)
    }
  }, [url])

  return [value.get(NO_PROXY) as T | null, error.get(NO_PROXY), progress.get(NO_PROXY), unload]
}

function useBatchLoader<T extends ResourceAssetType>(
  urls: string[],
  resourceType: ResourceType,
  entity: Entity = UndefinedEntity
): [
  State<(T | null)[]>,
  State<(ErrorEvent | Error | null)[]>,
  State<(ProgressEvent<EventTarget> | null)[]>,
  () => void
] {
  const values = useHookstate<T[]>(new Array(urls.length).fill(null))
  const errors = useHookstate<(ErrorEvent | Error)[]>(new Array(urls.length).fill(null))
  const progress = useHookstate<ProgressEvent<EventTarget>[]>(new Array(urls.length).fill(null))

  const unload = () => {
    for (const url of urls) ResourceManager.unload(url, entity)
  }

  useEffect(() => {
    return unload
  }, [])

  useImmediateEffect(() => {
    const completedArr = new Array(urls.length).fill(false) as boolean[]
    const controller = new AbortController()

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i]
      if (!url) continue
      loadResource<T>(
        url,
        resourceType,
        entity,
        (response) => {
          completedArr[i] = true
          values[i].set(response)
        },
        (request) => {
          progress[i].set(request)
        },
        (err) => {
          completedArr[i] = true
          errors[i].set(err)
        },
        controller.signal
      )
    }

    return () => {
      for (const completed of completedArr) {
        if (!completed) {
          controller.abort(
            `resourceHooks:useBatchLoader Component loading ${resourceType} at urls ${urls.toString()} for entity ${entity} was unmounted`
          )
          return
        }
      }
    }
  }, [JSON.stringify(urls)])

  return [values, errors, progress, unload]
}

async function getLoader<T extends ResourceAssetType>(
  url: string,
  resourceType: ResourceType,
  entity: Entity = UndefinedEntity
): Promise<[T | null, () => void, ErrorEvent | Error | null]> {
  const unload = () => {
    ResourceManager.unload(url, entity)
  }

  return new Promise((resolve) => {
    const controller = new AbortController()
    loadResource<T>(
      url,
      resourceType,
      entity,
      (response) => {
        resolve([response, unload, null])
      },
      (request) => {},
      (err) => {
        resolve([null, unload, err])
      },
      controller.signal
    )
  })
}

/**
 *
 * GLTF loader hook for use in React Contexts.
 * The asset will be loaded through the ResourceManager in ResourceState.ts.
 * The asset will be unloaded and disposed when the component is unmounted or when onUnloadCallback is called.
 *
 * @param url The URL of the GLTF file to load
 * @param entity *Optional* The entity that is loading the GLTF, defaults to UndefinedEntity
 * @param params *Optional* LoadingArgs that are passed through to the asset loader
 * @param onUnload *Optional* A callback that is called when the URL is changed and the previous asset is unloaded, only needed for editor specific behavior
 * @returns Tuple of [GLTF, Error, Progress, onUnloadCallback]
 */
export function useGLTF(
  url: string,
  entity?: Entity,
  onUnload?: (url: string) => void
): [GLTFAsset | null, ErrorEvent | Error | null, ProgressEvent<EventTarget> | null, () => void] {
  return useLoader<GLTFAsset>(url, ResourceType.GLTF, entity, onUnload)
}

export function useGLTFDocument(
  url: string,
  entity?: Entity,
  onUnload?: (url: string) => void
): [GLTF.IGLTF | null, ErrorEvent | Error | null, ProgressEvent<EventTarget> | null, () => void] {
  return useLoader<any>(url, ResourceType.Unknown, entity, onUnload)
}

/**
 *
 * Same as useGLTF hook, but takes an array of urls.
 * Only use in cases where you can operate idempotently on the result as changes to array elements are inherently non-reactive
 * Array values are returned wrapped in State to preserve the little reactivity there is
 * The assets will be unloaded and disposed when the component is unmounted or when onUnloadCallback is called.
 *
 * @param urls Array of GLTF URLs to load
 * @param entity *Optional* The entity that is loading the GLTF, defaults to UndefinedEntity
 * @param params *Optional* LoadingArgs that are passed through to the asset loader
 * @returns Tuple of [State<GLTF[]>, State<Error[]>, State<Progress[]>, onUnloadCallback]
 */
export function useBatchGLTF(
  urls: string[],
  entity?: Entity
): [
  State<(GLTFAsset | null)[]>,
  State<(ErrorEvent | Error | null)[]>,
  State<(ProgressEvent<EventTarget> | null)[]>,
  () => void
] {
  return useBatchLoader<GLTFAsset>(urls, ResourceType.GLTF, entity)
}

/**
 *
 * GLTF loader function for when you need to load an asset in a non-React context.
 * The asset will be loaded through the ResourceManager in ResourceState.ts.
 * The asset will only be unloaded when onUnloadCallback is called, otherwise the asset will be leaked.
 *
 * @param url The URL of the GLTF file to load
 * @param entity *Optional* The entity that is loading the GLTF, defaults to UndefinedEntity
 * @param params *Optional* LoadingArgs that are passed through to the asset loader
 * @returns Promise of Tuple of [GLTF, onUnloadCallback, Error]
 */
export async function getGLTFAsync(
  url: string,
  entity?: Entity
): Promise<[GLTFAsset | null, () => void, ErrorEvent | Error | null]> {
  return getLoader<GLTFAsset>(url, ResourceType.GLTF, entity)
}

/**
 *
 * Texture loader hook for use in React Contexts.
 * The asset will be loaded through the ResourceManager in ResourceState.ts.
 * The asset will be unloaded and disposed when the component is unmounted or when onUnloadCallback is called.
 *
 * @param url The URL of the texture file to load
 * @param entity *Optional* The entity that is loading the texture, defaults to UndefinedEntity
 * @param params *Optional* LoadingArgs that are passed through to the asset loader
 * @param onUnload *Optional* A callback that is called when the URL is changed and the previous asset is unloaded, only needed for editor specific behavior
 * @returns Tuple of [Texture, Error, Progress, onUnloadCallback]
 */
export function useTexture(
  url: string,
  entity?: Entity,
  onUnload?: (url: string) => void
): [Texture | null, ErrorEvent | Error | null, ProgressEvent<EventTarget> | null, () => void] {
  return useLoader<Texture>(url, ResourceType.Texture, entity, onUnload)
}

/**
 *
 * Texture loader function for when you need to load an asset in a non-React context.
 * The asset will be loaded through the ResourceManager in ResourceState.ts.
 * The asset will only be unloaded when onUnloadCallback is called, otherwise the asset will be leaked.
 *
 * @param url The URL of the texture file to load
 * @param entity *Optional* The entity that is loading the texture, defaults to UndefinedEntity
 * @param params *Optional* LoadingArgs that are passed through to the asset loader
 * @returns Promise of Tuple of [Texture, onUnloadCallback, Error]
 */
export async function getTextureAsync(
  url: string,
  entity?: Entity
): Promise<[Texture | null, () => void, ErrorEvent | Error | null]> {
  return getLoader<Texture>(url, ResourceType.Texture, entity)
}

export async function getAudioAsync(
  url: string,
  entity?: Entity
): Promise<[AudioBuffer | null, () => void, ErrorEvent | Error | null]> {
  return getLoader<AudioBuffer>(url, ResourceType.Audio, entity)
}
