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
  defineQuery,
  destroyEngine,
  getComponent,
  getMutableComponent,
  hasComponent,
  removeComponent,
  removeEntity,
  setComponent,
  UndefinedEntity
} from '@etherealengine/ecs'
import { getMutableState, getState } from '@etherealengine/hyperflux'
import assert from 'assert'
import { Color, ShaderMaterial } from 'three'
import { NameComponent } from '../../common/NameComponent'
import { assertFloatApproxEq, assertFloatApproxNotEq } from '../../physics/classes/Physics.test'
import { EntityTreeComponent } from '../../transform/components/EntityTree'
import { RendererState } from '../RendererState'
import { createInfiniteGridHelper, InfiniteGridComponent } from './InfiniteGridHelper'
import { LineSegmentComponent } from './LineSegmentComponent'
import { MeshComponent } from './MeshComponent'
import { VisibleComponent } from './VisibleComponent'

type InfiniteGridComponentData = {
  size: number
  color: Color
  distance: number
}

const InfiniteGridComponentDefaults = {
  size: 1,
  color: new Color(0x535353),
  distance: 200
} as InfiniteGridComponentData

function assertInfiniteGridComponentEq(A: InfiniteGridComponentData, B: InfiniteGridComponentData) {
  assert.equal(A.size, B.size)
  assertFloatApproxEq(A.color.r, B.color.r)
  assertFloatApproxEq(A.color.g, B.color.g)
  assertFloatApproxEq(A.color.b, B.color.b)
  assert.equal(A.distance, B.distance)
}

function assertInfiniteGridComponentNotEq(A: InfiniteGridComponentData, B: InfiniteGridComponentData) {
  assert.notEqual(A.size, B.size)
  assertFloatApproxNotEq(A.color.r, B.color.r)
  assertFloatApproxNotEq(A.color.g, B.color.g)
  assertFloatApproxNotEq(A.color.b, B.color.b)
  assert.notEqual(A.distance, B.distance)
}

describe('InfiniteGridComponent', () => {
  describe('IDs', () => {
    it('should initialize the InfiniteGridComponent.name field with the expected value', () => {
      assert.equal(InfiniteGridComponent.name, 'InfiniteGridComponent')
    })
  }) //:: IDs

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, InfiniteGridComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, InfiniteGridComponent)
      assertInfiniteGridComponentEq(data, InfiniteGridComponentDefaults)
    })
  }) //:: onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, InfiniteGridComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should change the values of an initialized InfiniteGridComponent', () => {
      const Expected = {
        size: 42,
        color: new Color(0x123456),
        distance: 10_000
      }
      const data = getComponent(testEntity, InfiniteGridComponent)
      assertInfiniteGridComponentEq(data, InfiniteGridComponentDefaults)
      setComponent(testEntity, InfiniteGridComponent, Expected)
      assertInfiniteGridComponentNotEq(data, InfiniteGridComponentDefaults)
      assertInfiniteGridComponentEq(data, Expected)
    })

    it('should not change values of an initialized InfiniteGridComponent when the data passed had incorrect types', () => {
      const Incorrect = {
        size: 'somesize',
        color: 42,
        distance: 'somedistance'
      }
      const data = getComponent(testEntity, InfiniteGridComponent)
      assertInfiniteGridComponentEq(data, InfiniteGridComponentDefaults)
      // @ts-ignore Coerce the data with incorrect types into the setComponent call
      setComponent(testEntity, InfiniteGridComponent, Incorrect)
      assertInfiniteGridComponentEq(data, InfiniteGridComponentDefaults)
    })
  }) //:: onSet

  describe('reactor', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, InfiniteGridComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should trigger when engineRendererSettings.gridHeight changes', () => {
      const Expected = 42
      const gridHeightBefore = getState(RendererState).gridHeight
      getMutableState(RendererState).gridHeight.set(Expected)
      const gridHeightAfter = getState(RendererState).gridHeight
      assert.notEqual(gridHeightBefore, gridHeightAfter)
      // Run and Check the result
      InfiniteGridComponent.reactorMap.get(testEntity)!.run() // Reactor is already running. But force-run it so changes are applied immediately
      assert.equal(getComponent(testEntity, MeshComponent).position.y, Expected)
    })

    it('should trigger when component.color changes', () => {
      const Expected = new Color(0xffffff)
      assert.notDeepEqual(getComponent(testEntity, InfiniteGridComponent).color, Expected)
      getMutableComponent(testEntity, InfiniteGridComponent).color.set(Expected)
      assert.deepEqual(getComponent(testEntity, InfiniteGridComponent).color, Expected)
      // Run and Check the result
      InfiniteGridComponent.reactorMap.get(testEntity)!.run() // Reactor is already running. But force-run it so changes are applied immediately
      const result = getComponent(testEntity, MeshComponent).material as ShaderMaterial
      assert.equal(result.uniforms.uColor.value, Expected)
    })

    it('should trigger when component.size changes', () => {
      const Expected = 42
      assert.notEqual(getComponent(testEntity, InfiniteGridComponent).size, Expected)
      getMutableComponent(testEntity, InfiniteGridComponent).size.set(Expected)
      assert.equal(getComponent(testEntity, InfiniteGridComponent).size, Expected)
      // Run and Check the result
      InfiniteGridComponent.reactorMap.get(testEntity)!.run() // Reactor is already running. But force-run it so changes are applied immediately
      const result = getComponent(testEntity, MeshComponent).material as ShaderMaterial
      assert.equal(result.uniforms.uSize1.value, Expected)
      assert.equal(result.uniforms.uSize2.value, Expected * 10)
    })

    describe('when distance changes ...', () => {
      it("... should change the uniforms.uDistance value for the Mesh's ShaderMaterial", () => {
        const Expected = 42
        assert.notEqual(getComponent(testEntity, InfiniteGridComponent).distance, Expected)
        getMutableComponent(testEntity, InfiniteGridComponent).distance.set(Expected)
        assert.equal(getComponent(testEntity, InfiniteGridComponent).distance, Expected)
        // Run and Check the result
        InfiniteGridComponent.reactorMap.get(testEntity)!.run() // Reactor is already running. But force-run it so changes are applied immediately
        const result = getComponent(testEntity, MeshComponent).material as ShaderMaterial
        assert.equal(result.uniforms.uDistance.value, Expected)
      })

      const LineColors = ['red', 'green', 'blue'] // duplicate of the lineColors array inside the component.distance useEffect
      const LineQuery = defineQuery([LineSegmentComponent])
      it('... should create, for every line color, an entity that has a LineSegmentComponent with name `infinite-grid-helper-line-${i}`', () => {
        const Names = ['infinite-grid-helper-line-0', 'infinite-grid-helper-line-1', 'infinite-grid-helper-line-2']
        assert.equal(LineQuery().length, LineColors.length)
        for (const entity of LineQuery()) {
          assert.equal(Names.includes(getComponent(entity, LineSegmentComponent).name), true)
        }
      })

      it('... should create, for every line color, an entity that has an EntityTreeComponent whose parent should be the entityContext', () => {
        assert.equal(LineQuery().length, LineColors.length)
        for (const entity of LineQuery()) {
          assert.equal(getComponent(entity, EntityTreeComponent).parentEntity, testEntity)
        }
      })

      it('... should remove all lineEntities of the grid when the InfiniteGridComponent is removed from the entity', () => {
        assert.equal(LineQuery().length, LineColors.length)
        removeComponent(testEntity, InfiniteGridComponent)
        assert.equal(LineQuery().length, 0)
      })
    })
  }) //:: reactor
})

describe('createInfiniteGridHelper', () => {
  beforeEach(async () => {
    createEngine()
  })

  afterEach(() => {
    return destroyEngine()
  })

  it('should return a valid entity', () => {
    const result = createInfiniteGridHelper()
    assert.notEqual(result, UndefinedEntity)
  })

  it('should assign an EntityTreeComponent to the returned entity', () => {
    const result = createInfiniteGridHelper()
    assert.equal(hasComponent(result, EntityTreeComponent), true)
  })

  it('should assign an InfiniteGridComponent to the returned entity', () => {
    const result = createInfiniteGridHelper()
    assert.equal(hasComponent(result, InfiniteGridComponent), true)
  })

  it("should assign a NameComponent to the returned entity, with a value of 'Infinite Grid Helper'", () => {
    const result = createInfiniteGridHelper()
    assert.equal(hasComponent(result, NameComponent), true)
    assert.equal(getComponent(result, NameComponent), 'Infinite Grid Helper')
  })

  it('should assign a VisibleComponent to the returned entity, with a value of `true`', () => {
    const result = createInfiniteGridHelper()
    assert.equal(hasComponent(result, VisibleComponent), true)
  })
})
