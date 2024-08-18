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

import { act, render } from '@testing-library/react'
import assert from 'assert'
import React, { useEffect } from 'react'

import { ReactorRoot, startReactor } from '@etherealengine/hyperflux'
import {
  ComponentMap,
  getComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  serializeComponent,
  setComponent
} from './ComponentFunctions'
import { createEngine, destroyEngine } from './Engine'
import { Entity, EntityUUID, UndefinedEntity } from './Entity'
import { EntityContext, createEntity, removeEntity } from './EntityFunctions'
import { UUIDComponent } from './UUIDComponent'

describe('UUIDComponent', () => {
  const TestUUID = 'TestUUID' as EntityUUID
  const TestUUID2 = UUIDComponent.generateUUID()
  let entity1 = UndefinedEntity
  let entity2 = UndefinedEntity

  beforeEach(() => {
    createEngine()
    ComponentMap.clear()
    entity1 = createEntity()
    entity2 = createEntity()
  })

  afterEach(() => {
    removeEntity(entity1)
    removeEntity(entity2)
    return destroyEngine()
  })

  describe('onSet', () => {
    it('should throw an Error exception when the uuid argument is not passed.', () => {
      assert.throws(() => {
        setComponent(entity1, UUIDComponent)
      }, Error)
    })

    it('should set/get the data of the component.', () => {
      // Case1: set/get
      setComponent(entity1, UUIDComponent, TestUUID)
      const component1 = getComponent(entity1, UUIDComponent)
      assert.ok(component1, 'The UUIDComponent did not get set correctly')
      assert.equal(component1, TestUUID, 'The UUID value did not get set correctly')
    })

    it("shouldn't change the data when set multiple times with the same data", () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      const component1 = getComponent(entity1, UUIDComponent)
      setComponent(entity1, UUIDComponent, TestUUID)
      const component2 = getComponent(entity1, UUIDComponent)
      assert.equal(component1, component2)
    })

    it('Should throw an error when the UUID is already in use for another entity', () => {
      let root = undefined as ReactorRoot | undefined
      setComponent(entity1, UUIDComponent, TestUUID)
      setComponent(entity2, UUIDComponent, TestUUID)
      const reactor = UUIDComponent.reactorMap.get(entity2)?.Reactor
      root = startReactor(() => {
        return React.createElement(EntityContext.Provider, { value: entity2 }, React.createElement(reactor!, {}))
      }) as ReactorRoot

      assert(root?.errors.length)
      root?.stop()
    })

    it('should remove the old uuid from the entity', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      setComponent(entity1, UUIDComponent, TestUUID2)
      assert.notEqual(getComponent(entity1, UUIDComponent), TestUUID)
    })

    it('should set a new uuid, and return its value when called with getOptionalComponent', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      assert.notEqual(getOptionalComponent(entity1, UUIDComponent), undefined)
    })
  })

  describe('toJson', () => {
    it('should return correctly serialized data', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      const json = serializeComponent(entity1, UUIDComponent)
      assert.equal(json, TestUUID as string)
    })
  })

  describe('onRemove', () => {
    it('should remove the component from the entity', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      removeComponent(entity1, UUIDComponent)
      assert.equal(UndefinedEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(false, hasComponent(entity1, UUIDComponent))
      assert.equal(getOptionalComponent(entity1, UUIDComponent), undefined)
    })

    it('should do nothing if the entity does not have the component', () => {
      removeComponent(entity1, UUIDComponent)
      assert.equal(UndefinedEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(getOptionalComponent(entity1, UUIDComponent), undefined)
    })
  })

  describe('getEntityByUUID', () => {
    it('should return the correct entity', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      const testEntity = UUIDComponent.getEntityByUUID(TestUUID)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(testEntity, entity1)
    })

    it('should return the correct entity when its UUIDComponent is removed and added back with a different UUID', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      removeComponent(entity1, UUIDComponent)
      setComponent(entity1, UUIDComponent, TestUUID2)
      const testEntity = UUIDComponent.getEntityByUUID(TestUUID2)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID2))
    })

    it('should return UndefinedEntity when the UUID has not been added to any entity', () => {
      const testEntity = UUIDComponent.getEntityByUUID(TestUUID)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(testEntity, UndefinedEntity)
    })
  })

  describe('getOrCreateEntityByUUID', () => {
    it('should return the correct entity when it exists', () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      const testEntity = UUIDComponent.getOrCreateEntityByUUID(TestUUID)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(testEntity, entity1)
    })

    it("should create a new entity when the UUID hasn't been added to any entity", () => {
      setComponent(entity1, UUIDComponent, TestUUID)
      const testEntity = UUIDComponent.getOrCreateEntityByUUID(TestUUID2)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID2))
      assert.notEqual(testEntity, entity1)
    })
  })
  describe('generateUUID', () => {
    it('should generate a non-empty UUID', () => {
      const uuid = UUIDComponent.generateUUID()
      assert.notEqual(uuid, '' as EntityUUID)
    })

    const iter = 8_500 /** @note 10_000 iterations takes ~4sec on an AMD Ryzen 5 2600 */
    it(`should generate unique UUIDs when run multiple times  (${iter} iterations)`, () => {
      const list = [] as EntityUUID[]
      // Generate the list of (supposedly) unique UUIDs
      for (let id = 0; id < iter; id++) {
        list.push(UUIDComponent.generateUUID())
      }
      // Compare every UUID with all other UUIDs
      for (let id = 0; id < iter; id++) {
        const A = list[id]
        for (const B in list.filter((n) => n !== list[id])) {
          // For every other uuid that is not the current one
          assert.notEqual(A, B, 'Found two identical UUIDs')
        }
      }
    })
  })
})

describe('UUIDComponent Hooks', async () => {
  describe('useEntityByUUID', async () => {
    type ResultType = Entity | undefined
    const TestUUID = 'TestUUID' as EntityUUID
    let entity1 = UndefinedEntity
    let entity2 = UndefinedEntity
    let result: ResultType = undefined
    let counter = 0

    beforeEach(() => {
      createEngine()
      ComponentMap.clear()
      entity1 = createEntity()
      entity2 = createEntity()
    })

    afterEach(() => {
      counter = 0
      removeEntity(entity1)
      removeEntity(entity2)
      return destroyEngine()
    })

    // Define the Reactor that will run the tested hook
    const Reactor = () => {
      const data = UUIDComponent.useEntityByUUID(TestUUID)
      useEffect(() => {
        result = data as ResultType
        ++counter
      }, [data])
      return null
    }

    it('assigns the correct entity', async () => {
      const ExpectedValue: ResultType = entity1
      setComponent(entity1, UUIDComponent, TestUUID)
      assert.equal(counter, 0, "The reactor shouldn't have run before rendering")
      const tag = <Reactor />
      const { rerender, unmount } = render(tag)
      await act(() => rerender(tag))
      assert.equal(counter, 1, `The reactor has run an incorrect number of times: ${counter}`)
      assert.notEqual(result, undefined, "The result data didn't get assigned.")
      assert.equal(result, ExpectedValue, `Did not return the correct data. result = ${result}`)
      unmount()
    })

    it('returns the same entity than genEntityByUUID', async () => {
      const ExpectedValue: ResultType = entity1
      setComponent(entity1, UUIDComponent, TestUUID)
      const testEntity = UUIDComponent.getEntityByUUID(TestUUID)
      assert.equal(counter, 0, "The reactor shouldn't have run before rendering")
      const tag = <Reactor />
      const { rerender, unmount } = render(tag)
      await act(() => rerender(tag))
      assert.equal(counter, 1, `The reactor has run an incorrect number of times: ${counter}`)
      assert.notEqual(result, undefined, "The result data didn't get assigned.")
      assert.equal(result, ExpectedValue, `Did not return the correct data. result = ${result}`)
      assert.equal(testEntity, UUIDComponent.getEntityByUUID(TestUUID))
      assert.equal(testEntity, ExpectedValue)
      unmount()
    })
  }) // useComponent
})
