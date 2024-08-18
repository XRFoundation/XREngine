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
import sinon from 'sinon'
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ColorRepresentation,
  LineBasicMaterial,
  LineSegments,
  Material,
  MeshBasicMaterial,
  SphereGeometry
} from 'three'

import {
  Entity,
  getComponent,
  getMutableComponent,
  hasComponent,
  removeComponent,
  setComponent,
  UndefinedEntity
} from '@etherealengine/ecs'
import { destroyEngine } from '@etherealengine/ecs/src/Engine'
import { createEntity, removeEntity } from '@etherealengine/ecs/src/EntityFunctions'
import { getState } from '@etherealengine/hyperflux'

import { createEngine } from '@etherealengine/ecs/src/Engine'
import { NameComponent } from '../../common/NameComponent'
import { ResourceState } from '../../resources/ResourceState'
import { ObjectLayerMasks, ObjectLayers } from '../constants/ObjectLayers'
import { GroupComponent } from './GroupComponent'
import { LineSegmentComponent } from './LineSegmentComponent'
import { ObjectLayerComponents, ObjectLayerMaskComponent } from './ObjectLayerComponent'
import { VisibleComponent } from './VisibleComponent'

type LineSegmentComponentData = {
  name: string
  geometry: BufferGeometry
  material: Material & { color: Color }
  color: undefined | ColorRepresentation
  layerMask: typeof ObjectLayers.NodeHelper
  entity: undefined | Entity
}

const LineSegmentComponentDefaults = {
  name: 'line-segment',
  geometry: null!,
  material: new LineBasicMaterial(),
  color: undefined,
  layerMask: ObjectLayers.NodeHelper,
  entity: undefined
} as LineSegmentComponentData

function assertLineSegmentComponentEq(A: LineSegmentComponentData, B: LineSegmentComponentData) {
  if (A === null && B === null) return
  assert.equal(A.name, B.name)
  if (A.geometry === null && B.geometry === null) assert(true)
  else if (A.geometry === null) assert(false, 'Geometry of A is not equal to B. B has geometry, but A.geometry is null')
  else if (B.geometry === null) assert(false, 'Geometry of B is not equal to A. A has geometry, but B.geometry is null')
  else assert.deepEqual(A.geometry, B.geometry)
  assert.deepEqual(A.material, B.material)
  assert.deepEqual(A.color, B.color)
  assert.equal(A.layerMask, B.layerMask)
  assert.equal(A.entity, B.entity)
}

describe('LineSegmentComponent', () => {
  describe('IDs', () => {
    it('should initialize the LineSegmentComponent.name field with the expected value', () => {
      assert.equal(LineSegmentComponent.name, 'LineSegmentComponent')
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

    it('should initialize the component with the expected values', () => {
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })
      const Expected = LineSegmentComponentDefaults
      Expected.geometry = geometry
      Expected.material = material
      setComponent(testEntity, LineSegmentComponent, { geometry: geometry, material: material })
      const data = getComponent(testEntity, LineSegmentComponent)
      assertLineSegmentComponentEq(data, Expected)
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

    it('should throw an error if the data assigned does not provide a valid `LineSegmentComponent.geometry` object', () => {
      const material = new MeshBasicMaterial({ color: 0xffff00 })
      assert.throws(() => setComponent(testEntity, LineSegmentComponent, { material: material }))
    })

    it('should change the values of an initialized LineSegmentComponent', () => {
      const geometry1 = new BoxGeometry(1, 1, 1)
      const material1 = new MeshBasicMaterial({ color: 0x111111 })
      const Expected = LineSegmentComponentDefaults
      Expected.geometry = geometry1
      Expected.material = material1
      setComponent(testEntity, LineSegmentComponent, { geometry: geometry1, material: material1 })
      const data = getComponent(testEntity, LineSegmentComponent)
      assertLineSegmentComponentEq(data, Expected)

      const geometry2 = new BoxGeometry(2, 2, 2)
      const material2 = new MeshBasicMaterial({ color: 0x222222 })
      setComponent(testEntity, LineSegmentComponent, { geometry: geometry2, material: material2 })
      Expected.geometry = geometry2
      Expected.material = material2
      const result = getComponent(testEntity, LineSegmentComponent)
      assertLineSegmentComponentEq(result, Expected)
    })
  }) //:: onSet

  describe('reactor', () => {
    let testEntity = UndefinedEntity

    beforeEach(async () => {
      createEngine()
      testEntity = createEntity()
    })

    afterEach(() => {
      removeEntity(testEntity)
      return destroyEngine()
    })

    it('should call addObjectToGroup(lineSegment) with the entity when it mounts', () => {
      assert.equal(hasComponent(testEntity, GroupComponent), false)
      setComponent(testEntity, LineSegmentComponent, {
        geometry: new BoxGeometry(1, 1, 1),
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(hasComponent(testEntity, GroupComponent), true)
    })

    it('should set a VisibleComponent to the entity when it mounts', () => {
      assert.equal(hasComponent(testEntity, VisibleComponent), false)
      setComponent(testEntity, LineSegmentComponent, {
        geometry: new BoxGeometry(1, 1, 1),
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(hasComponent(testEntity, VisibleComponent), true)
    })

    it('should call removeObjectFromGroup(lineSegment) with the entity when it unmounts', () => {
      assert.equal(hasComponent(testEntity, GroupComponent), false)
      setComponent(testEntity, LineSegmentComponent, {
        geometry: new BoxGeometry(1, 1, 1),
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(hasComponent(testEntity, GroupComponent), true)
      removeComponent(testEntity, GroupComponent)
      assert.equal(hasComponent(testEntity, GroupComponent), false)
    })

    it('should trigger when component.name changes', () => {
      const Expected = 'TestLineName'
      assert.equal(hasComponent(testEntity, NameComponent), false)
      const geometry = new BoxGeometry(1, 1, 1)
      setComponent(testEntity, LineSegmentComponent, {
        geometry: geometry,
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(hasComponent(testEntity, NameComponent), true)
      setComponent(testEntity, LineSegmentComponent, {
        name: Expected,
        geometry: geometry,
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      const result = getComponent(testEntity, NameComponent)
      assert.equal(result, Expected)
    })

    it('should trigger when component.layerMask changes', () => {
      const Expected = 42
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), false)
      const geometry = new BoxGeometry(1, 1, 1)
      setComponent(testEntity, LineSegmentComponent, {
        geometry: geometry,
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(hasComponent(testEntity, ObjectLayerMaskComponent), true)
      assert.notEqual(getComponent(testEntity, ObjectLayerMaskComponent), Expected)
      setComponent(testEntity, LineSegmentComponent, {
        layerMask: Expected,
        geometry: geometry,
        material: new MeshBasicMaterial({ color: 0x111111 })
      })
      assert.equal(getComponent(testEntity, ObjectLayerMaskComponent), Expected)
    })

    it('should set the LineSegment layerMask correctly', (done) => {
      const entity = createEntity()
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })

      const layerMask = ObjectLayerMasks.NodeHelper
      const layer = ObjectLayers.NodeHelper

      const Reactor = () => {
        useEffect(() => {
          setComponent(entity, LineSegmentComponent, {
            geometry: geometry,
            material: material,
            layerMask: layerMask
          })
          return () => {
            removeComponent(entity, LineSegmentComponent)
          }
        }, [])

        return <></>
      }

      const { rerender, unmount } = render(<Reactor />)

      act(async () => {
        rerender(<Reactor />)
      }).then(() => {
        assert(hasComponent(entity, LineSegmentComponent))
        assert(hasComponent(entity, GroupComponent))
        assert(hasComponent(entity, ObjectLayerMaskComponent))
        assert(hasComponent(entity, ObjectLayerComponents[layer]))
        const group = getComponent(entity, GroupComponent)
        const lineSegments = group[0] as LineSegments
        assert(lineSegments.isLineSegments)
        assert(lineSegments.layers.mask === layerMask)
        unmount()
        removeEntity(entity)
        done()
      })
    })

    it('should trigger when component.color changes', () => {
      const Expected = new Color('#123456')
      assert.equal(hasComponent(testEntity, NameComponent), false)
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0x111111 })
      setComponent(testEntity, LineSegmentComponent, {
        geometry: geometry,
        material: material
      })
      assert.notDeepEqual(getComponent(testEntity, LineSegmentComponent).material.color, Expected)
      setComponent(testEntity, LineSegmentComponent, {
        color: Expected,
        geometry: geometry,
        material: material
      })
      const result = getComponent(testEntity, LineSegmentComponent).material.color
      assert.deepEqual(result, Expected)
    })

    it('should create a LineSegmentComponent correctly', (done) => {
      const entity = createEntity()
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })

      const Reactor = () => {
        useEffect(() => {
          setComponent(entity, LineSegmentComponent, { geometry: geometry, material: material })
        }, [])

        return <></>
      }

      const { rerender, unmount } = render(<Reactor />)

      const resourceState = getState(ResourceState)

      act(async () => {
        assert(hasComponent(entity, LineSegmentComponent))
        assert(resourceState.resources[geometry.uuid])
        assert(resourceState.resources[material.uuid])
        removeEntity(entity)
        unmount()
      }).then(() => {
        assert(!hasComponent(entity, LineSegmentComponent))
        assert(!resourceState.resources[geometry.uuid])
        assert(!resourceState.resources[material.uuid])
        done()
      })
    })

    it('should update the LineSegmentComponent data correctly', (done) => {
      const entity = createEntity()
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })

      const spy = sinon.spy()
      geometry.dispose = spy
      material.dispose = spy

      const geoResourceID = geometry.uuid
      const matResourceID = material.uuid

      const geometry2 = new SphereGeometry(0.5)
      const material2 = new LineBasicMaterial()

      geometry2.dispose = spy
      material2.dispose = spy

      const Reactor = () => {
        useEffect(() => {
          setComponent(entity, LineSegmentComponent, { geometry: geometry, material: material })
        }, [])

        return <></>
      }

      const { rerender, unmount } = render(<Reactor />)

      const resourceState = getState(ResourceState)
      act(async () => {
        assert(hasComponent(entity, LineSegmentComponent))
        assert(resourceState.resources[geoResourceID])
        assert(
          resourceState.resources[geoResourceID].asset &&
            (resourceState.resources[geoResourceID].asset as BoxGeometry).type === 'BoxGeometry'
        )
        assert(resourceState.resources[matResourceID])
        assert(
          resourceState.resources[matResourceID].asset &&
            (resourceState.resources[matResourceID].asset as MeshBasicMaterial).type === 'MeshBasicMaterial'
        )
        const lineSegmentComponent = getMutableComponent(entity, LineSegmentComponent)
        lineSegmentComponent.geometry.set(geometry2)
        lineSegmentComponent.material.set(material2)
        rerender(<Reactor />)
      }).then(() => {
        sinon.assert.calledTwice(spy)
        assert(
          resourceState.resources[geoResourceID].asset &&
            (resourceState.resources[geoResourceID].asset as SphereGeometry).type === 'SphereGeometry'
        )
        assert(
          resourceState.resources[matResourceID].asset &&
            (resourceState.resources[matResourceID].asset as LineBasicMaterial).type === 'LineBasicMaterial'
        )
        removeEntity(entity)
        assert(!hasComponent(entity, LineSegmentComponent))
        assert(!resourceState.resources[geoResourceID])
        assert(!resourceState.resources[matResourceID])
        assert(spy.callCount === 4)
        unmount()
        done()
      })
    })

    it('should remove the LineSegmentComponent resources when it is unmounted', (done) => {
      const entity = createEntity()
      const geometry = new BoxGeometry(1, 1, 1)
      const material = new MeshBasicMaterial({ color: 0xffff00 })

      const spy = sinon.spy()
      geometry.dispose = spy
      material.dispose = spy

      const Reactor = () => {
        useEffect(() => {
          setComponent(entity, LineSegmentComponent, { geometry: geometry, material: material })
          return () => {
            removeComponent(entity, LineSegmentComponent)
          }
        }, [])

        return <></>
      }

      const { rerender, unmount } = render(<Reactor />)

      const resourceState = getState(ResourceState)

      act(async () => {
        assert(hasComponent(entity, LineSegmentComponent))
        assert(resourceState.resources[geometry.uuid])
        assert(resourceState.resources[material.uuid])
        unmount()
      }).then(() => {
        assert(!hasComponent(entity, LineSegmentComponent))
        assert(!resourceState.resources[geometry.uuid])
        assert(!resourceState.resources[material.uuid])
        sinon.assert.calledTwice(spy)
        removeEntity(entity)
        done()
      })
    })
  }) //:: reactor
})
