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
  createEngine,
  createEntity,
  destroyEngine,
  getComponent,
  hasComponent,
  removeEntity,
  serializeComponent,
  setComponent,
  UndefinedEntity
} from '@etherealengine/ecs'
import assert from 'assert'
import { setVisibleComponent, VisibleComponent } from './VisibleComponent'

const VisibleComponentDefault = true

describe('VisibleComponent', () => {
  describe('IDs', () => {
    it('should initialize the VisibleComponent.name field with the expected value', () => {
      assert.equal(VisibleComponent.name, 'VisibleComponent')
    })

    it('should initialize the VisibleComponent.jsonID field with the expected value', () => {
      assert.equal(VisibleComponent.jsonID, 'EE_visible')
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

    it('should set the value of the VisibleComponent correctly', () => {
      assert.notEqual(hasComponent(testEntity, VisibleComponent), VisibleComponentDefault)
      setComponent(testEntity, VisibleComponent)
      assert.equal(getComponent(testEntity, VisibleComponent), VisibleComponentDefault)
    })
  }) //:: onSet

  describe('toJSON', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should serialize the component data as expected', () => {
      setComponent(testEntity, VisibleComponent)
      const result = serializeComponent(testEntity, VisibleComponent)
      assert.equal(typeof result, 'boolean')
      assert.equal(result, true)
    })
  }) //:: toJSON
}) //:: VisibleComponent

describe('setVisibleComponent', () => {
  let testEntity = UndefinedEntity

  beforeEach(async () => {
    createEngine()
    testEntity = createEntity()
  })

  afterEach(() => {
    removeEntity(testEntity)
    return destroyEngine()
  })

  it("should add a VisibleComponent to the entity when it doesn't have one and `@param visible` is set to true", () => {
    assert.equal(hasComponent(testEntity, VisibleComponent), false)
    setVisibleComponent(testEntity, true)
    assert.equal(hasComponent(testEntity, VisibleComponent), true)
  })

  it('should remove the VisibleComponent from the entity when it has one and `@param visible` is set to false', () => {
    assert.equal(hasComponent(testEntity, VisibleComponent), false)
    setVisibleComponent(testEntity, true)
    assert.equal(hasComponent(testEntity, VisibleComponent), true)
    setVisibleComponent(testEntity, false)
    assert.equal(hasComponent(testEntity, VisibleComponent), false)
  })
}) //:: setVisibleComponent
