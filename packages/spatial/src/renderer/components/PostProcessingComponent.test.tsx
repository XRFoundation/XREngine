// /*
// CPAL-1.0 License

// The contents of this file are subject to the Common Public Attribution License
// Version 1.0. (the "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
// https://github.com/EtherealEngine/etherealengine/blob/dev/LICENSE.
// The License is based on the Mozilla Public License Version 1.1, but Sections 14
// and 15 have been added to cover use of software over a computer network and
// provide for limited attribution for the Original Developer. In addition,
// Exhibit A has been modified to be consistent with Exhibit B.

// Software distributed under the License is distributed on an "AS IS" basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License for the
// specific language governing rights and limitations under the License.

// The Original Code is Ethereal Engine.

// The Original Developer is the Initial Developer. The Initial Developer of the
// Original Code is the Ethereal Engine team.

// All portions of the code written by the Ethereal Engine team are Copyright © 2021-2023
// Ethereal Engine. All Rights Reserved.
// */

import assert from 'assert'
import { MathUtils } from 'three'

import {
  Entity,
  EntityUUID,
  UUIDComponent,
  getComponent,
  getMutableComponent,
  hasComponent,
  setComponent
} from '@etherealengine/ecs'
import { createEngine, destroyEngine } from '@etherealengine/ecs/src/Engine'
import { createEntity, removeEntity } from '@etherealengine/ecs/src/EntityFunctions'
import { getMutableState, getState, none } from '@etherealengine/hyperflux'
import { CameraComponent } from '@etherealengine/spatial/src/camera/components/CameraComponent'
import { RendererComponent } from '@etherealengine/spatial/src/renderer/WebGLRendererSystem'
import { SceneComponent } from '@etherealengine/spatial/src/renderer/components/SceneComponents'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { act, render } from '@testing-library/react'
import { BlendFunction, EffectComposer, NoiseEffect } from 'postprocessing'
import React, { useEffect } from 'react'
import { RendererState } from '../RendererState'
import { EffectReactorProps, PostProcessingEffectState } from '../effects/EffectRegistry'
import { PostProcessingComponent } from './PostProcessingComponent'

describe('PostProcessingComponent', () => {
  let rootEntity: Entity
  let entity: Entity

  const mockCanvas = () => {
    return {
      getDrawingBufferSize: () => 0
    } as any as HTMLCanvasElement
  }

  beforeEach(() => {
    createEngine()

    rootEntity = createEntity()
    setComponent(rootEntity, UUIDComponent, MathUtils.generateUUID() as EntityUUID)
    setComponent(rootEntity, EntityTreeComponent)
    setComponent(rootEntity, CameraComponent)
    setComponent(rootEntity, SceneComponent)
    setComponent(rootEntity, RendererComponent, { canvas: mockCanvas() })

    entity = createEntity()
    setComponent(entity, UUIDComponent, MathUtils.generateUUID() as EntityUUID)
    getMutableState(RendererState).usePostProcessing.set(true)
    setComponent(entity, PostProcessingComponent, { enabled: true })
    setComponent(entity, EntityTreeComponent)

    //set data to test
    setComponent(rootEntity, SceneComponent, { children: [entity] })

    //override addpass to test data without dependency on Browser
    let addPassCount = 0
    EffectComposer.prototype.addPass = () => {
      addPassCount++
    }
  })

  afterEach(() => {
    return destroyEngine()
  })

  it('Create default post processing component', () => {
    const postProcessingComponent = getComponent(entity, PostProcessingComponent)
    assert(postProcessingComponent, 'post processing component exists')
  })

  it('Test Effect Composure amd Highlight Effect', async () => {
    const effectKey = 'OutlineEffect'

    //force nested reactors to run
    const { rerender, unmount } = render(<></>)

    const postProcessingComponent = getMutableComponent(entity, PostProcessingComponent)
    await act(() => rerender(<></>))

    const effectComposer = getComponent(rootEntity, RendererComponent).effectComposer
    //test that the effect composer is setup
    assert(getComponent(rootEntity, RendererComponent).effectComposer, 'effect composer is setup')

    //test that the effect pass has the the effect set
    // @ts-ignore
    const effects = getComponent(rootEntity, RendererComponent).effectComposer.EffectPass.effects
    assert(effects.find((el) => el.name == effectKey))

    unmount()
  })

  it('Test Effect Add and Remove', async () => {
    const effectKey = 'NoiseEffect'
    getMutableState(PostProcessingEffectState).merge({
      [effectKey]: {
        reactor: NoiseEffectProcessReactor,
        defaultValues: {
          isActive: true,
          blendFunction: BlendFunction.SCREEN,
          premultiply: false
        },
        schema: {
          blendFunction: { propertyType: 0, name: 'Blend Function' },
          premultiply: { propertyType: 2, name: 'Premultiply' }
        }
      }
    })

    const { rerender, unmount } = render(<></>)

    await act(() => {
      rerender(<></>)
    })

    assert(hasComponent(entity, PostProcessingComponent))

    const postProcessingComponent = getMutableComponent(entity, PostProcessingComponent)
    postProcessingComponent.effects[effectKey]['isActive'].set(true)

    await act(() => {
      rerender(<></>)
    })

    // @ts-ignore
    let effects = getComponent(rootEntity, RendererComponent).effectComposer.EffectPass.effects
    assert(
      effects.find((el) => el.name == effectKey),
      ' Effect turned on'
    )

    postProcessingComponent.effects[effectKey]['isActive'].set(false)

    await act(() => {
      rerender(<></>)
    })

    // @ts-ignore
    effects = getComponent(rootEntity, RendererComponent).effectComposer.EffectPass.effects
    assert(!effects.find((el) => el.name == effectKey), ' Effect turned off')

    removeEntity(entity)
    unmount()
  })
})

const effectKey = 'NoiseEffect'
export const NoiseEffectProcessReactor: React.FC<EffectReactorProps> = (props: {
  isActive
  rendererEntity: Entity
  effectData
  effects
}) => {
  const { isActive, rendererEntity, effectData, effects } = props
  const effectState = getState(PostProcessingEffectState)

  useEffect(() => {
    if (effectData[effectKey].value) return
    effectData[effectKey].set(effectState[effectKey].defaultValues)
  }, [])

  useEffect(() => {
    if (!isActive?.value) {
      if (effects[effectKey].value) effects[effectKey].set(none)
      return
    }
    const eff = new NoiseEffect(effectData[effectKey].value)
    effects[effectKey].set(eff)
    return () => {
      effects[effectKey].set(none)
    }
  }, [isActive])

  return null
}
