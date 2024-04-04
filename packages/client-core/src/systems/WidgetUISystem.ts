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

import { useEffect } from 'react'
import { Quaternion, Vector3 } from 'three'

import { isDev } from '@etherealengine/common/src/config'
import { getComponent, hasComponent, removeComponent, setComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { removeEntity } from '@etherealengine/ecs/src/EntityFunctions'
import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import {
  defineActionQueue,
  defineState,
  dispatchAction,
  getMutableState,
  getState,
  useHookstate
} from '@etherealengine/hyperflux'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { V_001, V_010 } from '@etherealengine/spatial/src/common/constants/MathConstants'
import { InputSourceComponent } from '@etherealengine/spatial/src/input/components/InputSourceComponent'
import { XRStandardGamepadButton } from '@etherealengine/spatial/src/input/state/ButtonState'
import { VisibleComponent, setVisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import {
  ComputedTransformComponent,
  setComputedTransformComponent
} from '@etherealengine/spatial/src/transform/components/ComputedTransformComponent'
import { TransformComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'
import { ReferenceSpace, XRState, isMobileXRHeadset } from '@etherealengine/spatial/src/xr/XRState'
import {
  RegisteredWidgets,
  WidgetAppActions,
  WidgetAppService,
  WidgetAppState
} from '@etherealengine/spatial/src/xrui/WidgetAppService'
import { ObjectFitFunctions } from '@etherealengine/spatial/src/xrui/functions/ObjectFitFunctions'

import { createAnchorWidget } from './createAnchorWidget'
// import { createHeightAdjustmentWidget } from './createHeightAdjustmentWidget'
// import { createMediaWidget } from './createMediaWidget'
import { CameraComponent } from '@etherealengine/spatial/src/camera/components/CameraComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import { TransformSystem } from '@etherealengine/spatial/src/transform/systems/TransformSystem'
import { createWidgetButtonsView } from './ui/WidgetMenuView'

const widgetLeftMenuGripOffset = new Vector3(0.08, 0, -0.05)
const widgetRightMenuGripOffset = new Vector3(-0.08, 0, -0.05)
const vec3 = new Vector3()

const widgetLeftRotation = new Quaternion()
  .setFromAxisAngle(V_010, Math.PI * 0.5)
  .multiply(new Quaternion().setFromAxisAngle(V_001, -Math.PI * 0.5))

const widgetRightRotation = new Quaternion()
  .setFromAxisAngle(V_010, -Math.PI * 0.5)
  .multiply(new Quaternion().setFromAxisAngle(V_001, Math.PI * 0.5))

const WidgetUISystemState = defineState({
  name: 'WidgetUISystemState',
  initial: () => {
    const widgetMenuUI = createWidgetButtonsView()
    /** @todo is originEntity is the correct parent? */
    setComponent(widgetMenuUI.entity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
    setComponent(widgetMenuUI.entity, TransformComponent)
    removeComponent(widgetMenuUI.entity, VisibleComponent)
    setComponent(widgetMenuUI.entity, NameComponent, 'widget_menu')
    // const helper = new AxesHelper(0.1)
    // setObjectLayers(helper, ObjectLayers.Gizmos)
    // addObjectToGroup(widgetMenuUI.entity, helper)

    return {
      widgetMenuUI
    }
  }
})

const createWidgetMenus = () => {
  createAnchorWidget()
  // createRecordingsWidget()
  // createHeightAdjustmentWidget
  // createMediaWidget
}

const toggleWidgetsMenu = (handedness: 'left' | 'right' = getState(WidgetAppState).handedness) => {
  const widgetState = getState(WidgetAppState)
  const state = widgetState.widgets
  const openWidget = Object.entries(state).find(([id, widget]) => widget.visible)
  if (openWidget) {
    dispatchAction(WidgetAppActions.showWidget({ id: openWidget[0], shown: false }))
    dispatchAction(WidgetAppActions.showWidgetMenu({ shown: true, handedness }))
  } else {
    if (widgetState.handedness !== handedness) {
      dispatchAction(WidgetAppActions.showWidgetMenu({ shown: true, handedness }))
    } else {
      dispatchAction(WidgetAppActions.showWidgetMenu({ shown: !widgetState.widgetsMenuOpen, handedness }))
    }
  }
}

const inputSourceQuery = defineQuery([InputSourceComponent])

const showWidgetQueue = defineActionQueue(WidgetAppActions.showWidget.matches)
const registerWidgetQueue = defineActionQueue(WidgetAppActions.registerWidget.matches)
const unregisterWidgetQueue = defineActionQueue(WidgetAppActions.unregisterWidget.matches)

const execute = () => {
  const widgetState = getState(WidgetAppState)
  const { widgetMenuUI } = getState(WidgetUISystemState)
  const inputSources = inputSourceQuery()

  for (const inputSourceEntity of inputSources) {
    const inputSource = getComponent(inputSourceEntity, InputSourceComponent)
    const keys = inputSource.buttons
    if (inputSource.source.gamepad?.mapping === 'xr-standard') {
      if (keys[XRStandardGamepadButton.ButtonA]?.down)
        toggleWidgetsMenu(inputSource.source.handedness === 'left' ? 'right' : 'left')
    }
    /** @todo allow non HMDs to access the widget menu too */
    if ((isDev || isMobileXRHeadset) && keys.Escape?.down) toggleWidgetsMenu()
  }

  for (const action of showWidgetQueue()) {
    const widget = RegisteredWidgets.get(action.id)!
    setVisibleComponent(widget.ui.entity, action.shown)
    if (action.shown) {
      if (typeof widget.onOpen === 'function') widget.onOpen()
    } else if (typeof widget.onClose === 'function') widget.onClose()
  }
  for (const action of registerWidgetQueue()) {
    const widget = RegisteredWidgets.get(action.id)!
    setComponent(widget.ui.entity, EntityTreeComponent, { parentEntity: widgetMenuUI.entity })
  }
  for (const action of unregisterWidgetQueue()) {
    const widget = RegisteredWidgets.get(action.id)!
    setComponent(widget.ui.entity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
    if (typeof widget.cleanup === 'function') widget.cleanup()
  }

  const activeInputSourceEntity = inputSources.find(
    (entity) => getComponent(entity, InputSourceComponent).source.handedness === widgetState.handedness
  )

  if (activeInputSourceEntity) {
    const activeInputSource = getComponent(activeInputSourceEntity, InputSourceComponent)?.source
    const pose = getState(XRState).xrFrame?.getPose(
      activeInputSource.gripSpace ?? activeInputSource.targetRaySpace,
      ReferenceSpace.localFloor!
    )
    if (hasComponent(widgetMenuUI.entity, ComputedTransformComponent)) {
      removeComponent(widgetMenuUI.entity, ComputedTransformComponent)
      setComponent(widgetMenuUI.entity, EntityTreeComponent, { parentEntity: Engine.instance.localFloorEntity })
      setComponent(widgetMenuUI.entity, TransformComponent, { scale: new Vector3().setScalar(1) })
    }

    const transform = getComponent(widgetMenuUI.entity, TransformComponent)
    if (pose) {
      const rot = widgetState.handedness === 'left' ? widgetLeftRotation : widgetRightRotation
      const offset = widgetState.handedness === 'left' ? widgetLeftMenuGripOffset : widgetRightMenuGripOffset
      const orientation = pose.transform.orientation as any as Quaternion
      transform.rotation.copy(orientation).multiply(rot)
      vec3.copy(offset).applyQuaternion(orientation)
      transform.position.copy(pose.transform.position as any as Vector3).add(vec3)
    }
  } else {
    if (!hasComponent(widgetMenuUI.entity, ComputedTransformComponent)) {
      setComponent(widgetMenuUI.entity, EntityTreeComponent, { parentEntity: Engine.instance.originEntity })
      setComputedTransformComponent(widgetMenuUI.entity, Engine.instance.viewerEntity, () => {
        const camera = getComponent(Engine.instance.viewerEntity, CameraComponent)
        const distance = camera.near * 1.1 // 10% in front of camera
        ObjectFitFunctions.attachObjectInFrontOfCamera(widgetMenuUI.entity, 0.2, distance)
      })
    }
  }

  const widgetMenuShown = widgetState.widgetsMenuOpen
  setVisibleComponent(widgetMenuUI.entity, widgetMenuShown)

  for (const [id, widget] of RegisteredWidgets) {
    if (!widgetState.widgets[id]) continue
    const widgetEnabled = widgetState.widgets[id].enabled
    if (widgetEnabled && typeof widget.system === 'function') {
      widget.system()
    }
  }
}

const reactor = () => {
  const xrState = useHookstate(getMutableState(XRState))

  useEffect(() => {
    if (!xrState.sessionActive.value) {
      WidgetAppService.closeWidgets()
      const widgetState = getState(WidgetAppState)
      dispatchAction(WidgetAppActions.showWidgetMenu({ shown: false, handedness: widgetState.handedness }))
    }
  }, [xrState.sessionActive])

  useEffect(() => {
    createWidgetMenus()
    return () => {
      const { widgetMenuUI } = getState(WidgetUISystemState)
      removeEntity(widgetMenuUI.entity)
    }
  }, [])

  return null
}

export const WidgetUISystem = defineSystem({
  uuid: 'ee.client.WidgetUISystem',
  insert: { before: TransformSystem },
  execute,
  reactor
})
