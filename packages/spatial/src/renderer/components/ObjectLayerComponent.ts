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

import { Types } from 'bitecs'
import { Object3D } from 'three'

import { entityExists } from '@etherealengine/ecs'
import {
  defineComponent,
  hasComponent,
  removeComponent,
  setComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'

const maxBitWidth = 32

export const ObjectLayerComponents = Array.from({ length: maxBitWidth }, (_, i) => {
  return defineComponent({
    name: `ObjectLayer${i}`,

    onSet(entity, component) {
      ObjectLayerMaskComponent.mask[entity] |= (1 << i) | 0
    },

    onRemove(entity, component) {
      ObjectLayerMaskComponent.mask[entity] &= ~((1 << i) | 0)
    }
  })
})

export const ObjectLayerMaskDefault = 1 << 0 // enable layer 0

export const ObjectLayerMaskComponent = defineComponent({
  name: 'ObjectLayerMaskComponent',
  schema: { mask: Types.i32 },

  onInit(entity) {
    return ObjectLayerMaskDefault // enable layer 0
  },

  /**
   * @description
   * Takes a layer mask as a parameter, not a layer (eg. layer mask with value 256 enables layer 8)
   * ```ts
   * // Incorrect usage
   * setComponent(entity, ObjectLayerMaskComponent, ObjectLayers.NodeHelper)
   *
   * // Correct usage
   * setComponent(entity, ObjectLayerMaskComponent, ObjectLayerMasks.NodeHelper)
   * ```
   */
  onSet(entity, component, mask = ObjectLayerMaskDefault) {
    for (let i = 0; i < maxBitWidth; i++) {
      const isSet = (mask & ((1 << i) | 0)) !== 0
      if (isSet) {
        setComponent(entity, ObjectLayerComponents[i])
      } else {
        removeComponent(entity, ObjectLayerComponents[i])
      }
    }
    component.set(mask)
    ObjectLayerMaskComponent.mask[entity] = mask
  },

  onRemove(entity, component) {
    for (let i = 0; i < maxBitWidth; i++) {
      removeComponent(entity, ObjectLayerComponents[i])
    }
    component.set(0)
  },

  toJSON(entity, component) {
    return component.value
  },

  setLayer(entity: Entity, layer: number) {
    const mask = ((1 << layer) | 0) >>> 0
    setComponent(entity, ObjectLayerMaskComponent, mask)
  },

  enableLayer(entity: Entity, layer: number) {
    if (!entityExists(entity)) return
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
    setComponent(entity, ObjectLayerComponents[layer])
  },

  enableLayers(entity: Entity, ...layers: number[]) {
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
    for (const layer of layers) {
      setComponent(entity, ObjectLayerComponents[layer])
    }
  },

  disableLayer(entity: Entity, layer: number) {
    if (!entityExists(entity)) return
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
    removeComponent(entity, ObjectLayerComponents[layer])
  },

  disableLayers(entity: Entity, ...layers: number[]) {
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
    for (const layer of layers) {
      removeComponent(entity, ObjectLayerComponents[layer])
    }
  },

  toggleLayer(entity: Entity, layer: number) {
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
    const ObjectLayerComponent = ObjectLayerComponents[layer]
    if (hasComponent(entity, ObjectLayerComponent)) {
      removeComponent(entity, ObjectLayerComponent)
    } else {
      setComponent(entity, ObjectLayerComponent)
    }
  },

  setMask(entity: Entity, mask: number) {
    setComponent(entity, ObjectLayerMaskComponent, mask)
  }
})

export class Layer {
  constructor(public entity: Entity) {
    if (!hasComponent(entity, ObjectLayerMaskComponent)) setComponent(entity, ObjectLayerMaskComponent)
  }

  get mask() {
    return ObjectLayerMaskComponent.mask[this.entity]
  }

  set mask(val) {
    setComponent(this.entity, ObjectLayerMaskComponent, val)
  }

  set(channel: number) {
    ObjectLayerMaskComponent.setLayer(this.entity, channel)
  }

  enable(channel: number) {
    ObjectLayerMaskComponent.enableLayer(this.entity, channel)
  }

  enableAll() {
    ObjectLayerMaskComponent.setMask(this.entity, -1)
  }

  toggle(channel: number) {
    ObjectLayerMaskComponent.toggleLayer(this.entity, channel)
  }

  disable(channel: number) {
    ObjectLayerMaskComponent.disableLayer(this.entity, channel)
  }

  disableAll() {
    ObjectLayerMaskComponent.setMask(this.entity, 0)
  }

  test(layers: Layer) {
    return (this.mask & layers.mask) !== 0
  }

  isEnabled(channel: number) {
    return (this.mask & ((1 << channel) | 0)) !== 0
  }
}

/**
 * @deprecated use ObjectLayerMaskComponent instead
 */
export function setObjectLayers(object: Object3D, ...layers: number[]) {
  object.traverse((obj: Object3D) => {
    obj.layers.disableAll()
    for (const layer of layers) {
      obj.layers.enable(layer)
    }
  })
}

/**
 * @deprecated use ObjectLayerMaskComponent instead
 */
export function enableObjectLayer(object: Object3D, layer: number, enable: boolean) {
  object.traverse((obj: Object3D) => {
    enable ? obj.layers.enable(layer) : obj.layers.disable(layer)
  })
}
