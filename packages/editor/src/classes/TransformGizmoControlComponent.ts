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
import { MathUtils, Quaternion, Vector3 } from 'three'

import {
  defineComponent,
  Engine,
  Entity,
  getComponent,
  removeComponent,
  setComponent,
  UndefinedEntity,
  useComponent,
  useEntityContext
} from '@etherealengine/ecs'
import {
  SnapMode,
  TransformAxisType,
  TransformMode,
  TransformModeType,
  TransformSpace,
  TransformSpaceType
} from '@etherealengine/engine/src/scene/constants/transformConstants'
import { getState, matches, useImmediateEffect, useMutableState } from '@etherealengine/hyperflux'
import { InputComponent, InputExecutionOrder } from '@etherealengine/spatial/src/input/components/InputComponent'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { RendererComponent } from '@etherealengine/spatial/src/renderer/WebGLRendererSystem'
import { TransformGizmoTagComponent } from '@etherealengine/spatial/src/transform/components/TransformComponent'

import { InputPointerComponent } from '@etherealengine/spatial/src/input/components/InputPointerComponent'
import { InputState } from '@etherealengine/spatial/src/input/state/InputState'
import { VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { ObjectLayers } from '@etherealengine/spatial/src/renderer/constants/ObjectLayers'
import { gizmoPlane } from '../constants/GizmoPresets'
import {
  onGizmoCommit,
  onPointerDown,
  onPointerHover,
  onPointerLost,
  onPointerMove,
  onPointerUp
} from '../functions/gizmoHelper'
import { EditorHelperState } from '../services/EditorHelperState'
import { TransformGizmoVisualComponent } from './TransformGizmoVisualComponent'

export const TransformGizmoControlComponent = defineComponent({
  name: 'TransformGizmoControl',

  onInit(entity) {
    const control = {
      controlledEntities: [] as Entity[],
      visualEntity: UndefinedEntity,
      planeEntity: UndefinedEntity,
      pivotEntity: UndefinedEntity,
      enabled: true,
      dragging: false,
      axis: null! as TransformAxisType | null,
      space: TransformSpace.world as TransformSpaceType,
      mode: TransformMode.translate as TransformModeType,
      translationSnap: null! as number,
      rotationSnap: null! as number,
      scaleSnap: null! as number,
      size: 1,
      showX: true,
      showY: true,
      showZ: true,
      worldPosition: new Vector3(),
      worldPositionStart: new Vector3(),
      worldQuaternion: new Quaternion(),
      worldQuaternionStart: new Quaternion(),
      pointStart: new Vector3(),
      pointEnd: new Vector3(),
      rotationAxis: new Vector3(),
      rotationAngle: 0,
      eye: new Vector3()
    }
    return control
  },
  onSet(entity, component, json) {
    if (!json) return

    if (matches.array.test(json.controlledEntities)) component.controlledEntities.set(json.controlledEntities)
    if (matches.number.test(json.visualEntity)) component.visualEntity.set(json.visualEntity)
    if (matches.number.test(json.pivotEntity)) component.pivotEntity.set(json.pivotEntity)
    if (matches.number.test(json.planeEntity)) component.planeEntity.set(json.planeEntity)

    if (typeof json.enabled === 'boolean') component.enabled.set(json.enabled)
    if (typeof json.dragging === 'boolean') component.dragging.set(json.dragging)
    if (typeof json.axis === 'string') component.axis.set(json.axis)
    if (typeof json.space === 'string') component.space.set(json.space)
    if (typeof json.mode === 'string') component.mode.set(json.mode)
    if (typeof json.translationSnap === 'number') component.translationSnap.set(json.translationSnap)
    if (typeof json.rotationSnap === 'number') component.rotationSnap.set(json.rotationSnap)
    if (typeof json.scaleSnap === 'number') component.scaleSnap.set(json.scaleSnap)
    if (typeof json.size === 'number') component.size.set(json.size)
    if (typeof json.showX === 'number') component.showX.set(json.showX)
    if (typeof json.showY === 'number') component.showY.set(json.showY)
    if (typeof json.showZ === 'number') component.showZ.set(json.showZ)
  },

  reactor: function (props) {
    const gizmoControlEntity = useEntityContext()
    const gizmoControlComponent = useComponent(gizmoControlEntity, TransformGizmoControlComponent)
    getComponent(Engine.instance.viewerEntity, RendererComponent).renderer!.domElement.style.touchAction = 'none' // disable touch scroll , hmm the editor window isnt scrollable anyways
    const editorHelperState = useMutableState(EditorHelperState)
    const inputPointerEntities = InputPointerComponent.usePointersForCamera(Engine.instance.viewerEntity)

    // Commit transform changes if the pointer entities are lost (ie. pointer dragged outside of the canvas)
    useImmediateEffect(() => {
      const gizmoControlComponent = getComponent(gizmoControlEntity, TransformGizmoControlComponent)
      if (
        !gizmoControlComponent.enabled ||
        !gizmoControlComponent.visualEntity ||
        !gizmoControlComponent.planeEntity ||
        !gizmoControlComponent.dragging ||
        inputPointerEntities.length
      )
        return

      onGizmoCommit(gizmoControlEntity)
      removeComponent(gizmoControlComponent.planeEntity, VisibleComponent)
    }, [inputPointerEntities])

    InputComponent.useExecuteWithInput(
      () => {
        const gizmoControlComponent = getComponent(gizmoControlEntity, TransformGizmoControlComponent)

        if (!gizmoControlComponent.enabled || !gizmoControlComponent.visualEntity || !gizmoControlComponent.planeEntity)
          return

        const visualComponent = getComponent(gizmoControlComponent.visualEntity, TransformGizmoVisualComponent)
        const pickerEntity = visualComponent.picker[gizmoControlComponent.mode]

        onPointerHover(gizmoControlEntity)

        const pickerButtons = InputComponent.getMergedButtons(pickerEntity)
        const planeButtons = InputComponent.getMergedButtons(gizmoControlComponent.planeEntity)

        if (
          (pickerButtons?.PrimaryClick?.pressed || planeButtons?.PrimaryClick?.pressed) &&
          getState(InputState).capturingEntity === UndefinedEntity
        ) {
          InputState.setCapturingEntity(pickerEntity)
          onPointerMove(gizmoControlEntity)

          //pointer down
          if (pickerButtons?.PrimaryClick?.down) {
            setComponent(gizmoControlComponent.planeEntity, VisibleComponent)
            onPointerDown(gizmoControlEntity)
          }

          if (planeButtons?.PrimaryClick?.up || pickerButtons?.PrimaryClick?.up) {
            onPointerUp(gizmoControlEntity)
            onPointerLost(gizmoControlEntity)
            removeComponent(gizmoControlComponent.planeEntity, VisibleComponent)
          }
        }
      },
      true,
      InputExecutionOrder.Before
    )

    useEffect(() => {
      addObjectToGroup(gizmoControlComponent.planeEntity.value, gizmoPlane)
      gizmoPlane.layers.set(ObjectLayers.TransformGizmo)
      setComponent(gizmoControlComponent.planeEntity.value, InputComponent)
      setComponent(gizmoControlComponent.planeEntity.value, TransformGizmoTagComponent)
    }, [])

    useEffect(() => {
      const mode = editorHelperState.transformMode.value
      gizmoControlComponent.mode.set(mode)
    }, [editorHelperState.transformMode])

    useEffect(() => {
      const space = editorHelperState.transformSpace.value
      gizmoControlComponent.space.set(space)
    }, [editorHelperState.transformSpace])

    useEffect(() => {
      switch (editorHelperState.gridSnap.value) {
        case SnapMode.Disabled: // continous update
          gizmoControlComponent.translationSnap.set(0)
          gizmoControlComponent.rotationSnap.set(0)
          gizmoControlComponent.scaleSnap.set(0)
          break
        case SnapMode.Grid:
          gizmoControlComponent.translationSnap.set(editorHelperState.translationSnap.value)
          gizmoControlComponent.rotationSnap.set(MathUtils.degToRad(editorHelperState.rotationSnap.value))
          gizmoControlComponent.scaleSnap.set(editorHelperState.scaleSnap.value)
          break
      }
    }, [editorHelperState.gridSnap])

    useEffect(() => {
      gizmoControlComponent.translationSnap.set(
        editorHelperState.gridSnap.value === SnapMode.Grid ? editorHelperState.translationSnap.value : 0
      )
    }, [editorHelperState.translationSnap])

    useEffect(() => {
      gizmoControlComponent.rotationSnap.set(
        editorHelperState.gridSnap.value === SnapMode.Grid
          ? MathUtils.degToRad(editorHelperState.rotationSnap.value)
          : 0
      )
    }, [editorHelperState.rotationSnap])

    useEffect(() => {
      gizmoControlComponent.scaleSnap.set(
        editorHelperState.gridSnap.value === SnapMode.Grid ? editorHelperState.scaleSnap.value : 0
      )
    }, [editorHelperState.scaleSnap])

    return null
  }
})
