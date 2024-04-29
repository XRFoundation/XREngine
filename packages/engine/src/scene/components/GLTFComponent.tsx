import { parseStorageProviderURLs } from '@etherealengine/common/src/utils/parseSceneJSON'
import {
  ComponentJSONIDMap,
  Entity,
  EntityUUID,
  UUIDComponent,
  createEntity,
  defineComponent,
  getComponent,
  removeEntity,
  setComponent,
  useComponent,
  useEntityContext
} from '@etherealengine/ecs'
import {
  NO_PROXY,
  NO_PROXY_STEALTH,
  State,
  dispatchAction,
  getMutableState,
  useHookstate
} from '@etherealengine/hyperflux'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { GLTF } from '@gltf-transform/core'
import React, { useEffect } from 'react'
import { FileLoader } from '../../assets/loaders/base/FileLoader'
import {
  BINARY_EXTENSION_HEADER_MAGIC,
  EXTENSIONS,
  GLTFBinaryExtension
} from '../../assets/loaders/gltf/GLTFExtensions'
import { GLTFDocumentState, GLTFSnapshotAction } from '../GLTFDocumentState'
import { SourceComponent } from './SourceComponent'

export const GLTFComponent = defineComponent({
  name: 'GLTFComponent',

  onInit(entity) {
    return {
      src: ''
    }
  },

  onSet(entity, component, json) {
    if (typeof json?.src === 'string') component.src.set(json.src)
  },

  reactor: () => {
    const entity = useEntityContext()
    const gltfComponent = useComponent(entity, GLTFComponent)

    const [resource, progress, error] = useGLTFDocument(gltfComponent.src.value)

    console.log(gltfComponent.src.value)

    useEffect(() => {
      if (!resource) return

      /** Add snapshot only off network load */
      dispatchAction(
        GLTFSnapshotAction.createSnapshot({
          source: getComponent(entity, SourceComponent),
          data: parseStorageProviderURLs(resource)
        })
      )

      console.log(resource)
      return () => {
        console.log('cleanup')
      }
    }, [resource])

    const source = useComponent(entity, SourceComponent).value
    const gltfDocumentState = useHookstate(getMutableState(GLTFDocumentState)[source])

    const parentUUID = useComponent(entity, UUIDComponent).value

    if (!gltfDocumentState.value) return null

    return <DocumentReactor documentID={source} parentUUID={parentUUID} />
  }
})

const onError = (error: ErrorEvent) => {
  console.error(error)
}

const onProgress: (event: ProgressEvent) => void = (event) => {
  console.log(event)
}

const useGLTFDocument = (url: string) => {
  const state = useHookstate({
    document: null as GLTF.IGLTF | null,
    progress: 0,
    errorVal: null
  })

  useEffect(() => {
    if (!url) return

    const abortController = new AbortController()
    const signal = abortController.signal

    const loader = new FileLoader()

    loader.setResponseType('arraybuffer')
    loader.setRequestHeader({})
    loader.setWithCredentials(false)

    loader.load(
      url,
      function (data: string | ArrayBuffer | GLTF.IGLTF) {
        if (signal.aborted) return

        const extensions = {}
        const textDecoder = new TextDecoder()
        let json: GLTF.IGLTF

        if (typeof data === 'string') {
          json = JSON.parse(data)
        } else if (data instanceof ArrayBuffer) {
          const magic = textDecoder.decode(new Uint8Array(data, 0, 4))

          if (magic === BINARY_EXTENSION_HEADER_MAGIC) {
            try {
              /** TODO we will need to refactor and persist this */
              extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data)
            } catch (error) {
              if (onError) onError(error)
              return
            }

            json = JSON.parse(extensions[EXTENSIONS.KHR_BINARY_GLTF].content)
          } else {
            json = JSON.parse(textDecoder.decode(data))
          }
        } else {
          json = data
        }

        state.document.set(json)
      },
      onProgress,
      onError,
      signal
    )
    return () => {
      abortController.abort()
      state.set({
        document: null,
        progress: 0,
        errorVal: null
      })
    }
  }, [url])

  return [state.document.get(NO_PROXY), state.progress.value, state.errorVal.value] as [
    GLTF.IGLTF | null,
    number,
    ErrorEvent | null
  ]
}

const DocumentReactor = (props: { documentID: string; parentUUID: EntityUUID }) => {
  const documentState = useHookstate(getMutableState(GLTFDocumentState)[props.documentID])
  if (!documentState.value) return null
  if (!documentState.scenes.value) return null

  const scenes = documentState.scenes.value
  const scene = scenes[documentState.scene.value!]

  return (
    <>
      {scene.nodes.map((nodeIndex) => (
        <NodeReactor
          key={nodeIndex}
          nodeIndex={nodeIndex}
          parentUUID={props.parentUUID}
          documentID={props.documentID}
        />
      ))}
    </>
  )
}

const NodeReactor = (props: { nodeIndex: number; parentUUID: EntityUUID; documentID: string }) => {
  const documentState = useHookstate(getMutableState(GLTFDocumentState)[props.documentID])
  const nodes = documentState.nodes! as State<GLTF.INode[]>

  const node = nodes[props.nodeIndex]!

  const entity = useHookstate(() => {
    const uuidExtension = node.extensions.value?.[UUIDComponent.jsonID] as EntityUUID | undefined
    const entity = createEntity()
    setComponent(entity, UUIDComponent, uuidExtension ?? UUIDComponent.generateUUID())
    return entity
  })

  const uuid = getComponent(entity.value, UUIDComponent)
  const parentEntity = UUIDComponent.getEntityByUUID(props.parentUUID)

  useEffect(() => {
    return () => {
      removeEntity(entity.value)
    }
  }, [])

  useEffect(() => {
    setComponent(entity.value, EntityTreeComponent, { parentEntity })
  }, [parentEntity])

  useEffect(() => {
    setComponent(entity.value, NameComponent, node.name.value)
  }, [node.name])

  return (
    <>
      {node.children.value?.map((childIndex) => (
        <NodeReactor key={childIndex} nodeIndex={childIndex} parentUUID={uuid} documentID={props.documentID} />
      ))}
      {node.extensions.value &&
        Object.keys(node.extensions.get(NO_PROXY)!).map((extension) => (
          <ExtensionReactor
            key={extension}
            entity={entity.value}
            extension={extension}
            nodeIndex={props.nodeIndex}
            documentID={props.documentID}
          />
        ))}
    </>
  )
}

const ExtensionReactor = (props: { entity: Entity; extension: string; nodeIndex: number; documentID: string }) => {
  const documentState = useHookstate(getMutableState(GLTFDocumentState)[props.documentID])
  const nodes = documentState.nodes! as State<GLTF.INode[]>
  const node = nodes[props.nodeIndex]!

  const extension = node.extensions![props.extension]

  useEffect(() => {
    const Component = ComponentJSONIDMap.get(props.extension)
    if (!Component) return console.warn('no component found for extension', props.extension)
    setComponent(props.entity, Component, extension.get(NO_PROXY_STEALTH))
    console.log('loaded extension', props.documentID, props.nodeIndex, props.extension)
  }, [extension])

  return null
}
