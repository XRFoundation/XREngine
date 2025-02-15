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

import { NormalPass, RenderPass, SMAAPreset } from 'postprocessing'
import React, { useEffect } from 'react'
import {
  ArrayCamera,
  Color,
  CubeTexture,
  FogBase,
  Object3D,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGL1Renderer,
  WebGLRenderer,
  WebGLRendererParameters
} from 'three'

import {
  ComponentType,
  defineComponent,
  defineQuery,
  defineSystem,
  ECSState,
  Entity,
  getComponent,
  getMutableComponent,
  hasComponent,
  PresentationSystemGroup,
  QueryReactor,
  useComponent,
  useEntityContext
} from '@etherealengine/ecs'
import {
  defineState,
  getMutableState,
  getState,
  NO_PROXY,
  none,
  State,
  useMutableState
} from '@etherealengine/hyperflux'

import { Effect, EffectComposer, EffectPass, OutlineEffect } from 'postprocessing'
import { CameraComponent } from '../camera/components/CameraComponent'
import { getNestedChildren } from '../transform/components/EntityTree'
import { createWebXRManager, WebXRManager } from '../xr/WebXRManager'
import { XRLightProbeState } from '../xr/XRLightProbeSystem'
import { XRState } from '../xr/XRState'
import { GroupComponent } from './components/GroupComponent'
import { BackgroundComponent, EnvironmentMapComponent, FogComponent } from './components/SceneComponents'
import { VisibleComponent } from './components/VisibleComponent'
import { ObjectLayers } from './constants/ObjectLayers'
import { RenderModes } from './constants/RenderModes'
import { CSM } from './csm/CSM'
import CSMHelper from './csm/CSMHelper'
import { changeRenderMode } from './functions/changeRenderMode'
import { HighlightState } from './HighlightState'
import { PerformanceManager, PerformanceState } from './PerformanceState'
import { RendererState } from './RendererState'
import WebGL from './THREE.WebGL'

declare module 'postprocessing' {
  interface EffectComposer {
    EffectPass: EffectPass
    OutlineEffect: OutlineEffect
  }
  interface Effect {
    isActive: boolean
  }
}

export const RendererComponent = defineComponent({
  name: 'RendererComponent',

  onInit() {
    const scene = new Scene()
    scene.matrixAutoUpdate = false
    scene.matrixWorldAutoUpdate = false
    scene.layers.set(ObjectLayers.Scene)

    return {
      /** Is resize needed? */
      needsResize: false,

      renderPass: null as null | RenderPass,
      normalPass: null as null | NormalPass,
      renderContext: null as WebGLRenderingContext | WebGL2RenderingContext | null,
      effects: {} as Record<string, Effect>,

      supportWebGL2: false,
      canvas: null as null | HTMLCanvasElement,

      renderer: null as null | WebGLRenderer,
      effectComposer: null as null | EffectComposer,

      scenes: [] as Entity[],
      scene,

      /** @todo deprecate and replace with engine implementation */
      xrManager: null as null | WebXRManager,
      webGLLostContext: null as null | WEBGL_lose_context,

      csm: null as CSM | null,
      csmHelper: null as CSMHelper | null
    }
  },

  /**
   * @deprecated will be removed once threejs objects are not proxified. Should only be used in loadGLTFModel.ts
   * see https://github.com/EtherealEngine/etherealengine/issues/9308
   */
  activeRender: false,

  onSet(entity, component, json) {
    if (json?.canvas) component.canvas.set(json.canvas)
    if (json?.scenes) component.scenes.set(json.scenes)
  },

  onRemove(entity, component) {
    component.value.renderer?.dispose()
    component.value.effectComposer?.dispose()
  },

  reactor: () => {
    const entity = useEntityContext()
    const rendererComponent = useComponent(entity, RendererComponent)
    const camera = useComponent(entity, CameraComponent).value as ArrayCamera
    const hightlightState = useMutableState(HighlightState)
    const renderSettings = useMutableState(RendererState)
    const effectComposerState = rendererComponent.effectComposer as State<EffectComposer>

    useEffect(() => {
      if (!effectComposerState.value) return

      const scene = rendererComponent.scene.value as Scene
      const outlineEffect = new OutlineEffect(scene, camera, getState(HighlightState))
      outlineEffect.selectionLayer = ObjectLayers.HighlightEffect
      effectComposerState.OutlineEffect.set(outlineEffect)

      return () => {
        if (!hasComponent(entity, RendererComponent)) return
        outlineEffect.dispose()
        effectComposerState.OutlineEffect.set(none)
      }
    }, [!!effectComposerState.value, hightlightState])

    useEffect(() => {
      const effectComposer = effectComposerState.value
      if (!effectComposer) return

      const effectsVal = rendererComponent.effects.get(NO_PROXY) as Record<string, Effect>

      const enabled = renderSettings.usePostProcessing.value

      const effectArray = enabled ? Object.values(effectsVal) : []
      if (effectComposer.OutlineEffect) effectArray.unshift(effectComposer.OutlineEffect as OutlineEffect)

      const effectPass = new EffectPass(camera, ...effectArray)
      effectComposerState.EffectPass.set(effectPass)

      if (enabled) {
        effectComposerState.merge(effectsVal)
      }

      try {
        effectComposer.addPass(effectPass)
      } catch (e) {
        console.warn(e) /** @todo Implement user messaging Ex: (Can not use multiple convolution effects) */
      }

      effectComposer.setRenderer(rendererComponent.renderer.value as WebGLRenderer)

      return () => {
        if (!hasComponent(entity, RendererComponent)) return
        if (enabled) {
          for (const effect in effectsVal) {
            effectsVal[effect].dispose()
            effectComposerState[effect].set(none)
          }
        }
        effectComposer.EffectPass.dispose()
        effectComposer.removePass(effectPass)
      }
    }, [rendererComponent.effects, !!effectComposerState?.OutlineEffect?.value, renderSettings.usePostProcessing.value])

    return null
  }
})

export const initializeEngineRenderer = (entity: Entity) => {
  const rendererComponent = getMutableComponent(entity, RendererComponent)

  rendererComponent.supportWebGL2.set(WebGL.isWebGL2Available())

  if (!rendererComponent.canvas) throw new Error('Canvas is not defined')

  const canvas = rendererComponent.canvas.value as HTMLCanvasElement
  const context = rendererComponent.supportWebGL2 ? canvas.getContext('webgl2')! : canvas.getContext('webgl')!

  rendererComponent.renderContext.set(context)
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

  const renderer = rendererComponent.supportWebGL2 ? new WebGLRenderer(options) : new WebGL1Renderer(options)
  rendererComponent.renderer.set(renderer)
  renderer.outputColorSpace = SRGBColorSpace

  const composer = new EffectComposer(renderer)
  rendererComponent.effectComposer.set(composer)
  const renderPass = new RenderPass()
  composer.addPass(renderPass)
  rendererComponent.renderPass.set(renderPass)

  // DISABLE THIS IF YOU ARE SEEING SHADER MISBEHAVING - UNCHECK THIS WHEN TESTING UPDATING THREEJS
  renderer.debug.checkShaderErrors = false

  const xrManager = createWebXRManager(renderer)
  renderer.xr = xrManager as any
  rendererComponent.merge({ xrManager })
  xrManager.cameraAutoUpdate = false
  xrManager.enabled = true

  const onResize = () => {
    rendererComponent.needsResize.set(true)
  }

  // https://stackoverflow.com/questions/48124372/pointermove-event-not-working-with-touch-why-not
  canvas.style.touchAction = 'none'
  canvas.addEventListener('resize', onResize, false)
  window.addEventListener('resize', onResize, false)

  renderer.autoClear = true

  /**
   * This can be tested with document.getElementById('engine-renderer-canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
   */
  rendererComponent.webGLLostContext.set(context.getExtension('WEBGL_lose_context'))

  const handleWebGLConextLost = (e) => {
    console.log('Browser lost the context.', e)
    e.preventDefault()
    rendererComponent.needsResize.set(false)
    setTimeout(() => {
      if (rendererComponent.webGLLostContext) rendererComponent.webGLLostContext.value!.restoreContext()
    }, 1)
  }

  const handleWebGLContextRestore = (e) => {
    canvas.removeEventListener('webglcontextlost', handleWebGLConextLost)
    canvas.removeEventListener('webglcontextrestored', handleWebGLContextRestore)
    initializeEngineRenderer(entity)
    rendererComponent.needsResize.set(true)
    console.log("Browser's context is restored.", e)
  }

  if (rendererComponent.webGLLostContext) {
    canvas.addEventListener('webglcontextlost', handleWebGLConextLost)
  } else {
    console.log('Browser does not support `WEBGL_lose_context` extension')
  }
}

/**
 * Executes the system. Called each frame by default from the Engine.instance.
 * @param delta Time since last frame.
 */
export const render = (
  renderer: ComponentType<typeof RendererComponent>,
  scene: Scene,
  camera: ArrayCamera,
  delta: number,
  effectComposer = true
) => {
  const xrFrame = getState(XRState).xrFrame

  const canvasParent = renderer.canvas!.parentElement
  if (!canvasParent) return

  const state = getState(RendererState)

  if (renderer.needsResize) {
    const curPixelRatio = renderer.renderer!.getPixelRatio()
    const scaledPixelRatio = window.devicePixelRatio * state.renderScale

    if (curPixelRatio !== scaledPixelRatio) renderer.renderer!.setPixelRatio(scaledPixelRatio)

    const width = canvasParent.clientWidth
    const height = canvasParent.clientHeight

    if (camera.isPerspectiveCamera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    state.updateCSMFrustums && renderer.csm?.updateFrustums()

    if (renderer.effectComposer) {
      renderer.effectComposer.setSize(width, height, true)
    } else {
      renderer.renderer!.setSize(width, height, true)
    }

    renderer.needsResize = false
  }

  RendererComponent.activeRender = true

  /** Postprocessing does not support multipass yet, so just use basic renderer when in VR */
  if (xrFrame || !effectComposer || !renderer.effectComposer) {
    for (const c of camera.cameras) c.layers.mask = camera.layers.mask
    renderer.renderer!.clear()
    renderer.renderer!.render(scene, camera)
  } else {
    renderer.effectComposer.setMainScene(scene)
    renderer.effectComposer.setMainCamera(camera)
    renderer.effectComposer.render(delta)
  }

  RendererComponent.activeRender = false
}

export const RenderSettingsState = defineState({
  name: 'RenderSettingsState',
  initial: {
    smaaPreset: SMAAPreset.MEDIUM
  }
})

const rendererQuery = defineQuery([RendererComponent, CameraComponent])

export const filterVisible = (entity: Entity) => hasComponent(entity, VisibleComponent)
export const getNestedVisibleChildren = (entity: Entity) => getNestedChildren(entity, filterVisible)
export const getSceneParameters = (entities: Entity[]) => {
  const vals = {
    background: null as Color | Texture | CubeTexture | null,
    environment: null as Texture | null,
    fog: null as FogBase | null,
    children: [] as Object3D[]
  }

  for (const entity of entities) {
    if (hasComponent(entity, EnvironmentMapComponent)) {
      vals.environment = getComponent(entity, EnvironmentMapComponent)
    }
    if (hasComponent(entity, BackgroundComponent)) {
      vals.background = getComponent(entity, BackgroundComponent as any) as Color | Texture | CubeTexture
    }
    if (hasComponent(entity, FogComponent)) {
      vals.fog = getComponent(entity, FogComponent)
    }
    if (hasComponent(entity, GroupComponent)) {
      vals.children.push(...getComponent(entity, GroupComponent)!)
    }
  }

  return vals
}

const execute = () => {
  const deltaSeconds = getState(ECSState).deltaSeconds

  const onRenderEnd = PerformanceManager.profileGPURender()
  for (const entity of rendererQuery()) {
    const camera = getComponent(entity, CameraComponent)
    const renderer = getComponent(entity, RendererComponent)
    const _scene = renderer.scene!

    const entitiesToRender = renderer.scenes.map(getNestedVisibleChildren).flat()
    const { background, environment, fog, children } = getSceneParameters(entitiesToRender)
    _scene.children = children

    const renderMode = getState(RendererState).renderMode

    const sessionMode = getState(XRState).sessionMode
    _scene.background =
      sessionMode === 'immersive-ar' ? null : renderMode === RenderModes.WIREFRAME ? new Color(0xffffff) : background

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
    if (engineRendererSettings.automatic.value) return

    const qualityLevel = engineRendererSettings.qualityLevel.value
    getMutableState(PerformanceState).merge({
      gpuTier: qualityLevel,
      cpuTier: qualityLevel
    } as any)
  }, [engineRendererSettings.qualityLevel, engineRendererSettings.automatic])

  useEffect(() => {
    renderer.renderer.value!.setPixelRatio(window.devicePixelRatio * engineRendererSettings.renderScale.value)
    renderer.needsResize.set(true)
  }, [engineRendererSettings.renderScale])

  useEffect(() => {
    changeRenderMode(entity)
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
