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

import React, { useEffect } from 'react'
import {
  Box3,
  DoubleSide,
  Material,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Sphere,
  Vector3
} from 'three'

import config from '@etherealengine/common/src/config'
import { defineState, getMutableState, getState, hookstate, useHookstate } from '@etherealengine/hyperflux'

import { isClient } from '@etherealengine/common/src/utils/getEnvironment'
import { Engine, UUIDComponent } from '@etherealengine/ecs'
import {
  getComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  setComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { Entity, UndefinedEntity } from '@etherealengine/ecs/src/Entity'
import { createEntity, removeEntity, useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { QueryReactor, defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem, useExecute } from '@etherealengine/ecs/src/SystemFunctions'
import { AnimationSystemGroup } from '@etherealengine/ecs/src/SystemGroups'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { Vector3_Back } from '@etherealengine/spatial/src/common/constants/MathConstants'
import {
  createPriorityQueue,
  createSortAndApplyPriorityQueue
} from '@etherealengine/spatial/src/common/functions/PriorityQueue'
import { RendererState } from '@etherealengine/spatial/src/renderer/RendererState'
import { RendererComponent } from '@etherealengine/spatial/src/renderer/WebGLRendererSystem'
import { DirectionalLightComponent } from '@etherealengine/spatial/src/renderer/components/DirectionalLightComponent'
import { GroupComponent, addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { MeshComponent } from '@etherealengine/spatial/src/renderer/components/MeshComponent'
import { ObjectLayerComponents } from '@etherealengine/spatial/src/renderer/components/ObjectLayerComponent'
import { useScene } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { ObjectLayers } from '@etherealengine/spatial/src/renderer/constants/ObjectLayers'
import { CSM } from '@etherealengine/spatial/src/renderer/csm/CSM'
import { CSMHelper } from '@etherealengine/spatial/src/renderer/csm/CSMHelper'
import {
  getShadowsEnabled,
  useShadowsEnabled
} from '@etherealengine/spatial/src/renderer/functions/RenderSettingsFunction'
import { compareDistanceToCamera } from '@etherealengine/spatial/src/transform/components/DistanceComponents'
import {
  EntityTreeComponent,
  iterateEntityNode,
  useTreeQuery
} from '@etherealengine/spatial/src/transform/components/EntityTree'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import { XRLightProbeState } from '@etherealengine/spatial/src/xr/XRLightProbeSystem'
import { isMobileXRHeadset } from '@etherealengine/spatial/src/xr/XRState'
import { useTexture } from '../../assets/functions/resourceHooks'
import { DropShadowComponent } from '../components/DropShadowComponent'
import { useMeshOrModel } from '../components/ModelComponent'
import { RenderSettingsComponent } from '../components/RenderSettingsComponent'
import { ShadowComponent } from '../components/ShadowComponent'
import { SceneObjectSystem } from './SceneObjectSystem'

export const ShadowSystemState = defineState({
  name: 'ee.engine.scene.ShadowSystemState',
  initial: () => {
    const accumulationBudget = isMobileXRHeadset ? 4 : 20

    const priorityQueue = createPriorityQueue({
      accumulationBudget
    })

    return {
      priorityQueue
    }
  }
})

export const shadowDirection = new Vector3(0, -1, 0)
const shadowRotation = new Quaternion()
const raycaster = new Raycaster()
raycaster.firstHitOnly = true
const raycasterPosition = new Vector3()

const EntityCSMReactor = (props: { entity: Entity; rendererEntity: Entity }) => {
  const { entity, rendererEntity } = props
  const renderSettings = useComponent(entity, RenderSettingsComponent)
  const rendererComponent = useComponent(rendererEntity, RendererComponent)

  const directionalLightComponent = useComponent(entity, DirectionalLightComponent)
  const shadowMapResolution = useHookstate(getMutableState(RendererState).shadowMapResolution)

  const directionalLight = directionalLightComponent.light.value

  const csm = rendererComponent.csm.value

  useEffect(() => {
    if (!directionalLightComponent.value) return
    const csm = new CSM({
      light: directionalLight,
      shadowBias: directionalLightComponent.shadowBias.value,
      maxFar: directionalLightComponent.cameraFar.value,
      lightIntensity: directionalLightComponent.intensity.value,
      cascades: renderSettings.cascades.value
    })
    rendererComponent.csm.set(csm)
    return () => {
      csm.dispose()
      rendererComponent.csm.set(null)
    }
  }, [directionalLightComponent.castShadow])

  /** Must run after scene object system to ensure source light is not lit */
  useExecute(
    () => {
      directionalLight.visible = false
    },
    { after: SceneObjectSystem }
  )

  useEffect(() => {
    if (!csm) return

    csm.shadowBias = directionalLight.shadow.bias

    for (const light of csm.lights) {
      light.color.copy(directionalLightComponent.color.value)
      light.intensity = directionalLightComponent.intensity.value
      light.shadow.bias = directionalLightComponent.shadowBias.value
      light.shadow.mapSize.setScalar(shadowMapResolution.value)
      csm.needsUpdate = true
    }
  }, [
    csm,
    shadowMapResolution,
    directionalLightComponent?.shadowBias,
    directionalLightComponent?.intensity,
    directionalLightComponent?.color,
    directionalLightComponent?.castShadow,
    directionalLightComponent?.shadowRadius,
    directionalLightComponent?.cameraFar
  ])

  useEffect(() => {
    if (!csm) return
    csm.cascades = renderSettings.cascades.value
    csm.needsUpdate = true
  }, [csm, renderSettings.cascades])

  return <ChildCSMReactor rendererEntity={rendererEntity} />
}

const PlainCSMReactor = (props: { rendererEntity: Entity }) => {
  const { rendererEntity } = props
  const rendererComponent = useComponent(rendererEntity, RendererComponent)
  const shadowMapResolution = useHookstate(getMutableState(RendererState).shadowMapResolution)

  useEffect(() => {
    const csm = new CSM({
      shadowMapSize: shadowMapResolution.value
    })

    rendererComponent.csm.set(csm)

    return () => {
      csm.dispose()
      rendererComponent.csm.set(null)
    }
  }, [])

  useEffect(() => {
    const csm = rendererComponent.csm.value
    if (!csm) return

    for (const light of csm.lights) {
      light.shadow.mapSize.setScalar(shadowMapResolution.value)
      light.shadow.camera.updateProjectionMatrix()
      light.shadow.map?.dispose()
      light.shadow.map = null as any
      light.shadow.needsUpdate = true
    }
  }, [rendererComponent.csm, shadowMapResolution])

  return <ChildCSMReactor rendererEntity={rendererEntity} />
}

const ChildCSMReactor = (props: { rendererEntity: Entity }) => {
  const entities = useTreeQuery(props.rendererEntity)
  return (
    <>
      {entities.map((entity) => (
        <EntityChildCSMReactor key={entity} entity={entity} rendererEntity={props.rendererEntity} />
      ))}
    </>
  )
}

const EntityChildCSMReactor = (props: { entity: Entity; rendererEntity: Entity }) => {
  const { entity, rendererEntity } = props

  const shadowComponent = useComponent(entity, ShadowComponent)
  const groupComponent = useComponent(entity, GroupComponent)
  const csm = useComponent(rendererEntity, RendererComponent).csm.value

  useEffect(() => {
    if (!csm || !shadowComponent.receive.value) return

    const objs = [...groupComponent.value] as Mesh<any, Material>[]
    for (const obj of objs) {
      if (obj.material) {
        csm.setupMaterial(obj)
      }
    }

    return () => {
      for (const obj of objs) {
        if (obj.material) {
          csm.teardownMaterial(obj.material)
        }
      }
    }
  }, [shadowComponent.receive, csm])

  return null
}

function _CSMReactor() {
  const renderSettingsEntity = useEntityContext()
  const rendererEntity = useScene(renderSettingsEntity)

  if (!rendererEntity) return null

  return <CSMReactor renderSettingsEntity={renderSettingsEntity} rendererEntity={rendererEntity} />
}

function CSMReactor(props: { renderSettingsEntity: Entity; rendererEntity: Entity }) {
  const { renderSettingsEntity, rendererEntity } = props
  const rendererComponent = useComponent(rendererEntity, RendererComponent)

  const renderSettingsComponent = useComponent(renderSettingsEntity, RenderSettingsComponent)

  const xrLightProbeEntity = useHookstate(getMutableState(XRLightProbeState).directionalLightEntity)

  const activeLightEntity = useHookstate(UndefinedEntity)

  const rendererState = useHookstate(getMutableState(RendererState))

  useEffect(() => {
    if (!rendererComponent) return
    if (!rendererComponent.csm.value || !rendererState.nodeHelperVisibility.value) return

    const helper = new CSMHelper()
    rendererComponent.csmHelper.set(helper)
    return () => {
      helper.remove()
      rendererComponent.csmHelper.set(null)
    }
  }, [rendererComponent, renderSettingsComponent?.csm, rendererState.nodeHelperVisibility])

  useEffect(() => {
    if (rendererEntity === Engine.instance.viewerEntity && xrLightProbeEntity.value) {
      activeLightEntity.set(xrLightProbeEntity.value)
      return
    }

    if (renderSettingsComponent?.primaryLight.value) {
      activeLightEntity.set(UUIDComponent.getEntityByUUID(renderSettingsComponent.primaryLight.value))
      return
    }

    activeLightEntity.set(UndefinedEntity)
  }, [xrLightProbeEntity.value, renderSettingsComponent?.primaryLight?.value])

  if (!renderSettingsComponent?.csm.value) return null

  if (!activeLightEntity.value) return <PlainCSMReactor rendererEntity={rendererEntity} key={rendererEntity} />

  return (
    <EntityCSMReactor entity={activeLightEntity.value} rendererEntity={rendererEntity} key={activeLightEntity.value} />
  )
}

const shadowGeometry = new PlaneGeometry(1, 1, 1, 1).rotateX(-Math.PI)
const shadowMaterial = new MeshBasicMaterial({
  side: DoubleSide,
  transparent: true,
  opacity: 1,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: 0.01
})

const shadowState = hookstate(null as MeshBasicMaterial | null)

const dropShadowComponentQuery = defineQuery([DropShadowComponent])

const minRadius = 0.15
const maxRadius = 5
const sphere = new Sphere()
const box3 = new Box3()
const vec3 = new Vector3()

const DropShadowReactor = () => {
  const entity = useEntityContext()
  const shadowMaterial = useHookstate(shadowState)
  const isMeshOrModel = useMeshOrModel(entity)
  const shadow = useComponent(entity, ShadowComponent)
  const entityTree = useComponent(entity, EntityTreeComponent)

  useEffect(() => {
    if (!shadow.cast.value || !shadowMaterial.value || !isMeshOrModel || hasComponent(entity, DropShadowComponent))
      return

    box3.makeEmpty()

    let foundMesh = false

    iterateEntityNode(entity, (child) => {
      const mesh = getOptionalComponent(child, MeshComponent)
      if (mesh) {
        box3.expandByObject(mesh)
        foundMesh = true
      }
    })

    if (!foundMesh) return

    box3.getBoundingSphere(sphere)

    if (sphere.radius > maxRadius) return

    const radius = Math.max(sphere.radius * 2, minRadius)
    const center = sphere.center.sub(TransformComponent.getWorldPosition(entity, vec3))
    const shadowEntity = createEntity()
    const shadowObject = new Mesh(shadowGeometry, shadowMaterial.value.clone())
    addObjectToGroup(shadowEntity, shadowObject)
    setComponent(shadowEntity, NameComponent, 'Shadow for ' + getComponent(entity, NameComponent))
    setComponent(shadowEntity, VisibleComponent)
    setComponent(entity, DropShadowComponent, { radius, center, entity: shadowEntity })

    return () => {
      removeComponent(entity, DropShadowComponent)
      removeEntity(shadowEntity)
    }
  }, [shadowMaterial, isMeshOrModel, shadow, entityTree.children])

  return null
}

const shadowOffset = new Vector3(0, 0.01, 0)

const sortAndApplyPriorityQueue = createSortAndApplyPriorityQueue(dropShadowComponentQuery, compareDistanceToCamera)
const sortedEntityTransforms = [] as Entity[]

const cameraLayerQuery = defineQuery([ObjectLayerComponents[ObjectLayers.Camera], MeshComponent])

const updateDropShadowTransforms = () => {
  const { deltaSeconds } = getState(ECSState)
  const { priorityQueue } = getState(ShadowSystemState)

  sortAndApplyPriorityQueue(priorityQueue, sortedEntityTransforms, deltaSeconds)

  const sceneObjects = cameraLayerQuery().flatMap((entity) => getComponent(entity, MeshComponent))

  for (const entity of priorityQueue.priorityEntities) {
    const dropShadow = getComponent(entity, DropShadowComponent)
    const dropShadowTransform = getComponent(dropShadow.entity, TransformComponent)

    TransformComponent.getWorldPosition(entity, raycasterPosition).add(dropShadow.center)
    raycaster.set(raycasterPosition, shadowDirection)

    const intersected = raycaster.intersectObjects(sceneObjects, false)[0]
    if (!intersected || !intersected.face) {
      dropShadowTransform.scale.setScalar(0)
      continue
    }

    const centerCorrectedDist = Math.max(intersected.distance - dropShadow.center.y, 0.0001)

    //arbitrary bias to make it a bit smaller
    const sizeBias = 0.3
    const finalRadius = sizeBias * dropShadow.radius + dropShadow.radius * centerCorrectedDist * 0.5

    const shadowMaterial = (getComponent(dropShadow.entity, GroupComponent)[0] as any).material as Material
    shadowMaterial.opacity = Math.min(1 / (1 + centerCorrectedDist), 1) * 0.6

    shadowRotation.setFromUnitVectors(intersected.face.normal, Vector3_Back)
    dropShadowTransform.rotation.copy(shadowRotation)
    dropShadowTransform.scale.setScalar(finalRadius * 2)
    dropShadowTransform.position.copy(intersected.point).add(shadowOffset)
  }
}

const groupQuery = defineQuery([GroupComponent, VisibleComponent, ShadowComponent])
const rendererQuery = defineQuery([RendererComponent])

const execute = () => {
  if (!isClient) return

  const useShadows = getShadowsEnabled()
  if (!useShadows) {
    updateDropShadowTransforms()
    return
  }

  for (const entity of rendererQuery()) {
    const { csm, csmHelper } = getComponent(entity, RendererComponent)
    if (csm) {
      csm.update()
      if (csmHelper) csmHelper.update(csm)

      /** hack fix to ensure CSM material is applied to all materials (which are not set reactively) */
      for (const entity of groupQuery()) {
        for (const obj of getComponent(entity, GroupComponent) as any as Mesh[]) {
          if (obj.material && obj.receiveShadow) csm.setupMaterial(obj)
        }
      }
    }
  }
}

const RendererShadowReactor = () => {
  const entity = useEntityContext()
  const useShadows = useShadowsEnabled()

  useEffect(() => {
    const renderer = getComponent(entity, RendererComponent).renderer
    renderer.shadowMap.enabled = renderer.shadowMap.autoUpdate = useShadows
  }, [useShadows])

  return null
}

const reactor = () => {
  if (!isClient) return null

  const useShadows = useShadowsEnabled()

  const [shadowTexture] = useTexture(`${config.client.fileServer}/projects/default-project/assets/drop-shadow.png`)

  useEffect(() => {
    if (!shadowTexture) return
    shadowMaterial.map = shadowTexture
    shadowMaterial.needsUpdate = true
    shadowState.set(shadowMaterial)
  }, [shadowTexture])

  return (
    <>
      {useShadows ? (
        <QueryReactor Components={[RenderSettingsComponent]} ChildEntityReactor={_CSMReactor} />
      ) : (
        <QueryReactor Components={[VisibleComponent, ShadowComponent]} ChildEntityReactor={DropShadowReactor} />
      )}
      <QueryReactor Components={[RendererComponent]} ChildEntityReactor={RendererShadowReactor} />
    </>
  )
}

export const ShadowSystem = defineSystem({
  uuid: 'ee.engine.ShadowSystem',
  insert: { with: AnimationSystemGroup },
  execute,
  reactor
})
