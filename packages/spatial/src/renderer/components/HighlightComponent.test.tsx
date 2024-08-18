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
  Engine,
  Entity,
  EntityUUID,
  SystemDefinitions,
  UUIDComponent,
  UndefinedEntity,
  createEngine,
  createEntity,
  destroyEngine,
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  hasComponent,
  removeComponent,
  removeEntity,
  setComponent
} from '@etherealengine/ecs'
import { getMutableState, getState } from '@etherealengine/hyperflux'
import { act, render } from '@testing-library/react'
import assert from 'assert'
import React from 'react'
import { BoxGeometry, MathUtils, Mesh } from 'three'
import { mockSpatialEngine } from '../../../tests/util/mockSpatialEngine'
import { EngineState } from '../../EngineState'
import { destroySpatialEngine } from '../../initializeEngine'
import { EntityTreeComponent } from '../../transform/components/EntityTree'
import { TransformComponent } from '../RendererModule'
import { RendererState } from '../RendererState'
import { RendererComponent, WebGLRendererSystem } from '../WebGLRendererSystem'
import { GroupComponent, addObjectToGroup } from './GroupComponent'
import { HighlightComponent, HighlightSystem } from './HighlightComponent'
import { MeshComponent } from './MeshComponent'
import { PostProcessingComponent } from './PostProcessingComponent'
import { SceneComponent } from './SceneComponents'
import { VisibleComponent } from './VisibleComponent'

describe('HighlightComponent', () => {
  describe('IDs', () => {
    it('should initialize the HighlightComponent.name field with the expected value', () => {
      assert.equal(HighlightComponent.name, 'HighlightComponent')
    })
  }) //:: IDs
})

describe('HighlightSystem', () => {
  describe('IDs', () => {
    it('should initialize the HighlightSystem.uuid field with the expected value', () => {
      assert.equal(SystemDefinitions.get(HighlightSystem)!.uuid, 'HighlightSystem')
    })
  }) //:: IDs

  describe('insert', () => {
    it('should be set to run before the WebGLRendererSystem', () => {
      const insert = SystemDefinitions.get(HighlightSystem)!.insert
      assert.notEqual(insert, undefined)
      assert.equal(insert?.before, WebGLRendererSystem)
      assert.equal(insert?.with, undefined)
      assert.equal(insert?.after, undefined)
    })
  })

  describe('execute', () => {
    beforeEach(async () => {
      createEngine()
    })

    afterEach(() => {
      destroySpatialEngine()
      return destroyEngine()
    })

    function createOutlineEntity(name: string): { id: Entity; name: string } {
      const result = createEntity()
      setComponent(result, HighlightComponent)
      setComponent(result, VisibleComponent)
      setComponent(result, MeshComponent, new Mesh(new BoxGeometry()))
      getMutableComponent(result, MeshComponent).name.set(name)
      setComponent(result, GroupComponent)
      setComponent(result, EntityTreeComponent)
      return {
        id: result,
        name: name
      }
    }

    it('should set the list of objects of every entity that has a MeshComponent, a GroupComponent and a VisibleComponent to the rendererComponent.effectComposer?.OutlineEffect?.selection list', () => {
      mockSpatialEngine()
      const entity1 = createOutlineEntity('entity1')
      const entity2 = createOutlineEntity('entity2')
      const entity3 = createOutlineEntity('entity3')
      const Expected = [entity1.name, entity2.name, entity3.name]
      // Get the system definition
      const highlightSystemExecute = SystemDefinitions.get(HighlightSystem)!.execute
      // Run and Check the result
      highlightSystemExecute()
      const result = getComponent(Engine.instance.viewerEntity, RendererComponent).effectComposer?.OutlineEffect
        .selection
      const list = [...result!.values()]
      list.forEach((value, _) => assert.equal(Expected.includes(value.name), true))
    })

    it('should not do anything if the Engine.instance.viewerEntity does not have a RendererComponent', () => {
      const entity1 = createOutlineEntity('entity1')
      const entity2 = createOutlineEntity('entity2')
      const entity3 = createOutlineEntity('entity3')
      const Expected = [entity1.name, entity2.name, entity3.name]
      // Sanity check before running
      assert.equal(hasComponent(getState(EngineState).viewerEntity, RendererComponent), false)
      // Get the system definition
      const highlightSystemExecute = SystemDefinitions.get(HighlightSystem)!.execute
      // Run and Check the result
      highlightSystemExecute()
      const result = getOptionalComponent(getState(EngineState).viewerEntity, RendererComponent)?.effectComposer
        ?.OutlineEffect.selection
      assert.equal(result, undefined)
    })

    it("should not add any child of the query [HighlightComponent, VisibleComponent] that doesn't have a MeshComponent to the rendererComponent.effectComposer?.OutlineEffect?.selection list", () => {
      mockSpatialEngine()

      const queryEntity = createEntity()
      const mesh = new Mesh(new BoxGeometry())
      setComponent(queryEntity, HighlightComponent)
      setComponent(queryEntity, VisibleComponent)
      setComponent(queryEntity, TransformComponent)
      setComponent(queryEntity, MeshComponent, mesh)
      addObjectToGroup(queryEntity, mesh)
      const notQueryEntity1 = createOutlineEntity('notQueryEntity1')
      const notQueryEntity2 = createOutlineEntity('notQueryEntity2')
      setComponent(notQueryEntity1.id, EntityTreeComponent, { parentEntity: queryEntity })
      setComponent(notQueryEntity2.id, EntityTreeComponent, { parentEntity: queryEntity })
      removeComponent(notQueryEntity1.id, MeshComponent)
      removeComponent(notQueryEntity2.id, MeshComponent)

      // Get the system definition
      const highlightSystemExecute = SystemDefinitions.get(HighlightSystem)!.execute
      // Run and Check the result
      highlightSystemExecute()
      const result = getOptionalComponent(getState(EngineState).viewerEntity, RendererComponent)?.effectComposer
        ?.OutlineEffect.selection
      for (const obj of result!) {
        assert.notEqual(obj.entity, notQueryEntity1)
        assert.notEqual(obj.entity, notQueryEntity2)
      }
    })

    it("should not add any child of the query [HighlightComponent, VisibleComponent] that doesn't have a GroupComponent to the rendererComponent.effectComposer?.OutlineEffect?.selection list", () => {
      mockSpatialEngine()

      const queryEntity = createEntity()
      const mesh = new Mesh(new BoxGeometry())
      setComponent(queryEntity, HighlightComponent)
      setComponent(queryEntity, VisibleComponent)
      setComponent(queryEntity, TransformComponent)
      setComponent(queryEntity, MeshComponent, mesh)
      addObjectToGroup(queryEntity, mesh)
      const notQueryEntity1 = createOutlineEntity('notQueryEntity1')
      const notQueryEntity2 = createOutlineEntity('notQueryEntity2')
      setComponent(notQueryEntity1.id, EntityTreeComponent, { parentEntity: queryEntity })
      setComponent(notQueryEntity2.id, EntityTreeComponent, { parentEntity: queryEntity })
      removeComponent(notQueryEntity1.id, GroupComponent)
      removeComponent(notQueryEntity2.id, GroupComponent)

      // Get the system definition
      const highlightSystemExecute = SystemDefinitions.get(HighlightSystem)!.execute
      // Run and Check the result
      highlightSystemExecute()
      const result = getOptionalComponent(getState(EngineState).viewerEntity, RendererComponent)?.effectComposer
        ?.OutlineEffect.selection
      for (const obj of result!) {
        assert.notEqual(obj.entity, notQueryEntity1)
        assert.notEqual(obj.entity, notQueryEntity2)
      }
    })

    it("should not add any child of the query [HighlightComponent, VisibleComponent] that doesn't have a VisibleComponent to the rendererComponent.effectComposer?.OutlineEffect?.selection list", () => {
      mockSpatialEngine()

      const queryEntity = createEntity()
      const mesh = new Mesh(new BoxGeometry())
      setComponent(queryEntity, HighlightComponent)
      setComponent(queryEntity, VisibleComponent)
      setComponent(queryEntity, TransformComponent)
      setComponent(queryEntity, MeshComponent, mesh)
      addObjectToGroup(queryEntity, mesh)
      const notQueryEntity1 = createOutlineEntity('notQueryEntity1')
      const notQueryEntity2 = createOutlineEntity('notQueryEntity2')
      setComponent(notQueryEntity1.id, EntityTreeComponent, { parentEntity: queryEntity })
      setComponent(notQueryEntity2.id, EntityTreeComponent, { parentEntity: queryEntity })
      removeComponent(notQueryEntity1.id, VisibleComponent)
      removeComponent(notQueryEntity2.id, VisibleComponent)

      // Get the system definition
      const highlightSystemExecute = SystemDefinitions.get(HighlightSystem)!.execute
      // Run and Check the result
      highlightSystemExecute()
      const result = getOptionalComponent(getState(EngineState).viewerEntity, RendererComponent)?.effectComposer
        ?.OutlineEffect.selection
      for (const obj of result!) {
        assert.notEqual(obj.entity, notQueryEntity1)
        assert.notEqual(obj.entity, notQueryEntity2)
      }
    })
  })

  describe('General Purpose', () => {
    let rootEntity = UndefinedEntity
    let testEntity = UndefinedEntity

    beforeEach(() => {
      createEngine()
      mockSpatialEngine()
      rootEntity = getState(EngineState).viewerEntity

      testEntity = createEntity()
      setComponent(testEntity, UUIDComponent, MathUtils.generateUUID() as EntityUUID)
      getMutableState(RendererState).usePostProcessing.set(true)
      setComponent(testEntity, SceneComponent)
      setComponent(testEntity, PostProcessingComponent, { enabled: true })
      setComponent(testEntity, EntityTreeComponent)
    })

    afterEach(() => {
      removeEntity(testEntity)
      removeEntity(rootEntity)
      return destroyEngine()
    })

    it('should add the OutlineEffect to the RendererComponent.effectComposer.EffectPass.effects list', async () => {
      const effectKey = 'OutlineEffect'

      // force nested reactors to run
      const { rerender, unmount } = render(<></>)
      await act(() => rerender(<></>))

      // Check that the effect composer is setup
      const effectComposer = getComponent(rootEntity, RendererComponent).effectComposer
      assert.notEqual(Boolean(effectComposer), false, 'the effect composer is not setup correctly')

      // Check that the effect pass has the the effect set
      // @ts-ignore Allow access to the `effects` private field
      const effects = effectComposer.EffectPass.effects
      assert.equal(Boolean(effects.find((it) => it.name == effectKey)), true)

      unmount()
    })
  })
})
