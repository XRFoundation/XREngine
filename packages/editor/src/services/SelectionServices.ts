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

import { removeComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { entityExists } from '@etherealengine/ecs/src/EntityFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { SelectTagComponent } from '@etherealengine/engine/src/scene/components/SelectTagComponent'
import { defineState, getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { EntityUUID, UUIDComponent } from '@etherealengine/ecs'
import { PresentationSystemGroup } from '@etherealengine/ecs/src/SystemGroups'
import { MaterialSelectionState } from '@etherealengine/engine/src/scene/materials/MaterialLibraryState'
import { useEffect } from 'react'

export const SelectionState = defineState({
  name: 'SelectionState',
  initial: {
    selectedEntities: [] as EntityUUID[]
  },
  updateSelection: (selectedEntities: EntityUUID[]) => {
    getMutableState(MaterialSelectionState).selectedMaterial.set(null)
    getMutableState(SelectionState).merge({
      selectedEntities: selectedEntities
    })
  },
  getSelectedEntities: () => {
    return getState(SelectionState).selectedEntities.map(UUIDComponent.getEntityByUUID)
  },

  useSelectedEntities: () => {
    return useHookstate(getMutableState(SelectionState).selectedEntities).value.map(UUIDComponent.getEntityByUUID)
  }
})

const reactor = () => {
  const selectedEntities = useHookstate(getMutableState(SelectionState).selectedEntities)

  useEffect(() => {
    const entities = [...selectedEntities.value].map(UUIDComponent.getEntityByUUID)
    for (const entity of entities) {
      if (!entityExists(entity)) continue
      setComponent(entity, SelectTagComponent)
    }

    return () => {
      for (const entity of entities) {
        if (!entityExists(entity)) continue
        removeComponent(entity, SelectTagComponent)
      }
    }
  }, [selectedEntities.length])

  return null
}

export const EditorSelectionReceptorSystem = defineSystem({
  uuid: 'ee.engine.EditorSelectionReceptorSystem',
  insert: { before: PresentationSystemGroup },
  reactor
})
