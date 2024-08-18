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
  removeEntity,
  setComponent,
  UndefinedEntity
} from '@etherealengine/ecs'
import assert from 'assert'
import { BoxGeometry, Mesh, Object3D } from 'three'
import { NameComponent } from '../../common/NameComponent'
import { Object3DComponent } from './Object3DComponent'

const Object3DComponentDefaults = null! as Object3D

function assertObject3DComponentEq(A: Object3D, B: Object3D) {
  assert.equal(Boolean(A), Boolean(B))
  assert.equal(A.isObject3D, B.isObject3D)
  assert.equal(A.uuid, B.uuid)
}

describe('Object3DComponent', () => {
  describe('IDs', () => {
    it('should initialize the Object3DComponent.name field with the expected value', () => {
      assert.equal(Object3DComponent.name, 'Object3DComponent')
    })

    it('should initialize the Object3DComponent.jsonID field with the expected value', () => {
      assert.equal(Object3DComponent.jsonID, 'EE_object3d')
    })
  }) //:: IDs

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const Expected = new Mesh(new BoxGeometry())
      setComponent(testEntity, Object3DComponent, Expected)
      const data = getComponent(testEntity, Object3DComponent)
      assertObject3DComponentEq(data, Expected)
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

    it('should throw an error if the data assigned does not provide a valid `Object3D` object', () => {
      assert.throws(() => setComponent(testEntity, Object3DComponent))
    })

    it('should not throw an error if the data assigned provides a valid `Object3D` object', () => {
      assert.doesNotThrow(() => setComponent(testEntity, Object3DComponent, new Mesh(new BoxGeometry())))
    })

    it('should change the values of an initialized Object3DComponent', () => {
      setComponent(testEntity, Object3DComponent, new Mesh(new BoxGeometry()))
      const before = getComponent(testEntity, Object3DComponent).uuid
      setComponent(testEntity, Object3DComponent, new Mesh(new BoxGeometry()))
      const after = getComponent(testEntity, Object3DComponent).uuid
      assert.notEqual(before, after)
    })

    it("should set the object3d.name to the value of the entity's NameComponent when the entity has one", () => {
      const Expected = 'testEntity'
      setComponent(testEntity, NameComponent, Expected)
      setComponent(testEntity, Object3DComponent, new Mesh(new BoxGeometry()))
      assert.equal(getComponent(testEntity, Object3DComponent).name, Expected)
    })

    it("should not set the object3d.name when the entity doesn't have a NameComponent", () => {
      setComponent(testEntity, Object3DComponent, new Mesh(new BoxGeometry()))
      const result = getComponent(testEntity, Object3DComponent).name
      assert.equal(result, '')
    })
  }) //:: onSet

  /** @todo This component should have a reactor that updates the name of the object when a NameComponent is set on the entity after its Object3DComponent is set? */
})
