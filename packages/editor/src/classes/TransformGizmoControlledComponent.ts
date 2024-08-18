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
import { Box3, Vector3 } from 'three'

import { Engine, UndefinedEntity } from '@etherealengine/ecs'
import {
  defineComponent,
  getComponent,
  removeComponent,
  setComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { createEntity, removeEntity, useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { TransformPivot } from '@etherealengine/engine/src/scene/constants/transformConstants'
import { useMutableState } from '@etherealengine/hyperflux'
import { TransformComponent } from '@etherealengine/spatial'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { TransformGizmoTagComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'

import { EditorHelperState } from '../services/EditorHelperState'
import { SelectionState } from '../services/SelectionServices'
import { TransformGizmoControlComponent } from './TransformGizmoControlComponent'
import { TransformGizmoVisualComponent } from './TransformGizmoVisualComponent'

export const TransformGizmoControlledComponent = defineComponent({
  name: 'TransformGizmoControlled',

  onInit(entity) {
    return {
      controller: UndefinedEntity
    }
  },

  reactor: function (props) {
    const entity = useEntityContext()
    const transformGizmoControlledComponent = useComponent(entity, TransformGizmoControlledComponent)
    const selectedEntities = SelectionState.useSelectedEntities()
    const editorHelperState = useMutableState(EditorHelperState)
    const box = new Box3()

    const createPivotEntity = () => {
      const pivotEntity = createEntity()
      setComponent(pivotEntity, NameComponent, 'gizmoPivotEntity')
      setComponent(pivotEntity, TransformComponent)
      setComponent(pivotEntity, VisibleComponent)
      setComponent(pivotEntity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
      setComponent(pivotEntity, TransformGizmoTagComponent)

      /*addObjectToGroup(
        pivotEntity,
        new Mesh(new SphereGeometry(1.5, 32, 32), new MeshBasicMaterial({ color: 0xff0000 }))
      )*/
      // useful for debug so leaving it here
      return pivotEntity
    }

    useEffect(() => {
      const gizmoControlEntity = createEntity()
      const gizmoVisualEntity = createEntity()
      const gizmoPlaneEntity = createEntity()
      setComponent(gizmoControlEntity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
      setComponent(gizmoVisualEntity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
      setComponent(gizmoPlaneEntity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })

      const controlledEntities = [entity]
      setComponent(gizmoControlEntity, NameComponent, 'gizmoControllerEntity')
      setComponent(gizmoControlEntity, TransformGizmoControlComponent, {
        controlledEntities: controlledEntities,
        visualEntity: gizmoVisualEntity,
        planeEntity: gizmoPlaneEntity
      })
      setComponent(gizmoControlEntity, TransformGizmoTagComponent)
      setComponent(gizmoControlEntity, VisibleComponent)

      transformGizmoControlledComponent.controller.set(gizmoControlEntity)

      setComponent(gizmoVisualEntity, NameComponent, 'gizmoVisualEntity')
      setComponent(gizmoVisualEntity, TransformGizmoVisualComponent)
      setComponent(gizmoVisualEntity, TransformGizmoTagComponent)
      setComponent(gizmoVisualEntity, VisibleComponent)

      setComponent(gizmoPlaneEntity, NameComponent, 'gizmoPlaneEntity')
      setComponent(gizmoPlaneEntity, TransformGizmoTagComponent)
      //NOTE: VisibleComponent for gizmoPlaneEntity is managed in TransformGizmoControlComponent based on drag interaction

      return () => {
        removeEntity(gizmoControlEntity)
        removeComponent(gizmoVisualEntity, TransformGizmoVisualComponent)
        removeEntity(gizmoVisualEntity)
        removeEntity(gizmoPlaneEntity)
      }
    }, [])

    useEffect(() => {
      if (selectedEntities.length <= 1) return
      const controlledEntities = selectedEntities
      const existingPivot = getComponent(
        transformGizmoControlledComponent.controller.value,
        TransformGizmoControlComponent
      ).pivotEntity
      const pivot = existingPivot === UndefinedEntity ? createPivotEntity() : existingPivot
      setComponent(transformGizmoControlledComponent.controller.value, TransformGizmoControlComponent, {
        controlledEntities: controlledEntities,
        pivotEntity: pivot
      })
      return () => {
        setComponent(transformGizmoControlledComponent.controller.value, TransformGizmoControlComponent, {
          pivotEntity: UndefinedEntity
        })
        removeEntity(pivot)
      }
    }, [selectedEntities])

    useEffect(() => {
      if (selectedEntities.length <= 1) return
      const controlledEntities = selectedEntities
      const pivot = getComponent(
        transformGizmoControlledComponent.controller.value,
        TransformGizmoControlComponent
      ).pivotEntity
      if (pivot === UndefinedEntity) return

      const newPosition = new Vector3()
      TransformComponent.getWorldPosition(pivot, newPosition)

      switch (editorHelperState.transformPivot.value) {
        case TransformPivot.Origin:
          newPosition.setScalar(0)
          break
        case TransformPivot.Selection:
          TransformComponent.getWorldPosition(controlledEntities[controlledEntities.length - 1], newPosition)
          break
        case TransformPivot.Center:
        case TransformPivot.Bottom:
          box.makeEmpty()

          for (let i = 0; i < controlledEntities.length; i++) {
            const parentEnt = controlledEntities[i]
            box.expandByPoint(getComponent(parentEnt, TransformComponent).position)
          }
          box.getCenter(newPosition)

          if (editorHelperState.transformPivot.value === TransformPivot.Bottom) newPosition.y = box.min.y
          break
      }

      setComponent(pivot, TransformComponent, { position: newPosition })
    }, [editorHelperState.transformPivot, selectedEntities])

    return null
  }
})
