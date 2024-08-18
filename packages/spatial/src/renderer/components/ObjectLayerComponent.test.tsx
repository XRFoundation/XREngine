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

import assert from 'assert'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'

import {
  getComponent,
  hasComponent,
  removeComponent,
  serializeComponent,
  setComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { destroyEngine } from '@etherealengine/ecs/src/Engine'
import { createEntity, removeEntity } from '@etherealengine/ecs/src/EntityFunctions'

import { UndefinedEntity } from '@etherealengine/ecs'
import { createEngine } from '@etherealengine/ecs/src/Engine'
import { addObjectToGroup } from './GroupComponent'
import { Layer, ObjectLayerComponents, ObjectLayerMaskComponent, ObjectLayerMaskDefault } from './ObjectLayerComponent'

const maxBitWidth = 32

describe('ObjectLayerComponent : todo.Organize', () => {
  beforeEach(async () => {
    createEngine()
  })

  afterEach(() => {
    return destroyEngine()
  })

  it('Sets mask and layer', () => {
    const entity = createEntity()

    const layer = 8
    const layerMask = 1 << layer

    setComponent(entity, ObjectLayerMaskComponent, layerMask)

    assert(hasComponent(entity, ObjectLayerMaskComponent))
    const componentLayerMask = getComponent(entity, ObjectLayerMaskComponent)
    assert(componentLayerMask === layerMask)
    assert(componentLayerMask !== layer)
    assert(hasComponent(entity, ObjectLayerComponents[layer]))
  })

  it('Sets objectLayers on group', () => {
    const entity = createEntity()
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ color: 0xffff00 })
    const mesh = new Mesh(geometry, material)

    const objectLayer = 2
    const nonEnabledObjectLayer = 5

    addObjectToGroup(entity, mesh)
    mesh.layers.enable(objectLayer)

    assert(hasComponent(entity, ObjectLayerMaskComponent))
    assert(hasComponent(entity, ObjectLayerComponents[objectLayer]))
    assert(!hasComponent(entity, ObjectLayerComponents[nonEnabledObjectLayer]))
    assert(mesh.layers.isEnabled(objectLayer))
    assert(!mesh.layers.isEnabled(nonEnabledObjectLayer))
  })

  it('Sets objectLayers on group multiple', () => {
    const meshCount = 10

    const entity = createEntity()
    const meshes = [] as Mesh[]

    for (let i = 0; i < meshCount; i++) {
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })
      const mesh = new Mesh(geometry, material)
      meshes.push(mesh)
      addObjectToGroup(entity, mesh)
    }

    const objectLayers = [5, 6, 7]

    setComponent(entity, ObjectLayerMaskComponent)
    ObjectLayerMaskComponent.enableLayers(entity, ...objectLayers)

    for (const mesh of meshes) {
      for (const layer of objectLayers) {
        assert(mesh.layers.isEnabled(layer))
        assert(hasComponent(entity, ObjectLayerComponents[layer]))
      }
    }
  })

  it('Updates objectLayers on group', () => {
    const entity = createEntity()
    const geometry = new BoxGeometry(1, 1, 1)
    const material = new MeshBasicMaterial({ color: 0xffff00 })
    const mesh = new Mesh(geometry, material)

    const objectLayers = [2, 3, 4]
    const nonEnabledObjectLayer = 5

    addObjectToGroup(entity, mesh)
    setComponent(entity, ObjectLayerMaskComponent)
    ObjectLayerMaskComponent.enableLayers(entity, ...objectLayers)

    for (const layer of objectLayers) {
      assert(mesh.layers.isEnabled(layer))
      assert(hasComponent(entity, ObjectLayerComponents[layer]))
    }

    assert(!mesh.layers.isEnabled(nonEnabledObjectLayer))

    const disableLayers = [2, 3]
    ObjectLayerMaskComponent.disableLayers(entity, ...disableLayers)

    for (const layer of objectLayers) {
      if (disableLayers.includes(layer)) {
        assert(!mesh.layers.isEnabled(layer))
        assert(!hasComponent(entity, ObjectLayerComponents[layer]))
      } else {
        assert(mesh.layers.isEnabled(layer))
        assert(hasComponent(entity, ObjectLayerComponents[layer]))
      }
    }
  })

  it('Layer object updates correctly', () => {
    const maxLayers = 32

    const entity = createEntity()
    const layer = new Layer(entity)

    assert(layer.isEnabled(0))
    const layerMaskComponent = getComponent(entity, ObjectLayerMaskComponent)
    assert(layerMaskComponent === 1)
    assert(ObjectLayerMaskComponent.mask[entity] === 1)
    assert(hasComponent(entity, ObjectLayerComponents[0]))

    const enabledLayers = [2, 3, 4]

    for (const enabledLayer of enabledLayers) {
      layer.enable(enabledLayer)
      assert(layer.isEnabled(enabledLayer))
    }

    const disabledLayers = [2, 3, 5]
    for (const disabledLayer of disabledLayers) {
      layer.disable(disabledLayer)
      assert(!layer.isEnabled(disabledLayer))
    }
    assert(layer.isEnabled(4))

    layer.disableAll()
    assert(layer.mask === 0)
    for (let i = 0; i < maxLayers; i++) {
      assert(!layer.isEnabled(i))
      assert(!hasComponent(entity, ObjectLayerComponents[i]))
    }

    layer.enableAll()
    assert(layer.mask.valueOf() === (0xffffffff | 0))
    for (let i = 1; i < maxLayers; i++) {
      assert(layer.isEnabled(i))
      assert(hasComponent(entity, ObjectLayerComponents[i]))
    }

    layer.toggle(4)
    assert(!layer.isEnabled(4))
    layer.toggle(4)
    assert(layer.isEnabled(4))

    const entity2 = createEntity()
    const entity3 = createEntity()
    const layer2 = new Layer(entity2)
    const layer3 = new Layer(entity3)

    layer2.enable(2)
    layer2.enable(3)
    layer2.enable(4)
    layer3.enable(3)

    assert(layer2.test(layer3))
  })
})

type ObjectLayerMaskComponentData = any

function assertObjectLayerMaskComponentEq(A: ObjectLayerMaskComponentData, B: ObjectLayerMaskComponentData) {
  assert.equal(Boolean(A), Boolean(B))
  assert.equal(A.isObjectLayerMask, B.isObjectLayerMask)
}

describe('ObjectLayerMaskComponent', () => {
  describe('IDs', () => {
    it('should initialize the ObjectLayerMaskComponent.name field with the expected value', () => {
      assert.equal(ObjectLayerMaskComponent.name, 'ObjectLayerMaskComponent')
    })
  }) //:: IDs

  describe('schema', () => {
    it('should initialize the schema with the expected values', () => {
      assert.notEqual(ObjectLayerMaskComponent.schema, undefined)
      const KeysSchema = Object.keys(ObjectLayerMaskComponent.schema)
      assert.equal(KeysSchema.length, 1)
      assert.equal(KeysSchema.includes('mask'), true)
      assert.notEqual(ObjectLayerMaskComponent.schema.mask, undefined)
      assert.equal(ObjectLayerMaskComponent.schema.mask, 'i32')
    })
  })

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, ObjectLayerMaskComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, ObjectLayerMaskComponent)
      assertObjectLayerMaskComponentEq(data, ObjectLayerMaskDefault)
    })
  }) //:: onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should set the value of the component to `@param mask`', () => {
      const Expected = 42
      setComponent(testEntity, ObjectLayerMaskComponent, Expected)
      const result = getComponent(testEntity, ObjectLayerMaskComponent)
      assert.equal(result, Expected)
    })

    it('should set the mask value for the entity to `@param mask`', () => {
      const Expected = 42
      setComponent(testEntity, ObjectLayerMaskComponent, Expected)
      const result = ObjectLayerMaskComponent.mask[testEntity]
      assert.equal(result, Expected)
    })

    it('should set an ObjectLayerComponent for every bit of the `@param mask` that is set', () => {
      const ActiveBits = [8, 4, 2]
      const Mask = (1 << 8) | (1 << 4) | (1 << 2)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), false)
      setComponent(testEntity, ObjectLayerMaskComponent, Mask)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), true)
    })

    it('should remove any ObjectLayerComponent for the bits of `@param mask` that are not set', () => {
      const InitialBits = [12, 21]
      const Initial = (1 << 12) | (1 << 21)
      const ActiveBits = [8, 4, 2]
      const Mask = (1 << 8) | (1 << 4) | (1 << 2)
      for (const id in InitialBits)
        assert.equal(hasComponent(testEntity, ObjectLayerComponents[InitialBits[id]]), false)
      setComponent(testEntity, ObjectLayerMaskComponent, Initial)
      for (const id in InitialBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[InitialBits[id]]), true)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), false)
      setComponent(testEntity, ObjectLayerMaskComponent, Mask)
      for (const id in InitialBits)
        assert.equal(hasComponent(testEntity, ObjectLayerComponents[InitialBits[id]]), false)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), true)
    })
  }) //:: onSet

  describe('onRemove', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, ObjectLayerMaskComponent, 42)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should remove all ObjectLayerComponent for the entity', () => {
      removeComponent(testEntity, ObjectLayerMaskComponent)
      for (let id = 0; id < maxBitWidth; ++id) {
        assert.equal(hasComponent(testEntity, ObjectLayerComponents[id]), false)
      }
    })

    it("should set component's value to 0", () => {
      assert.equal(getComponent(testEntity, ObjectLayerMaskComponent), 42)
      removeComponent(testEntity, ObjectLayerMaskComponent)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
    })
  }) //:: onRemove

  describe('toJSON', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, ObjectLayerMaskComponent, 42)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should return the serialized data correctly', () => {
      const result = serializeComponent(testEntity, ObjectLayerMaskComponent)
      assert.equal(typeof result, 'number')
      assert.equal(result, 42)
    })
  }) //:: toJSON

  describe('setLayer', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should add/set an ObjectLayerMaskComponent to the entity, with the value of the `@param layer` converted into a mask', () => {
      const Layer = 10
      ObjectLayerMaskComponent.setLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), true)
      assert.equal(getComponent(testEntity, ObjectLayerMaskComponent), 1 << Layer)
    })
  }) //:: setLayer

  describe('enableLayer', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should add the ObjectLayerComponent with ID `@param layer` to the entity', () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), false)
      ObjectLayerMaskComponent.enableLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), true)
    })

    it("should add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.enableLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })

    it('should not do anything if the entity does not exist', () => {
      const Layer = 10
      assert.equal(hasComponent(UndefinedEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.enableLayer(UndefinedEntity, Layer)
      assert.equal(hasComponent(UndefinedEntity, ObjectLayerMaskComponent), false)
    })
  }) //:: enableLayer

  describe('enableLayers', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const Layers = [10, 4]
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.enableLayers(testEntity, ...Layers)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })

    it('should add an ObjectLayerComponent to the entity for every ID contained in the `@param layers` list', () => {
      const Layers = [10, 4]
      for (const layer in Layers) assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layers[layer]]), false)
      ObjectLayerMaskComponent.enableLayers(testEntity, ...Layers)
      for (const layer in Layers) assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layers[layer]]), true)
    })
  }) //:: enableLayers

  describe('disableLayer', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.disableLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })

    it('should remove the ObjectLayerComponent with ID `@param layer` from the entity', () => {
      const Layer = 10
      setComponent(testEntity, ObjectLayerComponents[Layer])
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), true)
      ObjectLayerMaskComponent.disableLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), false)
    })

    it('should not do anything if the entity does not exist', () => {
      const Layer = 10
      assert.equal(hasComponent(UndefinedEntity, ObjectLayerComponents[Layer]), false)
      ObjectLayerMaskComponent.disableLayer(UndefinedEntity, Layer)
      assert.equal(hasComponent(UndefinedEntity, ObjectLayerComponents[Layer]), false)
    })
  }) //:: disableLayer

  describe('disableLayers', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.disableLayers(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })

    it('should remove every ObjectLayerComponent from the entity for every ID contained in the `@param layers` list', () => {
      const Layers = [10, 4]
      ObjectLayerMaskComponent.enableLayers(testEntity, ...Layers)
      for (const layer in Layers) assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layers[layer]]), true)
      ObjectLayerMaskComponent.disableLayers(testEntity, ...Layers)
      for (const layer in Layers) assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layers[layer]]), false)
    })
  }) //:: disableLayers

  describe('toggleLayer', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      ObjectLayerMaskComponent.toggleLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })

    it("should add the ObjectLayerComponent with ID `@param layer` to the entity if it doesn't have one", () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), false)
      ObjectLayerMaskComponent.toggleLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), true)
    })

    it('should remove the ObjectLayerComponent with ID `@param layer` from the entity if it already has it', () => {
      const Layer = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), false)
      ObjectLayerMaskComponent.setLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), true)
      ObjectLayerMaskComponent.toggleLayer(testEntity, Layer)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Layer]), false)
    })
  }) //:: toggleLayer

  describe('setMask', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should set the value of the component to `@param mask`', () => {
      const Expected = 42
      ObjectLayerMaskComponent.setMask(testEntity, Expected)
      const result = getComponent(testEntity, ObjectLayerMaskComponent)
      assert.equal(result, Expected)
    })

    it('should set the mask value for the entity to `@param mask`', () => {
      const Expected = 42
      ObjectLayerMaskComponent.setMask(testEntity, Expected)
      const result = ObjectLayerMaskComponent.mask[testEntity]
      assert.equal(result, Expected)
    })

    it('should set an ObjectLayerComponent for every bit of the `@param mask` that is set', () => {
      const ActiveBits = [8, 4, 2]
      const Mask = (1 << 8) | (1 << 4) | (1 << 2)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), false)
      ObjectLayerMaskComponent.setMask(testEntity, Mask)
      for (const id in ActiveBits) assert.equal(hasComponent(testEntity, ObjectLayerComponents[ActiveBits[id]]), true)
    })
  }) //:: setMask
})

describe('ObjectLayerComponents', () => {
  describe('IDs', () => {
    ;[...Array(maxBitWidth)].forEach((_, index, __) => {
      it(`should initialize the ObjectLayerComponents[${index}].name field with the expected value`, () => {
        assert.equal(ObjectLayerComponents[index].name, `ObjectLayer${index}`)
      })
    })
  }) //:: IDs

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should activate the bit for the respective layer ID in ObjectLayerMaskComponent.mask[entity]', () => {
      const Layer = 10
      setComponent(testEntity, ObjectLayerComponents[Layer])
      const hasLayer = Boolean(ObjectLayerMaskComponent.mask[testEntity] & (1 << Layer)) // true when mask contains the Layer bit
      assert.equal(hasLayer, true)
    })
  }) //:: onSet

  describe('onRemove', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should deactivate the bit for the respective layer ID in ObjectLayerMaskComponent.mask[entity]', () => {
      const Layer = 10
      setComponent(testEntity, ObjectLayerComponents[Layer])
      const before = Boolean(ObjectLayerMaskComponent.mask[testEntity] & (1 << Layer)) // true when mask contains the Layer bit
      assert.equal(before, true)
      removeComponent(testEntity, ObjectLayerComponents[Layer])
      const hasLayer = Boolean(ObjectLayerMaskComponent.mask[testEntity] & (1 << Layer)) // true when mask contains the Layer bit
      assert.equal(hasLayer, false)
    })
  }) //:: onRemove
})

describe('Layer', () => {
  describe('constructor', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add an ObjectLayerMaskComponent component to the entity if it doesn't have one", () => {
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      const result = new Layer(testEntity)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })
  }) //:: constructor

  describe('get mask', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should get the mask contained in the ObjectLayerMaskComponent.mask array, for the entity described in the class's data", () => {
      const layer = new Layer(testEntity)
      assert.equal(layer.mask, ObjectLayerMaskComponent.mask[testEntity])
    })
  }) //:: get mask

  describe('set mask', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should set the mask contained in the ObjectLayerMaskComponent.mask array, for the entity described in the class's data, to the value given in the assignment statement", () => {
      const Expected = 42
      const layer = new Layer(testEntity)
      assert.notEqual(ObjectLayerMaskComponent.mask[testEntity], Expected)
      assert.equal(ObjectLayerMaskComponent.mask[testEntity], layer.mask)
      layer.mask = Expected
      assert.equal(ObjectLayerMaskComponent.mask[testEntity], Expected)
    })
  }) //:: set mask

  describe('set', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should set the given `@param channel` layer into the ObjectLayerMaskComponent of the entity described by the class's data", () => {
      const Expected = 10
      const layer = new Layer(testEntity)
      layer.set(Expected)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[Expected]), true)
      assert.equal(getComponent(testEntity, ObjectLayerMaskComponent), 1 << Expected)
    })
  }) //:: set

  describe('enable', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add the ObjectLayerComponent with ID `@param layer` to the entity and add an ObjectLayerMaskComponent to the entity if it doesn't have one", () => {
      const ID = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), false)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      const layer = new Layer(testEntity)
      layer.enable(ID)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), true)
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
    })
  }) //:: enable

  describe('enableAll', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should activate all ObjectLayers for the entity described in the class's data", () => {
      for (const component of ObjectLayerComponents) assert.equal(hasComponent(testEntity, component), false)
      const layer = new Layer(testEntity)
      layer.enableAll()
      for (const component of ObjectLayerComponents) assert.equal(hasComponent(testEntity, component), true)
    })
  }) //:: enableAll

  describe('toggle', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should add the ObjectLayerComponent with ID `@param layer` to the entity if it doesn't have one", () => {
      const ID = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), false)
      const layer = new Layer(testEntity)
      layer.toggle(ID)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), true)
    })

    it('should remove the ObjectLayerComponent with ID `@param layer` to the entity if it already has it', () => {
      const ID = 10
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), false)
      const layer = new Layer(testEntity)
      layer.set(ID)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), true)
      layer.toggle(ID)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), false)
    })
  }) //:: toggle

  describe('disable', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should remove the ObjectLayerComponent with ID `@param layer` from the entity described in the class's data", () => {
      const ID = 10
      const layer = new Layer(testEntity)
      setComponent(testEntity, ObjectLayerComponents[ID])
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), true)
      layer.disable(ID)
      assert.equal(hasComponent(testEntity, ObjectLayerComponents[ID]), false)
    })
  }) //:: disable

  describe('disableAll', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should remove all ObjectLayers from the entity described in the class's data", () => {
      for (const component of ObjectLayerComponents) assert.equal(hasComponent(testEntity, component), false)
      const layer = new Layer(testEntity)
      for (const component of ObjectLayerComponents) setComponent(testEntity, component)
      layer.disableAll()
      for (const component of ObjectLayerComponents) assert.equal(hasComponent(testEntity, component), false)
    })
  }) //:: disableAll

  describe('test', () => {
    let oneEntity = UndefinedEntity
    let twoEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      oneEntity = createEntity()
      twoEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(oneEntity)
      removeEntity(twoEntity)
      return destroyEngine()
    })

    it("should return true when the entity's mask contains all layers of the `@param layers` mask", () => {
      const Mask = (1 << 8) | (1 << 4) | (1 << 2)
      const layerA = new Layer(oneEntity)
      const layerB = new Layer(twoEntity)
      layerA.set(Mask)
      const before = layerA.test(layerB)
      assert.equal(before, false)
      layerB.set(Mask)
      const result = layerA.test(layerB)
      assert.equal(result, true)
    })

    it("should return false when the entity's mask does not contain all layers of the `@param layers` mask", () => {
      const Mask1 = (1 << 8) | (1 << 4) | (1 << 2)
      const Mask2 = (1 << 8) | (1 << 4)
      const layerA = new Layer(oneEntity)
      const layerB = new Layer(twoEntity)
      layerA.set(Mask1)
      const before = layerA.test(layerB)
      assert.equal(before, false)
      layerB.set(Mask2)
      const result = layerA.test(layerB)
      assert.equal(result, false)
    })
  }) //:: test

  describe('isEnabled', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it("should return false when the entity's mask does not contain the `@param channel` layer", () => {
      const ID = 10
      const Other = 4
      const layer = new Layer(testEntity)
      assert.equal(layer.isEnabled(ID), false)
      layer.enable(Other)
      assert.equal(layer.isEnabled(ID), false)
    })

    it("should return true when the entity's mask contains the `@param channel` layer", () => {
      const ID = 10
      const layer = new Layer(testEntity)
      assert.equal(layer.isEnabled(ID), false)
      layer.enable(ID)
      assert.equal(layer.isEnabled(ID), true)
    })
  }) //:: isEnabled
}) //:: Layer
