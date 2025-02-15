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
import { ArrowHelper, Clock, MathUtils, Matrix4, Raycaster, Vector3 } from 'three'

import { defineQuery, ECSState, Engine, useEntityContext } from '@etherealengine/ecs'
import {
  defineComponent,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  removeComponent,
  setComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity, UndefinedEntity } from '@etherealengine/ecs/src/Entity'
import { getState, matches, useImmediateEffect } from '@etherealengine/hyperflux'

import { createConeOfVectors } from '../../common/functions/MathFunctions'
import { smoothDamp, smootheLerpAlpha } from '../../common/functions/MathLerpFunctions'
import { MeshComponent } from '../../renderer/components/MeshComponent'
import { ObjectLayerComponents } from '../../renderer/components/ObjectLayerComponent'
import { VisibleComponent } from '../../renderer/components/VisibleComponent'
import { ObjectLayers } from '../../renderer/constants/ObjectLayers'
import { ComputedTransformComponent } from '../../transform/components/ComputedTransformComponent'
import { TransformComponent } from '../../transform/components/TransformComponent'
import { CameraSettingsState } from '../CameraSceneMetadata'
import { setTargetCameraRotation } from '../functions/CameraFunctions'
import { FollowCameraMode, FollowCameraShoulderSide } from '../types/FollowCameraMode'
import { TargetCameraRotationComponent } from './TargetCameraRotationComponent'

export const coneDebugHelpers: ArrowHelper[] = []

const window = 'window' in globalThis ? globalThis.window : ({} as any as Window)

export const FollowCameraComponent = defineComponent({
  name: 'FollowCameraComponent',
  onInit: (entity) => {
    /** @todo add a reactor to dynamically update to these values */
    const cameraSettings = getState(CameraSettingsState)

    // if (cameraSettings.projectionType === ProjectionType.Orthographic) {
    //   camera.camera = new OrthographicCamera(
    //     data.fov / -2,
    //     data.fov / 2,
    //     data.fov / 2,
    //     data.fov / -2,
    //     data.cameraNearClip,
    //     data.cameraFarClip
    //   )
    // } else if ((camera.camera as PerspectiveCamera).fov) {
    //   ;(camera.camera as PerspectiveCamera).fov = data.fov ?? 50
    // }

    const cameraRays = [] as Vector3[]
    const rayConeAngle = Math.PI / 12
    const camRayCastClock = new Clock()
    const camRayCastCache = {
      maxDistance: -1,
      targetHit: false
    }

    const raycastProps = {
      enabled: true,
      rayCount: 3,
      rayLength: 15.0,
      rayFrequency: 0.1,
      rayConeAngle,
      camRayCastClock,
      camRayCastCache,
      cameraRays
    }

    for (let i = 0; i < raycastProps.rayCount; i++) {
      cameraRays.push(new Vector3())
    }

    const windowHeight = 'innerHeight' in window ? window.innerHeight : 1
    const windowWidth = 'innerWidth' in window ? window.innerWidth : 2
    const distance = (windowHeight / windowWidth) * cameraSettings.startCameraDistance

    return {
      firstPersonOffset: new Vector3(),
      thirdPersonOffset: new Vector3(),
      currentOffset: new Vector3(),
      offsetSmoothness: 0.1,
      targetEntity: UndefinedEntity,
      currentTargetPosition: new Vector3(),
      targetPositionSmoothness: 0,
      mode: FollowCameraMode.ThirdPerson,
      allowedModes: [
        FollowCameraMode.ThirdPerson,
        FollowCameraMode.FirstPerson,
        FollowCameraMode.TopDown,
        FollowCameraMode.ShoulderCam
      ],
      // map portrait window to further distance, landscape to closer distance
      distance: distance,
      targetDistance: distance,
      zoomVelocity: { value: 0 },
      thirdPersonMinDistance: cameraSettings.minCameraDistance,
      thirdPersonMaxDistance: cameraSettings.maxCameraDistance,
      effectiveMinDistance: cameraSettings.minCameraDistance,
      effectiveMaxDistance: cameraSettings.maxCameraDistance,
      theta: 180,
      phi: 10,
      minPhi: cameraSettings.minPhi,
      maxPhi: cameraSettings.maxPhi,
      locked: false,
      enabled: true,
      shoulderSide: FollowCameraShoulderSide.Left,
      raycastProps,
      accumulatedZoomTriggerDebounceTime: -1,
      lastZoomStartDistance: (cameraSettings.minCameraDistance + cameraSettings.minCameraDistance) / 2
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return

    if (typeof json.firstPersonOffset !== 'undefined') component.firstPersonOffset.set(json.firstPersonOffset)
    if (typeof json.thirdPersonOffset !== 'undefined') component.thirdPersonOffset.set(json.thirdPersonOffset)
    if (typeof json.targetEntity !== 'undefined') component.targetEntity.set(json.targetEntity)
    if (typeof json.mode === 'string') component.mode.set(json.mode)
    if (matches.arrayOf(matches.string).test(json.allowedModes)) component.allowedModes.set(json.allowedModes)
    if (typeof json.distance !== 'undefined') component.distance.set(json.distance)
    if (typeof json.targetDistance !== 'undefined') component.targetDistance.set(json.targetDistance)
    if (typeof json.zoomVelocity !== 'undefined') component.zoomVelocity.set(json.zoomVelocity)
    if (typeof json.thirdPersonMinDistance !== 'undefined')
      component.thirdPersonMinDistance.set(json.thirdPersonMinDistance)
    if (typeof json.thirdPersonMaxDistance !== 'undefined')
      component.thirdPersonMaxDistance.set(json.thirdPersonMaxDistance)
    if (typeof json.theta !== 'undefined') component.theta.set(json.theta)
    if (typeof json.phi !== 'undefined') component.phi.set(json.phi)
    if (typeof json.minPhi !== 'undefined') component.minPhi.set(json.minPhi)
    if (typeof json.maxPhi !== 'undefined') component.maxPhi.set(json.maxPhi)
    if (typeof json.shoulderSide !== 'undefined') component.shoulderSide.set(json.shoulderSide)
  },

  reactor: () => {
    const entity = useEntityContext()
    const follow = useComponent(entity, FollowCameraComponent)

    useEffect(() => {
      const followCamera = getComponent(entity, FollowCameraComponent)
      setComponent(entity, ComputedTransformComponent, {
        referenceEntities: [followCamera.targetEntity],
        computeFunction: () => computeCameraFollow(entity, followCamera.targetEntity)
      })

      return () => {
        removeComponent(entity, ComputedTransformComponent)
      }
    }, [])

    useImmediateEffect(() => {
      if (follow.mode.value === FollowCameraMode.FirstPerson) {
        follow.targetDistance.set(0)
      }
    }, [follow.mode])

    return null
  }
})

const targetPosition = new Vector3()
const direction = new Vector3()
const upVector = new Vector3(0, 1, 0)
const empty = new Vector3()
const mx = new Matrix4()
const tempVec1 = new Vector3()
const raycaster = new Raycaster()

const MODE_SWITCH_DEBOUNCE = 0.03

const computeCameraFollow = (cameraEntity: Entity, referenceEntity: Entity) => {
  const follow = getComponent(cameraEntity, FollowCameraComponent)
  const followState = getMutableComponent(cameraEntity, FollowCameraComponent)
  const cameraTransform = getComponent(cameraEntity, TransformComponent)
  const targetTransform = getComponent(referenceEntity, TransformComponent)

  if (!targetTransform || !follow || !follow?.enabled) return

  // Limit the pitch
  follow.phi = Math.min(follow.maxPhi, Math.max(follow.minPhi, follow.phi))

  let isInsideWall = false

  const offsetAlpha = smootheLerpAlpha(follow.offsetSmoothness, getState(ECSState).deltaSeconds)
  const targetOffset =
    follow.mode === FollowCameraMode.FirstPerson ? follow.firstPersonOffset : follow.thirdPersonOffset
  follow.currentOffset.lerp(targetOffset, offsetAlpha)

  targetPosition
    .copy(follow.currentOffset)
    .applyQuaternion(TransformComponent.getWorldRotation(referenceEntity, targetTransform.rotation))
    .add(TransformComponent.getWorldPosition(referenceEntity, new Vector3()))

  const targetPositionAlpha = smootheLerpAlpha(follow.targetPositionSmoothness, getState(ECSState).deltaSeconds)
  follow.currentTargetPosition.lerp(targetPosition, targetPositionAlpha)

  // Run only if not in first person mode
  let obstacleDistance = Infinity
  if (follow.raycastProps.enabled && follow.mode !== FollowCameraMode.FirstPerson) {
    const distanceResults = getMaxCamDistance(cameraEntity, follow.currentTargetPosition)
    if (distanceResults.maxDistance > 0.1) {
      obstacleDistance = distanceResults.maxDistance
    }
    isInsideWall = distanceResults.targetHit
  }

  if (follow.mode === FollowCameraMode.FirstPerson) {
    follow.effectiveMinDistance = follow.effectiveMaxDistance = 0
  } else if (follow.mode === FollowCameraMode.ThirdPerson || follow.mode === FollowCameraMode.ShoulderCam) {
    follow.effectiveMaxDistance = Math.min(obstacleDistance * 0.8, follow.thirdPersonMaxDistance)
    follow.effectiveMinDistance = Math.min(follow.thirdPersonMinDistance, follow.effectiveMaxDistance)
  } else if (follow.mode === FollowCameraMode.TopDown) {
    follow.effectiveMinDistance = follow.effectiveMaxDistance = Math.min(
      obstacleDistance * 0.9,
      follow.thirdPersonMaxDistance
    )
  }

  let newZoomDistance = Math.max(
    Math.min(follow.targetDistance, follow.effectiveMaxDistance),
    follow.effectiveMinDistance
  )

  const constrainTargetDistance = follow.accumulatedZoomTriggerDebounceTime === -1

  if (constrainTargetDistance) {
    follow.targetDistance = newZoomDistance
  }

  const triggerZoomShift = follow.accumulatedZoomTriggerDebounceTime > MODE_SWITCH_DEBOUNCE

  const minSpringFactor =
    Math.min(
      Math.sqrt(Math.abs(follow.targetDistance - follow.effectiveMinDistance)) *
        Math.sign(follow.targetDistance - follow.effectiveMinDistance),
      0
    ) * 0.5

  const maxSpringFactor =
    Math.max(
      Math.sqrt(Math.abs(follow.targetDistance - follow.effectiveMaxDistance)) *
        Math.sign(follow.targetDistance - follow.effectiveMaxDistance),
      0
    ) * 0.5

  if (follow.mode === FollowCameraMode.FirstPerson) {
    newZoomDistance = Math.sqrt(follow.targetDistance) * 0.5
    // Move from first person mode to third person mode
    if (triggerZoomShift) {
      follow.accumulatedZoomTriggerDebounceTime = -1
      if (
        follow.allowedModes.includes(FollowCameraMode.ThirdPerson) &&
        newZoomDistance > 0.1 * follow.thirdPersonMinDistance
      ) {
        // setup third person mode
        setTargetCameraRotation(cameraEntity, 0, follow.theta)
        followState.mode.set(FollowCameraMode.ThirdPerson)
        follow.targetDistance = newZoomDistance = follow.thirdPersonMinDistance
      } else {
        // reset first person mode
        follow.targetDistance = newZoomDistance = 0
      }
    }
  } else if (follow.mode === FollowCameraMode.ThirdPerson) {
    newZoomDistance = newZoomDistance + minSpringFactor + maxSpringFactor
    if (triggerZoomShift) {
      follow.accumulatedZoomTriggerDebounceTime = -1
      if (
        // Move from third person mode to first person mode
        follow.allowedModes.includes(FollowCameraMode.FirstPerson) &&
        follow.targetDistance < follow.effectiveMinDistance - follow.effectiveMaxDistance * 0.05 &&
        Math.abs(follow.lastZoomStartDistance - follow.effectiveMinDistance) < follow.effectiveMaxDistance * 0.05
      ) {
        setTargetCameraRotation(cameraEntity, 0, follow.theta)
        followState.mode.set(FollowCameraMode.FirstPerson)
        follow.targetDistance = newZoomDistance = 0
      } else if (
        // Move from third person mode to top down mode
        follow.allowedModes.includes(FollowCameraMode.TopDown) &&
        follow.targetDistance > follow.effectiveMaxDistance + follow.effectiveMaxDistance * 0.02 &&
        Math.abs(follow.lastZoomStartDistance - follow.effectiveMaxDistance) < follow.effectiveMaxDistance * 0.02
      ) {
        setTargetCameraRotation(cameraEntity, 85, follow.theta)
        followState.mode.set(FollowCameraMode.TopDown)
        follow.targetDistance = newZoomDistance = follow.effectiveMaxDistance
      } else {
        follow.targetDistance = newZoomDistance = Math.max(
          Math.min(follow.targetDistance, follow.effectiveMaxDistance),
          follow.effectiveMinDistance
        )
      }
    }
  } else if (follow.mode === FollowCameraMode.TopDown) {
    newZoomDistance += minSpringFactor + maxSpringFactor * 0.1
    // Move from top down mode to third person mode
    if (triggerZoomShift) {
      follow.accumulatedZoomTriggerDebounceTime = -1
      if (
        follow.allowedModes.includes(FollowCameraMode.ThirdPerson) &&
        newZoomDistance < follow.effectiveMaxDistance * 0.98 &&
        Math.abs(follow.lastZoomStartDistance - follow.effectiveMaxDistance) < 0.05 * follow.effectiveMaxDistance
      ) {
        setTargetCameraRotation(cameraEntity, 0, follow.theta)
        followState.mode.set(FollowCameraMode.ThirdPerson)
      }
      follow.targetDistance = newZoomDistance = follow.effectiveMaxDistance
    }
  }

  // // Move from third person mode to top down mode
  // if (allowModeShift && follow.mode === FollowCameraMode.ThirdPerson &&
  //     follow.allowedModes.includes(FollowCameraMode.TopDown) &&
  //     follow.targetDistance >= 1.1 * follow.thirdPersonMaxDistance) {
  //   setTargetCameraRotation(cameraEntity, 90, follow.theta)
  //   followState.mode.set(FollowCameraMode.TopDown)
  // }

  // // Rotate camera to the top but let the player rotate if he/she desires
  // if (Math.abs(follow.thirdPersonMaxDistance - nextTargetDistance) <= 1.0 && scrollDelta > 0 && follow) {
  //   setTargetCameraRotation(cameraEntity, 85, follow.theta)
  // }

  // // Rotate from top
  // if (Math.abs(follow.thirdPersonMaxDistance - follow.targetDistance) <= 1.0 && scrollDelta < 0 && follow.phi >= 80) {
  //   setTargetCameraRotation(cameraEntity, 45, follow.theta)
  // }

  // if (Math.abs(follow.targetDistance - nextTargetDistance) > epsilon) {
  //   follow.targetDistance = nextTargetDistance
  // }

  // Zoom smoothing
  const smoothingSpeed = isInsideWall ? 0.1 : 0.3
  const deltaSeconds = getState(ECSState).deltaSeconds

  follow.distance = smoothDamp(follow.distance, newZoomDistance, follow.zoomVelocity, smoothingSpeed, deltaSeconds)

  const theta = follow.theta
  const thetaRad = MathUtils.degToRad(theta)
  const phiRad = MathUtils.degToRad(follow.phi)

  direction.set(Math.sin(thetaRad) * Math.cos(phiRad), Math.sin(phiRad), Math.cos(thetaRad) * Math.cos(phiRad))

  cameraTransform.position.set(
    follow.currentTargetPosition.x + follow.distance * direction.x,
    follow.currentTargetPosition.y + follow.distance * direction.y,
    follow.currentTargetPosition.z + follow.distance * direction.z
  )

  mx.lookAt(direction, empty, upVector)
  cameraTransform.rotation.setFromRotationMatrix(mx)

  updateCameraTargetRotation(cameraEntity)
}

const updateCameraTargetRotation = (cameraEntity: Entity) => {
  if (!cameraEntity) return
  const followCamera = getComponent(cameraEntity, FollowCameraComponent)
  const target = getOptionalComponent(cameraEntity, TargetCameraRotationComponent)
  if (!target) return

  const epsilon = 0.001

  target.phi = Math.min(followCamera.maxPhi, Math.max(followCamera.minPhi, target.phi))

  if (Math.abs(target.phi - followCamera.phi) < epsilon && Math.abs(target.theta - followCamera.theta) < epsilon) {
    removeComponent(followCamera.targetEntity, TargetCameraRotationComponent)
    return
  }

  const delta = getState(ECSState).deltaSeconds
  if (!followCamera.locked) {
    followCamera.phi = smoothDamp(followCamera.phi, target.phi, target.phiVelocity, target.time, delta)
    followCamera.theta = smoothDamp(followCamera.theta, target.theta, target.thetaVelocity, target.time, delta)
  }
}

const cameraLayerQuery = defineQuery([VisibleComponent, ObjectLayerComponents[ObjectLayers.Camera], MeshComponent])

const getMaxCamDistance = (cameraEntity: Entity, target: Vector3) => {
  const followCamera = getComponent(cameraEntity, FollowCameraComponent)

  // Cache the raycast result for 0.1 seconds
  const raycastProps = followCamera.raycastProps
  const { camRayCastCache, camRayCastClock, cameraRays, rayConeAngle } = raycastProps
  if (camRayCastCache.maxDistance != -1 && camRayCastClock.getElapsedTime() < raycastProps.rayFrequency) {
    return camRayCastCache
  }

  camRayCastClock.start()

  const sceneObjects = cameraLayerQuery().flatMap((e) => getComponent(e, MeshComponent))

  // Raycast to keep the line of sight with avatar
  const cameraTransform = getComponent(Engine.instance.cameraEntity, TransformComponent)
  const targetToCamVec = tempVec1.subVectors(cameraTransform.position, target)
  // raycaster.ray.origin.sub(targetToCamVec.multiplyScalar(0.1)) // move origin behind camera

  createConeOfVectors(targetToCamVec, cameraRays, rayConeAngle)

  let maxDistance = Math.min(followCamera.thirdPersonMaxDistance, raycastProps.rayLength)

  // Check hit with mid ray
  raycaster.layers.set(ObjectLayers.Camera) // Ignore avatars
  // @ts-ignore - todo figure out why typescript freaks out at this
  raycaster.firstHitOnly = true // three-mesh-bvh setting
  raycaster.far = followCamera.thirdPersonMaxDistance
  raycaster.set(target, targetToCamVec.normalize())
  const hits = raycaster.intersectObjects(sceneObjects, false)

  if (hits[0] && hits[0].distance < maxDistance) {
    maxDistance = hits[0].distance
  }

  //Check the cone for minimum distance
  cameraRays.forEach((rayDir, i) => {
    raycaster.set(target, rayDir)
    const hits = raycaster.intersectObjects(sceneObjects, false)

    if (hits[0] && hits[0].distance < maxDistance) {
      maxDistance = hits[0].distance
    }
  })

  camRayCastCache.maxDistance = maxDistance
  camRayCastCache.targetHit = !!hits[0]

  return camRayCastCache
}
