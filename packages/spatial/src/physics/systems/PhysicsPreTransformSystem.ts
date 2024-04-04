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
  Entity,
  defineQuery,
  defineSystem,
  getComponent,
  getOptionalComponent,
  hasComponent
} from '@etherealengine/ecs'
import { ECSState } from '@etherealengine/ecs/src/ECSState'
import { getState } from '@etherealengine/hyperflux'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { V_000 } from '../../common/constants/MathConstants'
import { EntityTreeComponent } from '../../transform/components/EntityTree'
import { TransformComponent } from '../../transform/components/TransformComponent'
import { TransformSystem, computeTransformMatrix, isDirty } from '../../transform/systems/TransformSystem'
import { ColliderComponent } from '../components/ColliderComponent'
import { RigidBodyComponent } from '../components/RigidBodyComponent'

export const teleportRigidbody = (entity: Entity) => {
  const transform = getComponent(entity, TransformComponent)
  const rigidBody = getComponent(entity, RigidBodyComponent)
  const isAwake = !rigidBody.body.isSleeping()
  rigidBody.body.setTranslation(transform.position, isAwake)
  rigidBody.body.setRotation(transform.rotation, isAwake)
  rigidBody.body.setLinvel(V_000, isAwake)
  rigidBody.body.setAngvel(V_000, isAwake)
  rigidBody.previousPosition.copy(transform.position)
  rigidBody.position.copy(transform.position)
  rigidBody.previousRotation.copy(transform.rotation)
  rigidBody.rotation.copy(transform.rotation)
}

const position = new Vector3()
const rotation = new Quaternion()
const scale = new Vector3()
const mat4 = new Matrix4()

export const lerpTransformFromRigidbody = (entity: Entity, alpha: number) => {
  /*
  Interpolate the remaining time after the fixed pipeline is complete.
  See https://gafferongames.com/post/fix_your_timestep/#the-final-touch
  */

  const previousPositionX = RigidBodyComponent.previousPosition.x[entity]
  const previousPositionY = RigidBodyComponent.previousPosition.y[entity]
  const previousPositionZ = RigidBodyComponent.previousPosition.z[entity]
  const previousRotationX = RigidBodyComponent.previousRotation.x[entity]
  const previousRotationY = RigidBodyComponent.previousRotation.y[entity]
  const previousRotationZ = RigidBodyComponent.previousRotation.z[entity]
  const previousRotationW = RigidBodyComponent.previousRotation.w[entity]

  const positionX = RigidBodyComponent.position.x[entity]
  const positionY = RigidBodyComponent.position.y[entity]
  const positionZ = RigidBodyComponent.position.z[entity]
  const rotationX = RigidBodyComponent.rotation.x[entity]
  const rotationY = RigidBodyComponent.rotation.y[entity]
  const rotationZ = RigidBodyComponent.rotation.z[entity]
  const rotationW = RigidBodyComponent.rotation.w[entity]

  position.x = positionX * alpha + previousPositionX * (1 - alpha)
  position.y = positionY * alpha + previousPositionY * (1 - alpha)
  position.z = positionZ * alpha + previousPositionZ * (1 - alpha)
  rotation.x = rotationX * alpha + previousRotationX * (1 - alpha)
  rotation.y = rotationY * alpha + previousRotationY * (1 - alpha)
  rotation.z = rotationZ * alpha + previousRotationZ * (1 - alpha)
  rotation.w = rotationW * alpha + previousRotationW * (1 - alpha)

  const transform = getComponent(entity, TransformComponent)

  const parentEntity = getOptionalComponent(entity, EntityTreeComponent)?.parentEntity
  if (parentEntity) {
    // todo: figure out proper scale support
    const scale = getComponent(entity, TransformComponent).scale
    // if the entity has a parent, we need to use the world space
    transform.matrixWorld.compose(position, rotation, scale)

    TransformComponent.dirtyTransforms[entity] = false

    for (const child of getComponent(entity, EntityTreeComponent).children)
      TransformComponent.dirtyTransforms[child] = true
  } else {
    // otherwise, we can use the local space (for things like avatars)
    transform.position.copy(position)
    transform.rotation.copy(rotation)
  }
}

export const copyTransformToRigidBody = (entity: Entity) => {
  const transform = getComponent(entity, TransformComponent)
  const parentEntity = getOptionalComponent(entity, EntityTreeComponent)?.parentEntity
  if (parentEntity) {
    // if the entity has a parent, we need to use the world space
    transform.matrixWorld.decompose(position, rotation, scale)
  } else {
    // otherwise, we can use the local space (for things like avatars)
    position.copy(transform.position)
    rotation.copy(transform.rotation)
  }

  RigidBodyComponent.position.x[entity] =
    RigidBodyComponent.previousPosition.x[entity] =
    RigidBodyComponent.targetKinematicPosition.x[entity] =
      position.x
  RigidBodyComponent.position.y[entity] =
    RigidBodyComponent.previousPosition.y[entity] =
    RigidBodyComponent.targetKinematicPosition.y[entity] =
      position.y
  RigidBodyComponent.position.z[entity] =
    RigidBodyComponent.previousPosition.z[entity] =
    RigidBodyComponent.targetKinematicPosition.z[entity] =
      position.z
  RigidBodyComponent.rotation.x[entity] =
    RigidBodyComponent.previousRotation.x[entity] =
    RigidBodyComponent.targetKinematicRotation.x[entity] =
      rotation.x
  RigidBodyComponent.rotation.y[entity] =
    RigidBodyComponent.previousRotation.y[entity] =
    RigidBodyComponent.targetKinematicRotation.y[entity] =
      rotation.y
  RigidBodyComponent.rotation.z[entity] =
    RigidBodyComponent.previousRotation.z[entity] =
    RigidBodyComponent.targetKinematicRotation.z[entity] =
      rotation.z
  RigidBodyComponent.rotation.w[entity] =
    RigidBodyComponent.previousRotation.w[entity] =
    RigidBodyComponent.targetKinematicRotation.w[entity] =
      rotation.w

  const rigidbody = getComponent(entity, RigidBodyComponent)
  rigidbody.body.setTranslation(rigidbody.position, false)
  rigidbody.body.setRotation(rigidbody.rotation, false)
  rigidbody.body.setLinvel(V_000, false)
  rigidbody.body.setAngvel(V_000, false)

  TransformComponent.dirtyTransforms[entity] = false

  if (hasComponent(entity, EntityTreeComponent))
    for (const child of getComponent(entity, EntityTreeComponent).children)
      TransformComponent.dirtyTransforms[child] = true
}

const copyTransformToCollider = (entity: Entity) => {
  const collider = getComponent(entity, ColliderComponent).collider
  if (!collider) return

  const transform = getComponent(entity, TransformComponent)

  computeTransformMatrix(entity)

  mat4.copy(transform.matrixWorld).decompose(position, rotation, scale)

  collider.setTranslation(position)
  collider.setRotation(rotation)
}

const rigidbodyQuery = defineQuery([TransformComponent, RigidBodyComponent])
const colliderQuery = defineQuery([TransformComponent, ColliderComponent])

const filterAwakeCleanRigidbodies = (entity: Entity) =>
  !isDirty(entity) && !getComponent(entity, RigidBodyComponent).body.isSleeping()

export const execute = () => {
  const ecsState = getState(ECSState)

  /**
   * Update entity transforms
   */
  const allRigidbodyEntities = rigidbodyQuery()
  const dirtyRigidbodyEntities = allRigidbodyEntities.filter(isDirty)
  const dirtyColliderEntities = colliderQuery().filter(isDirty)

  // if rigidbody transforms have been dirtied, teleport the rigidbody to the transform
  for (const entity of dirtyRigidbodyEntities) copyTransformToRigidBody(entity)

  // if collider transforms have been dirtied, update them
  for (const entity of dirtyColliderEntities) copyTransformToCollider(entity)

  // lerp awake clean rigidbody entities (and make their transforms dirty)
  const simulationRemainder = ecsState.frameTime - ecsState.simulationTime
  const alpha = Math.min(simulationRemainder / ecsState.simulationTimestep, 1)

  const awakeCleanRigidbodyEntities = allRigidbodyEntities.filter(filterAwakeCleanRigidbodies)
  for (const entity of awakeCleanRigidbodyEntities) lerpTransformFromRigidbody(entity, alpha)
}

export const PhysicsPreTransformSystem = defineSystem({
  uuid: 'ee.engine.PhysicsPreTransformSystem',
  insert: { before: TransformSystem },
  execute
})
