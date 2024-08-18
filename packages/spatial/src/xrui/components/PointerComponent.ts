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

import { useEffect, useLayoutEffect } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry
} from 'three'
import matches from 'ts-matches'

import {
  defineComponent,
  getComponent,
  getMutableComponent,
  setComponent,
  useComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { createEntity, entityExists, removeEntity, useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { WebContainer3D } from '@etherealengine/xrui'

import { getState } from '@etherealengine/hyperflux'
import { EngineState } from '../../EngineState'
import { NameComponent } from '../../common/NameComponent'
import { useAnimationTransition } from '../../common/functions/createTransitionState'
import { InputSourceComponent } from '../../input/components/InputSourceComponent'
import { addObjectToGroup, removeObjectFromGroup } from '../../renderer/components/GroupComponent'
import { VisibleComponent } from '../../renderer/components/VisibleComponent'
import { ComputedTransformComponent } from '../../transform/components/ComputedTransformComponent'
import { TransformComponent } from '../../transform/components/TransformComponent'

export const PointerComponent = defineComponent({
  name: 'PointerComponent',

  onInit: (entity) => {
    return {
      inputSource: null! as XRInputSource,
      lastHit: null as ReturnType<typeof WebContainer3D.prototype.hitTest> | null,
      // internal
      pointer: null! as PointerObject,
      cursor: null as Mesh<BufferGeometry, MeshBasicMaterial> | null
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matches.object.test(json.inputSource)) component.inputSource.set(json.inputSource)
  },

  reactor: () => {
    const entity = useEntityContext()
    const pointerComponentState = useComponent(entity, PointerComponent)

    const transition = useAnimationTransition(0.5, 'OUT', (alpha) => {
      const cursorMaterial = pointerComponentState.cursor.value?.material as MeshBasicMaterial
      const pointerMaterial = pointerComponentState.pointer.value?.material as MeshBasicMaterial
      if (cursorMaterial) {
        cursorMaterial.opacity = alpha
        cursorMaterial.visible = alpha > 0
      }
      if (pointerMaterial) {
        pointerMaterial.opacity = alpha
        pointerMaterial.visible = alpha > 0
      }
    })

    useLayoutEffect(() => {
      const inputSource = pointerComponentState.inputSource.value as XRInputSource
      return () => {
        PointerComponent.pointers.delete(inputSource)
      }
    }, [])

    useEffect(() => {
      const inputSource = pointerComponentState.inputSource.value
      const pointer = createPointer(inputSource as XRInputSource)
      const cursor = createUICursor()
      const pointerEntity = createEntity()
      addObjectToGroup(pointerEntity, pointer)
      setComponent(pointerEntity, EntityTreeComponent, { parentEntity: entity })
      addObjectToGroup(pointerEntity, cursor)
      getMutableComponent(entity, PointerComponent).merge({ pointer, cursor })
      addObjectToGroup(entity, pointer)
      return () => {
        if (entityExists(entity)) removeObjectFromGroup(entity, pointer)
        removeEntity(pointerEntity)
      }
    }, [pointerComponentState.inputSource])

    useEffect(() => {
      transition(pointerComponentState.lastHit.value ? 'IN' : 'OUT')
    }, [pointerComponentState.lastHit])

    return null
  },

  addPointer: (inputSourceEntity: Entity) => {
    const inputSource = getComponent(inputSourceEntity, InputSourceComponent).source
    const entity = createEntity()
    setComponent(entity, PointerComponent, { inputSource })
    setComponent(entity, NameComponent, 'Pointer' + inputSource.handedness)
    setComponent(entity, EntityTreeComponent, { parentEntity: getState(EngineState).localFloorEntity })
    setComponent(entity, ComputedTransformComponent, {
      referenceEntities: [inputSourceEntity],
      computeFunction: () => {
        const inputTransform = getComponent(inputSourceEntity, TransformComponent)
        const pointerTransform = getComponent(entity, TransformComponent)
        pointerTransform.position.copy(inputTransform.position)
        pointerTransform.rotation.copy(inputTransform.rotation)
      }
    })

    setComponent(entity, TransformComponent)
    setComponent(entity, VisibleComponent)
    PointerComponent.pointers.set(inputSource, entity)
  },

  pointers: new Map<XRInputSource, Entity>(),

  getPointers: () => {
    return Array.from(PointerComponent.pointers.values()).map(
      (entity) => getComponent(entity, PointerComponent).pointer
    )
  }
})

// pointer taken from https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_ballshooter.html
const createPointer = (inputSource: XRInputSource): PointerObject => {
  switch (inputSource.targetRayMode) {
    case 'gaze': {
      const geometry = new RingGeometry(0.02, 0.04, 32).translate(0, 0, -1)
      const material = new MeshBasicMaterial({ opacity: 0, transparent: true })
      return new Mesh(geometry, material) as PointerObject
    }
    default:
    case 'tracked-pointer': {
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3))
      geometry.setAttribute('color', new Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3))
      const material = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, linewidth: 2 })
      return new Line(geometry, material)
    }
  }
}

const createUICursor = () => {
  const geometry = new SphereGeometry(0.01, 16, 16)
  const material = new MeshBasicMaterial({ color: 0xffffff, opacity: 0 })
  return new Mesh(geometry, material)
}

export type PointerObject = Line<BufferGeometry, LineBasicMaterial> | Mesh<RingGeometry, MeshBasicMaterial>
