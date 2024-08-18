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
import { Box3, BufferGeometry, Material, Mesh } from 'three'

import { Entity, useEntityContext } from '@etherealengine/ecs'
import {
  defineComponent,
  hasComponent,
  removeComponent,
  setComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { NO_PROXY, State, useImmediateEffect } from '@etherealengine/hyperflux'

import { useResource } from '../../resources/resourceHooks'
import { BoundingBoxComponent } from '../../transform/components/BoundingBoxComponents'
import { addObjectToGroup, removeObjectFromGroup } from './GroupComponent'

export const MeshComponent = defineComponent({
  name: 'MeshComponent',
  jsonID: 'EE_mesh',

  onInit: (entity) => null! as Mesh,

  onSet: (entity, component, mesh: Mesh) => {
    if (!mesh || !mesh.isMesh) throw new Error('MeshComponent: Invalid mesh')
    component.set(mesh)
  },

  reactor: () => {
    const entity = useEntityContext()
    const meshComponent = useComponent(entity, MeshComponent)
    const [meshResource] = useResource(meshComponent.value, entity, meshComponent.uuid.value)
    const [geometryResource] = useResource(meshComponent.geometry.value, entity, meshComponent.geometry.uuid.value)
    const [materialResource] = useResource<Material | Material[]>(
      meshComponent.material.value as Material,
      entity,
      !Array.isArray(meshComponent.material.value) ? (meshComponent.material.value as Material).uuid : undefined
    )

    useEffect(() => {
      const box = geometryResource.boundingBox.get(NO_PROXY) as Box3 | null
      if (!box) return

      setComponent(entity, BoundingBoxComponent, { box: box })
      return () => {
        removeComponent(entity, BoundingBoxComponent)
      }
    }, [geometryResource.boundingBox])

    useEffect(() => {
      if (meshComponent.value !== meshResource.value) meshResource.set(meshComponent.value)
    }, [meshComponent])

    useEffect(() => {
      const mesh = meshComponent.value
      if (mesh.geometry !== geometryResource.value) geometryResource.set(mesh.geometry)
    }, [meshComponent.geometry])

    useEffect(() => {
      const mesh = meshComponent.value
      if (mesh.material !== materialResource.value) materialResource.set(mesh.material)

      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.needsUpdate = true
      } else {
        ;(mesh.material as Material).needsUpdate = true
      }
    }, [meshComponent.material])

    return null
  }
})

/**
 *
 * Creates a mesh component that won't be exported
 *
 * @param entity entity to add the mesh component to
 * @param geometry a Geometry instance or function returing a Geometry instance to add to the mesh
 * @param material a Material instance or function returing a Material instance to add to the mesh
 * @returns State<Mesh>
 */
export function useMeshComponent<TGeometry extends BufferGeometry, TMaterial extends Material>(
  entity: Entity,
  geometry: TGeometry | (() => TGeometry),
  material: TMaterial | (() => TMaterial)
): State<Mesh<TGeometry, TMaterial>> {
  if (!hasComponent(entity, MeshComponent)) {
    const geo = typeof geometry === 'function' ? geometry() : geometry
    const mat = typeof material === 'function' ? material() : material
    setComponent(entity, MeshComponent, new Mesh<TGeometry, TMaterial>(geo, mat))
  }

  const meshComponent = useComponent(entity, MeshComponent)

  useImmediateEffect(() => {
    const mesh = meshComponent.value as Mesh<TGeometry, TMaterial>
    mesh.userData['ignoreOnExport'] = true
    addObjectToGroup(entity, mesh)
    return () => {
      removeObjectFromGroup(entity, mesh)
      removeComponent(entity, MeshComponent)
    }
  }, [])

  return meshComponent as unknown as State<Mesh<TGeometry, TMaterial>>
}
