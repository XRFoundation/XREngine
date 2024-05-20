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

import '../threejsPatches'

import { EffectComposer, NormalPass, RenderPass, SMAAPreset } from 'postprocessing'
import React, { useEffect } from 'react'
import {
  ArrayCamera,
  Color,
  CubeTexture,
  FogBase,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGL1Renderer,
  WebGLRenderer,
  WebGLRendererParameters
} from 'three'

import {
  defineComponent,
  defineQuery,
  defineSystem,
  ECSState,
  Entity,
  getComponent,
  getOptionalComponent,
  hasComponent,
  PresentationSystemGroup,
  QueryReactor,
  useComponent,
  useEntityContext
} from '@etherealengine/ecs'
import { defineState, getMutableState, getState, useMutableState } from '@etherealengine/hyperflux'

import { CameraComponent } from '../camera/components/CameraComponent'
import { ExponentialMovingAverage } from '../common/classes/ExponentialAverageCurve'
import { EngineState } from '../EngineState'
import { getNestedChildren } from '../transform/components/EntityTree'
import { createWebXRManager, WebXRManager } from '../xr/WebXRManager'
import { XRLightProbeState } from '../xr/XRLightProbeSystem'
import { XRState } from '../xr/XRState'
import { GroupComponent } from './components/GroupComponent'
import {
  BackgroundComponent,
  EnvironmentMapComponent,
  FogComponent,
  SceneComponent
} from './components/SceneComponents'
import { VisibleComponent } from './components/VisibleComponent'
import { ObjectLayers } from './constants/ObjectLayers'
import { CSM } from './csm/CSM'
import CSMHelper from './csm/CSMHelper'
import { changeRenderMode } from './functions/changeRenderMode'
import { PerformanceManager } from './PerformanceState'
import { RendererState } from './RendererState'
import WebGL from './THREE.WebGL'

export const RendererComponent = defineComponent({
  name: 'RendererComponent',

  onInit() {
    return new EngineRenderer()
  },

  onSet(entity, component, json) {
    if (json?.canvas) component.canvas.set(json.canvas)
  }
})

let lastRenderTime = 0
const _scene = new Scene()
_scene.matrixAutoUpdate = false
_scene.matrixWorldAutoUpdate = false
_scene.layers.set(ObjectLayers.Scene)
globalThis._scene = _scene

export class EngineRenderer {
  /**
   * @deprecated will be removed once threejs objects are not proxified. Should only be used in loadGLTFModel.ts
   * see https://github.com/EtherealEngine/etherealengine/issues/9308
   */
  static activeRender = false
  /** Is resize needed? */
  needsResize: boolean

  /** Maximum Quality level of the rendered. **Default** value is 5. */
  maxQualityLevel = 5
  /** point at which we downgrade quality level (large delta) */
  maxRenderDelta = 1000 / 28 // 28 fps = 35 ms  (on some devices, rAF updates at 30fps, e.g., Low Power Mode)
  /** point at which we upgrade quality level (small delta) */
  minRenderDelta = 1000 / 55 // 55 fps = 18 ms
  /** Resoulion scale. **Default** value is 1. */
  scaleFactor = 1

  renderPass: RenderPass
  normalPass: NormalPass
  renderContext: WebGLRenderingContext | WebGL2RenderingContext

  supportWebGL2: boolean
  canvas: HTMLCanvasElement

  averageTimePeriods = 3 * 60 // 3 seconds @ 60fps
  /** init ExponentialMovingAverage */
  movingAverage = new ExponentialMovingAverage(this.averageTimePeriods)

  renderer: WebGLRenderer = null!
  /** used to optimize proxified threejs objects during render time, see loadGLTFModel and https://github.com/EtherealEngine/etherealengine/issues/9308 */
  rendering = false
  effectComposer: EffectComposer = null!
  /** @todo deprecate and replace with engine implementation */
  xrManager: WebXRManager = null!
  webGLLostContext: any = null

  csm = null as CSM | null
  csmHelper = null as CSMHelper | null

  initialize() {
    this.supportWebGL2 = WebGL.isWebGL2Available()

    if (!this.canvas) throw new Error('Canvas is not defined')

    const canvas = this.canvas
    const context = this.supportWebGL2 ? canvas.getContext('webgl2')! : canvas.getContext('webgl')!

    this.renderContext = context!
    const options: WebGLRendererParameters = {
      precision: 'highp',
      powerPreference: 'high-performance',
      stencil: false,
      antialias: false,
      depth: true,
      logarithmicDepthBuffer: false,
      canvas,
      context,
      preserveDrawingBuffer: false,
      //@ts-ignore
      multiviewStereo: true
    }

    const renderer = this.supportWebGL2 ? new WebGLRenderer(options) : new WebGL1Renderer(options)
    this.renderer = renderer
    this.renderer.outputColorSpace = SRGBColorSpace

    // DISABLE THIS IF YOU ARE SEEING SHADER MISBEHAVING - UNCHECK THIS WHEN TESTING UPDATING THREEJS
    this.renderer.debug.checkShaderErrors = false

    // @ts-ignore
    this.xrManager = renderer.xr = createWebXRManager(renderer)
    this.xrManager.cameraAutoUpdate = false
    this.xrManager.enabled = true

    const onResize = () => {
      this.needsResize = true
    }

    canvas.addEventListener('resize', onResize, false)
    window.addEventListener('resize', onResize, false)

    this.renderer.autoClear = true

    /**
     * This can be tested with document.getElementById('engine-renderer-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
     */
    this.webGLLostContext = context.getExtension('WEBGL_lose_context')

    const handleWebGLConextLost = (e) => {
      console.log('Browser lost the context.', e)
      e.preventDefault()
      this.needsResize = false
      setTimeout(() => {
        if (this.webGLLostContext) this.webGLLostContext.restoreContext()
      }, 1)
    }

    const handleWebGLContextRestore = (e) => {
      canvas.removeEventListener('webglcontextlost', handleWebGLConextLost)
      canvas.removeEventListener('webglcontextrestored', handleWebGLContextRestore)
      this.initialize()
      this.needsResize = true
      console.log("Browser's context is restored.", e)
    }

    if (this.webGLLostContext) {
      canvas.addEventListener('webglcontextlost', handleWebGLConextLost)
    } else {
      console.log('Browser does not support `WEBGL_lose_context` extension')
    }
  }
}

/**
 * Change the quality of the renderer.
 */
const changeQualityLevel = (renderer: EngineRenderer) => {
  const time = Date.now()
  const delta = time - lastRenderTime
  lastRenderTime = time

  const { qualityLevel } = getState(RendererState)
  let newQualityLevel = qualityLevel

  renderer.movingAverage.update(Math.min(delta, 50))
  const averageDelta = renderer.movingAverage.mean

  if (averageDelta > renderer.maxRenderDelta && newQualityLevel > 1) {
    newQualityLevel--
  } else if (averageDelta < renderer.minRenderDelta && newQualityLevel < renderer.maxQualityLevel) {
    newQualityLevel++
  }

  if (newQualityLevel !== qualityLevel) {
    getMutableState(RendererState).qualityLevel.set(newQualityLevel)
  }
}

/**
 * Executes the system. Called each frame by default from the Engine.instance.
 * @param delta Time since last frame.
 */
export const render = (
  renderer: EngineRenderer,
  scene: Scene,
  camera: ArrayCamera,
  delta: number,
  effectComposer = true
) => {
  const xrFrame = getState(XRState).xrFrame

  const canvasParent = renderer.canvas.parentElement
  if (!canvasParent) return

  const state = getState(RendererState)

  const engineState = getState(EngineState)
  if (!engineState.isEditor && state.automatic) changeQualityLevel(renderer)

  if (renderer.needsResize) {
    const curPixelRatio = renderer.renderer.getPixelRatio()
    const scaledPixelRatio = window.devicePixelRatio * renderer.scaleFactor

    if (curPixelRatio !== scaledPixelRatio) renderer.renderer.setPixelRatio(scaledPixelRatio)

    const width = canvasParent.clientWidth
    const height = canvasParent.clientHeight

    if (camera.isPerspectiveCamera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    state.qualityLevel > 0 && renderer.csm?.updateFrustums()

    if (renderer.effectComposer) {
      renderer.effectComposer.setSize(width, height, true)
    } else {
      renderer.renderer.setSize(width, height, true)
    }

    renderer.needsResize = false
  }

  EngineRenderer.activeRender = true

  /** Postprocessing does not support multipass yet, so just use basic renderer when in VR */
  if (xrFrame || !effectComposer || !renderer.effectComposer) {
    for (const c of camera.cameras) c.layers.mask = camera.layers.mask
    renderer.renderer.clear()
    renderer.renderer.render(scene, camera)
  } else {
    renderer.effectComposer.setMainScene(scene)
    renderer.effectComposer.setMainCamera(camera)
    renderer.effectComposer.render(delta)
  }

  EngineRenderer.activeRender = false
}

export const RenderSettingsState = defineState({
  name: 'RenderSettingsState',
  initial: {
    smaaPreset: SMAAPreset.MEDIUM
  }
})

const rendererQuery = defineQuery([RendererComponent, CameraComponent, SceneComponent])

export const filterVisible = (entity: Entity) => hasComponent(entity, VisibleComponent)
export const getNestedVisibleChildren = (entity: Entity) => getNestedChildren(entity, filterVisible)

const execute = () => {
  const deltaSeconds = getState(ECSState).deltaSeconds

  const onRenderEnd = PerformanceManager.profileGPURender(deltaSeconds)
  for (const entity of rendererQuery()) {
    const camera = getComponent(entity, CameraComponent)
    const renderer = getComponent(entity, RendererComponent)
    const scene = getComponent(entity, SceneComponent)

    let background: Color | Texture | CubeTexture | null = null
    let environment: Texture | null = null
    let fog: FogBase | null = null

    const entitiesToRender = scene.children.map(getNestedVisibleChildren).flat()
    for (const entity of entitiesToRender) {
      if (hasComponent(entity, EnvironmentMapComponent)) {
        environment = getComponent(entity, EnvironmentMapComponent)
      }
      if (hasComponent(entity, BackgroundComponent)) {
        background = getComponent(entity, BackgroundComponent as any) as Color | Texture | CubeTexture
      }
      if (hasComponent(entity, FogComponent)) {
        fog = getComponent(entity, FogComponent)
      }
    }
    const objects = entitiesToRender
      .map((entity) => getOptionalComponent(entity, GroupComponent)!)
      .flat()
      .filter(Boolean)

    _scene.children = objects

    const sessionMode = getState(XRState).sessionMode
    _scene.background = sessionMode === 'immersive-ar' ? null : background

    const lightProbe = getState(XRLightProbeState).environment
    _scene.environment = lightProbe ?? environment

    _scene.fog = fog

    render(renderer, _scene, camera, deltaSeconds)
  }
  onRenderEnd()
}

const rendererReactor = () => {
  const entity = useEntityContext()
  const renderer = useComponent(entity, RendererComponent)
  const engineRendererSettings = useMutableState(RendererState)

  useEffect(() => {
    renderer.scaleFactor.set(engineRendererSettings.qualityLevel.value / renderer.maxQualityLevel.value)
    renderer.renderer.value.setPixelRatio(window.devicePixelRatio * renderer.scaleFactor.value)
    renderer.needsResize.set(true)
  }, [engineRendererSettings.qualityLevel])

  useEffect(() => {
    changeRenderMode()
  }, [engineRendererSettings.renderMode])

  return null
}

const cameraReactor = () => {
  const entity = useEntityContext()
  const camera = useComponent(entity, CameraComponent).value
  const engineRendererSettings = useMutableState(RendererState)

  useEffect(() => {
    if (engineRendererSettings.physicsDebug.value) camera.layers.enable(ObjectLayers.PhysicsHelper)
    else camera.layers.disable(ObjectLayers.PhysicsHelper)
  }, [engineRendererSettings.physicsDebug])

  useEffect(() => {
    if (engineRendererSettings.avatarDebug.value) camera.layers.enable(ObjectLayers.AvatarHelper)
    else camera.layers.disable(ObjectLayers.AvatarHelper)
  }, [engineRendererSettings.avatarDebug])

  useEffect(() => {
    if (engineRendererSettings.gridVisibility.value) camera.layers.enable(ObjectLayers.Gizmos)
    else camera.layers.disable(ObjectLayers.Gizmos)
  }, [engineRendererSettings.gridVisibility])

  useEffect(() => {
    if (engineRendererSettings.nodeHelperVisibility.value) camera.layers.enable(ObjectLayers.NodeHelper)
    else camera.layers.disable(ObjectLayers.NodeHelper)
  }, [engineRendererSettings.nodeHelperVisibility])

  return null
}

export const WebGLRendererSystem = defineSystem({
  uuid: 'ee.engine.WebGLRendererSystem',
  insert: { with: PresentationSystemGroup },
  execute,
  reactor: () => {
    return (
      <>
        <QueryReactor Components={[RendererComponent]} ChildEntityReactor={rendererReactor} />
        <QueryReactor Components={[CameraComponent]} ChildEntityReactor={cameraReactor} />
      </>
    )
  }
})
