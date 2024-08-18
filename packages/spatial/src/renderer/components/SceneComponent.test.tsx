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
  UndefinedEntity,
  createEngine,
  createEntity,
  destroyEngine,
  getComponent,
  removeEntity,
  setComponent
} from '@etherealengine/ecs'
import { ImmutableObject } from '@etherealengine/hyperflux'
import assert from 'assert'
import { Color, CubeTexture, FogBase, Texture } from 'three'
import { BackgroundComponent, EnvironmentMapComponent, FogComponent, SceneComponent } from './SceneComponents'

describe('SceneComponent', () => {
  describe('IDs', () => {
    it('should initialize the SceneComponent.name field with the expected value', () => {
      assert.equal(SceneComponent.name, 'SceneComponent')
    })
  }) //:: IDs
})

type BackgroundComponentData = ImmutableObject<Color> | ImmutableObject<Texture> | ImmutableObject<CubeTexture>
const BackgroundComponentDefaults = null! as BackgroundComponentData

function assertBackgroundComponentEq(A: BackgroundComponentData, B: BackgroundComponentData) {
  assert.equal(Boolean(A), Boolean(B))
  const a = (A !== null && A.toJSON) || A
  const b = (B !== null && B.toJSON) || B
  assert.deepEqual(a, b)
}

function assertBackgroundComponentNotEq(A: BackgroundComponentData, B: BackgroundComponentData) {
  const a = (A !== null && A.toJSON) || A
  const b = (B !== null && B.toJSON) || B
  assert.notDeepEqual(a, b)
}

describe('BackgroundComponent', () => {
  describe('IDs', () => {
    it('should initialize the BackgroundComponent.name field with the expected value', () => {
      assert.equal(BackgroundComponent.name, 'BackgroundComponent')
    })
  }) //:: IDs

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, BackgroundComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, BackgroundComponent)
      assertBackgroundComponentEq(data, BackgroundComponentDefaults)
    })
  }) //:: onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, BackgroundComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should change the values of an initialized BackgroundComponent', () => {
      const before = getComponent(testEntity, BackgroundComponent)
      setComponent(testEntity, BackgroundComponent, new Color('#123456'))
      const after = getComponent(testEntity, BackgroundComponent)
      assertBackgroundComponentNotEq(before, after)
    })

    it('should not change values of an initialized BackgroundComponent when the data passed had incorrect types', () => {
      const before = getComponent(testEntity, BackgroundComponent)
      // @ts-ignore Coerce an incorrect type into the component's data
      setComponent(testEntity, BackgroundComponent, '#123456')
      const after = getComponent(testEntity, BackgroundComponent)
      assertBackgroundComponentEq(before, after)
    })
  }) //:: onSet
}) //:: BackgroundComponent

const EnvironmentMapComponentDefaults = null! as Texture

function assertEnvironmentMapComponentEq(A: Texture, B: Texture) {
  assert.deepEqual(A, B)
}

function assertEnvironmentMapComponentNotEq(A: Texture, B: Texture) {
  assert.notDeepEqual(A, B)
}

describe('EnvironmentMapComponent', () => {
  describe('IDs', () => {
    it('should initialize the EnvironmentMapComponent.name field with the expected value', () => {
      assert.equal(EnvironmentMapComponent.name, 'EnvironmentMapComponent')
    })
  }) //:: IDs

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, EnvironmentMapComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, EnvironmentMapComponent)
      assertEnvironmentMapComponentEq(data, EnvironmentMapComponentDefaults)
    })
  }) //:: onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, EnvironmentMapComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should change the values of an initialized EnvironmentMapComponent', () => {
      const before = getComponent(testEntity, EnvironmentMapComponent)
      setComponent(testEntity, EnvironmentMapComponent, new Texture({} as OffscreenCanvas, 303))
      const after = getComponent(testEntity, EnvironmentMapComponent)
      assertEnvironmentMapComponentNotEq(before, after)
    })

    it('should not change values of an initialized EnvironmentMapComponent when the data passed had incorrect types', () => {
      const before = getComponent(testEntity, EnvironmentMapComponent)
      // @ts-ignore Coerce an incorrect type into the component's data
      setComponent(testEntity, EnvironmentMapComponent, '#123456')
      const after = getComponent(testEntity, EnvironmentMapComponent)
      assertEnvironmentMapComponentEq(before, after)
    })
  }) //:: onSet
}) //:: EnvironmentMapComponent

type FogData = FogBase
const FogComponentDefaults = null! as FogData

function assertFogComponentEq(A: FogData, B: FogData) {
  assert.equal(Boolean(A), Boolean(B))
  if (!A && !B) return
  const a = {
    name: (A !== null && A.name) || A,
    color: (A !== null && A.color) || A,
    json: (A !== null && A.toJSON) || A
  }
  const b = {
    name: (B !== null && B.name) || B,
    color: (B !== null && B.color) || B,
    json: (B !== null && B.toJSON) || B
  }
  assert.equal(a.name, b.name)
  assert.deepEqual(a.color, b.color)
  assert.deepEqual(a.json, b.json)
}

function assertFogComponentNotEq(A: FogData, B: FogData) {
  const a = (A !== null && A.toJSON) || A
  const b = (B !== null && B.toJSON) || B
  assert.notDeepEqual(a, b)
}

describe('FogComponent', () => {
  describe('IDs', () => {
    it('should initialize the FogComponent.name field with the expected value', () => {
      assert.equal(FogComponent.name, 'FogComponent')
    })
  }) //:: IDs

  describe('onInit', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, FogComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should initialize the component with the expected default values', () => {
      const data = getComponent(testEntity, FogComponent)
      assertFogComponentEq(data, FogComponentDefaults)
    })
  }) //:: onInit

  describe('onSet', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
      setComponent(testEntity, FogComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should change the values of an initialized FogComponent', () => {
      const before = getComponent(testEntity, FogComponent)
      setComponent(testEntity, FogComponent, { name: 'testFog' } as FogData)
      const after = getComponent(testEntity, FogComponent)
      assertFogComponentNotEq(before, after)
    })

    it('should not change values of an initialized FogComponent when the data passed had incorrect types', () => {
      const before = getComponent(testEntity, FogComponent)
      // @ts-ignore Coerce an incorrect type into the component's data
      setComponent(testEntity, FogComponent, '#123456')
      const after = getComponent(testEntity, FogComponent)
      assertFogComponentEq(before, after)
    })
  }) //:: onSet
}) //:: FogComponent
