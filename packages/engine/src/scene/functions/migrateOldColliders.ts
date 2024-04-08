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

import { RigidBodyType } from '@dimforge/rapier3d-compat'
import { SerializedComponentType } from '@etherealengine/ecs'
import { ColliderComponent } from '@etherealengine/spatial/src/physics/components/ColliderComponent'
import { RigidBodyComponent } from '@etherealengine/spatial/src/physics/components/RigidBodyComponent'
import { TriggerComponent } from '@etherealengine/spatial/src/physics/components/TriggerComponent'
import { ColliderComponent as OldColliderComponent } from '../components/ColliderComponent'
import { ModelComponent } from '../components/ModelComponent'
import { ComponentJsonType, EntityJsonType } from '../types/SceneTypes'

/**
 * Converts old ColliderComponent to RigidbodyComponent, new ColliderComponent and TriggerComponent
 */
export const migrateOldColliders = (oldJSON: EntityJsonType) => {
  /** models need to be manually converted in the studio */
  const hasModel = Object.values(oldJSON.components).some((comp) => comp.name === ModelComponent.jsonID)
  if (hasModel) return

  const newComponents = [] as ComponentJsonType[]
  for (const component of oldJSON.components) {
    if (component.name !== OldColliderComponent.jsonID) continue

    const data = component.props as SerializedComponentType<typeof OldColliderComponent>
    /** shapeType is undefined for GLTF metadata */
    // if (typeof data.shapeType === 'undefined') continue
    newComponents.push({
      name: RigidBodyComponent.jsonID,
      props: {
        type:
          data.bodyType === RigidBodyType.Fixed || (data.bodyType as any) === 'Fixed'
            ? 'fixed'
            : data.bodyType === RigidBodyType.Dynamic || (data.bodyType as any) === 'Dynamic'
            ? 'dynamic'
            : 'kinematic'
      }
    })
    if (typeof data.shapeType === 'number')
      newComponents.push({
        name: ColliderComponent.jsonID,
        props: {
          shape: data.shapeType,
          collisionLayer: data.collisionLayer,
          collisionMask: data.collisionMask,
          restitution: data.restitution
        }
      })
    if (data.isTrigger) {
      newComponents.push({
        name: TriggerComponent.jsonID,
        props: { triggers: data.triggers }
      })
    }
  }

  if (!newComponents.length) return

  oldJSON.components.push(...newComponents)
  oldJSON.components = oldJSON.components.filter((component) => component.name !== OldColliderComponent.jsonID)
}
