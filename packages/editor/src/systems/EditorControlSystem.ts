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
import { Intersection, Layers, Object3D, Raycaster } from 'three'

import { Entity, PresentationSystemGroup, UndefinedEntity, UUIDComponent } from '@etherealengine/ecs'
import {
  getComponent,
  getMutableComponent,
  getOptionalComponent,
  getOptionalMutableComponent,
  hasComponent,
  removeComponent,
  setComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Engine } from '@etherealengine/ecs/src/Engine'
import { defineQuery } from '@etherealengine/ecs/src/QueryFunctions'
import { defineSystem } from '@etherealengine/ecs/src/SystemFunctions'
import { AvatarComponent } from '@etherealengine/engine/src/avatar/components/AvatarComponent'
import { GLTFSnapshotAction } from '@etherealengine/engine/src/gltf/GLTFDocumentState'
import { GLTFSnapshotState } from '@etherealengine/engine/src/gltf/GLTFState'
import { SourceComponent } from '@etherealengine/engine/src/scene/components/SourceComponent'
import { TransformMode } from '@etherealengine/engine/src/scene/constants/transformConstants'
import { dispatchAction, getMutableState, getState, useMutableState } from '@etherealengine/hyperflux'
import { CameraOrbitComponent } from '@etherealengine/spatial/src/camera/components/CameraOrbitComponent'
import { FlyControlComponent } from '@etherealengine/spatial/src/camera/components/FlyControlComponent'
import { InputComponent } from '@etherealengine/spatial/src/input/components/InputComponent'
import { InputSourceComponent } from '@etherealengine/spatial/src/input/components/InputSourceComponent'
import { InfiniteGridComponent } from '@etherealengine/spatial/src/renderer/components/InfiniteGridHelper'
import { RendererState } from '@etherealengine/spatial/src/renderer/RendererState'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'

import { EngineState } from '@etherealengine/spatial/src/EngineState'
import { InputState } from '@etherealengine/spatial/src/input/state/InputState'
import { TransformGizmoControlComponent } from '../classes/TransformGizmoControlComponent'
import { TransformGizmoControlledComponent } from '../classes/TransformGizmoControlledComponent'
import { addMediaNode } from '../functions/addMediaNode'
import { EditorControlFunctions } from '../functions/EditorControlFunctions'
import isInputSelected from '../functions/isInputSelected'
import {
  setTransformMode,
  toggleSnapMode,
  toggleTransformPivot,
  toggleTransformSpace
} from '../functions/transformFunctions'
import { EditorErrorState } from '../services/EditorErrorServices'

import { EditorHelperState, PlacementMode } from '../services/EditorHelperState'

import { FeatureFlags } from '@etherealengine/common/src/constants/FeatureFlags'
import { FeatureFlagsState } from '@etherealengine/engine'
import { EditorState } from '../services/EditorServices'
import { SelectionState } from '../services/SelectionServices'
import { ClickPlacementState } from './ClickPlacementSystem'
import { ObjectGridSnapState } from './ObjectGridSnapSystem'

const raycaster = new Raycaster()
const raycasterResults: Intersection<Object3D>[] = []

// const gizmoControlledQuery = defineQuery([TransformGizmoControlledComponent])
// let primaryClickAccum = 0

const onKeyB = () => {
  getMutableState(ObjectGridSnapState).enabled.set(!getState(ObjectGridSnapState).enabled)
}

const onKeyF = () => {
  getMutableComponent(Engine.instance.cameraEntity, CameraOrbitComponent).focusedEntities.set(
    SelectionState.getSelectedEntities()
  )
}

// const onKeyQ = () => {
//   const nodes = SelectionState.getSelectedEntities()
//   const gizmo = gizmoControlledQuery()
//   if (gizmo.length === 0) return
//   const gizmoEntity = gizmo[gizmo.length - 1]
//   const gizmoTransform = getComponent(gizmoEntity, TransformComponent)
//   const editorHelperState = getState(EditorHelperState)
//   EditorControlFunctions.rotateAround(
//     nodes,
//     Vector3_Up,
//     editorHelperState.rotationSnap * MathUtils.DEG2RAD,
//     gizmoTransform.position
//   )
// }

// const onKeyE = () => {
//   const nodes = SelectionState.getSelectedEntities()
//   const gizmo = gizmoControlledQuery()
//   if (gizmo.length === 0) return
//   const gizmoEntity = gizmo[gizmo.length - 1]
//   const gizmoTransform = getComponent(gizmoEntity, TransformComponent)
//   const editorHelperState = getState(EditorHelperState)
//   EditorControlFunctions.rotateAround(
//     nodes,
//     Vector3_Up,
//     -editorHelperState.rotationSnap * MathUtils.DEG2RAD,
//     gizmoTransform.position
//   )
// }

const onEscape = () => {
  EditorControlFunctions.replaceSelection([])
}

const onKeyW = () => {
  setTransformMode(TransformMode.translate)
}

const onKeyP = () => {
  const editorHelperState = getMutableState(EditorHelperState)
  if (editorHelperState.placementMode.value === PlacementMode.CLICK) {
    editorHelperState.placementMode.set(PlacementMode.DRAG)
  } else {
    editorHelperState.placementMode.set(PlacementMode.CLICK)
  }
}

const onKeyE = () => {
  setTransformMode(TransformMode.rotate)
}

const onKeyR = () => {
  setTransformMode(TransformMode.scale)
}

const onKeyC = () => {
  toggleSnapMode()
}

const onKeyX = () => {
  toggleTransformPivot()
}

const onKeyZ = (control: boolean, shift: boolean) => {
  const sourceEntity = getState(EditorState).rootEntity
  const source = getComponent(sourceEntity, SourceComponent)
  if (!source) return
  if (control) {
    const state = getState(GLTFSnapshotState)[source]
    if (shift) {
      if (state.index >= state.snapshots.length - 1) return
      dispatchAction(GLTFSnapshotAction.redo({ count: 1, source }))
    } else {
      if (state.index <= 0) return
      dispatchAction(GLTFSnapshotAction.undo({ count: 1, source }))
    }
  } else {
    toggleTransformSpace()
  }
}

const onEqual = () => {
  const rendererState = useMutableState(RendererState)
  rendererState.gridHeight.set(rendererState.gridHeight.value + 1)
}

const onMinus = () => {
  const rendererState = useMutableState(RendererState)
  rendererState.gridHeight.set(rendererState.gridHeight.value - 1)
}

const onDelete = () => {
  EditorControlFunctions.removeObject(SelectionState.getSelectedEntities())
}

function copy(event) {
  if (isInputSelected()) return
  event.preventDefault()

  // TODO: Prevent copying objects with a disabled transform
  if (getState(SelectionState).selectedEntities.length > 0) {
    event.clipboardData.setData(
      'application/vnd.editor.nodes',
      JSON.stringify({ entities: getState(SelectionState).selectedEntities })
    )
  }
}

const inputSourceQuery = defineQuery([InputSourceComponent])

function paste(event) {
  if (isInputSelected()) return

  const isMiddleClick = inputSourceQuery().find((e) => getComponent(e, InputSourceComponent).buttons.AuxiliaryClick)
  if (isMiddleClick) return

  event.preventDefault()

  let data

  if ((data = event.clipboardData.getData('application/vnd.editor.nodes')) !== '') {
    const { entities } = JSON.parse(data)

    if (!Array.isArray(entities)) return
    const nodes = entities.filter((entity) => hasComponent(entity, EntityTreeComponent))

    if (nodes) {
      EditorControlFunctions.duplicateObject(nodes)
    }
  } else if ((data = event.clipboardData.getData('text')) !== '') {
    try {
      const url = new URL(data)
      addMediaNode(url.href).catch((error) => getMutableState(EditorErrorState).error.set(error))
    } catch (e) {
      console.warn('Clipboard contents did not contain a valid url')
    }
  }
}

const findIntersectObjects = (object: Object3D, excludeObjects?: Object3D[], excludeLayers?: Layers): void => {
  if (
    (excludeObjects && excludeObjects.indexOf(object) !== -1) ||
    (excludeLayers && excludeLayers.test(object.layers)) ||
    !object.visible
  ) {
    return
  }

  raycaster.intersectObject(object, false, raycasterResults)

  for (let i = 0; i < object.children.length; i++) {
    findIntersectObjects(object.children[i], excludeObjects, excludeLayers)
  }
}

const findNextSelectionEntity = (topLevelParent: Entity, child: Entity): Entity => {
  // Check for adjacent child
  const childTree = getComponent(child, EntityTreeComponent)
  const parentTree = getComponent(childTree.parentEntity, EntityTreeComponent)
  if (topLevelParent !== child) {
    const children = parentTree.children
    const currentChildIndex = children.findIndex((entity) => child === entity)
    if (children.length > currentChildIndex + 1) return children[currentChildIndex + 1]
  }

  // Otherwise if child has children traverse down
  if (childTree.children.length) return childTree.children[0]

  if (childTree.parentEntity === topLevelParent || parentTree.parentEntity === topLevelParent) return topLevelParent
  return findNextSelectionEntity(topLevelParent, parentTree.parentEntity)
}

const inputQuery = defineQuery([InputSourceComponent])
let clickStartEntity = UndefinedEntity

const execute = () => {
  const entity = AvatarComponent.getSelfAvatarEntity()
  if (entity) return

  if (hasComponent(Engine.instance.cameraEntity, FlyControlComponent)) return

  const selectedEntities = SelectionState.getSelectedEntities()

  const inputSources = inputQuery()

  const buttons = InputComponent.getMergedButtonsForInputSources(inputSources)

  if (buttons.KeyB?.down) onKeyB()
  if (buttons.KeyE?.down) onKeyE()
  if (buttons.KeyP?.down) onKeyP()
  if (buttons.KeyR?.down) onKeyR()
  if (buttons.KeyW?.down) onKeyW()
  if (buttons.KeyC?.down) onKeyC()
  if (buttons.KeyX?.down) onKeyX()
  if (buttons.KeyF?.down) onKeyF()
  if (buttons.KeyZ?.down) onKeyZ(!!buttons.ControlLeft?.pressed, !!buttons.ShiftLeft?.pressed)
  if (buttons.Equal?.down) onEqual()
  if (buttons.Minus?.down) onMinus()
  if (buttons.Escape?.down) onEscape()
  if (buttons.Delete?.down) onDelete()

  if (selectedEntities) {
    const lastSelection = selectedEntities[selectedEntities.length - 1]
    if (hasComponent(lastSelection, TransformGizmoControlledComponent)) {
      // dont let use the editor camera while dragging
      const mainOrbitCamera = getOptionalMutableComponent(Engine.instance.cameraEntity, CameraOrbitComponent)
      const controllerEntity = getComponent(lastSelection, TransformGizmoControlledComponent).controller
      if (mainOrbitCamera && controllerEntity !== UndefinedEntity)
        mainOrbitCamera.disabled.set(getComponent(controllerEntity, TransformGizmoControlComponent).dragging)
    }
  }

  if (buttons.PrimaryClick?.pressed) {
    let closestIntersection = {
      entity: UndefinedEntity,
      distance: Infinity
    }
    if (buttons.PrimaryClick?.down) {
      for (const inputSourceEntity of inputSources) {
        const intersection = InputSourceComponent.getClosestIntersection(inputSourceEntity)
        if (intersection && intersection.distance < closestIntersection.distance) {
          closestIntersection = intersection
        }
      }

      // Get top most parent entity from the GLTF document
      let selectedParentEntity = GLTFSnapshotState.findTopLevelParent(closestIntersection.entity)
      // If selectedParentEntity has a parent in a different GLTF document use that as top most parent
      const parent = getOptionalComponent(selectedParentEntity, EntityTreeComponent)?.parentEntity
      if (parent && getComponent(parent, SourceComponent) !== getComponent(selectedParentEntity, SourceComponent)) {
        selectedParentEntity = parent
      }

      // If entity is already selected set closest intersection, otherwise set top parent
      const selectedEntity =
        selectedParentEntity === clickStartEntity ? closestIntersection.entity : selectedParentEntity

      // If not showing model children in hierarchy don't allow those objects to be selected
      if (!FeatureFlagsState.enabled(FeatureFlags.Studio.UI.Hierarchy.ShowModelChildren)) {
        const inAuthoringLayer = GLTFSnapshotState.isInSnapshot(
          getOptionalComponent(selectedParentEntity, SourceComponent),
          selectedEntity
        )
        clickStartEntity = inAuthoringLayer ? selectedEntity : clickStartEntity
      } else {
        clickStartEntity = selectedEntity
      }

      /** @todo decide how we want selection to work with heirarchies */
      // Walks object heirarchy everytime a selected object is clicked again
      // const prevParentEntity = findTopLevelParent(clickStartEntity)
      // if (selectedParentEntity === prevParentEntity) {
      //   clickStartEntity = findNextSelectionEntity(prevParentEntity, clickStartEntity)
      // } else {
      //   clickStartEntity = selectedParentEntity
      // }
    }
    const capturingEntity = getState(InputState).capturingEntity
    if (capturingEntity !== UndefinedEntity && capturingEntity !== clickStartEntity) {
      clickStartEntity = capturingEntity
    }
  }
  if (buttons.PrimaryClick?.up && !buttons.PrimaryClick?.dragging) {
    if (hasComponent(clickStartEntity, SourceComponent) && !getState(ClickPlacementState).placementEntity) {
      const selectedEntities = SelectionState.getSelectedEntities()

      //only update selection if the selection actually changed (prevents unnecessarily creating new transform gizmos in edit mode)
      if (
        selectedEntities.length !== 1 ||
        (selectedEntities.length === 1 && selectedEntities[0] !== clickStartEntity)
      ) {
        SelectionState.updateSelection([getComponent(clickStartEntity, UUIDComponent)])
      }
    }
  }
}

const reactor = () => {
  const editorHelperState = useMutableState(EditorHelperState)
  const rendererState = useMutableState(RendererState)

  useEffect(() => {
    // todo figure out how to do these with our input system
    window.addEventListener('copy', copy)
    window.addEventListener('paste', paste)

    return () => {
      window.removeEventListener('copy', copy)
      window.removeEventListener('paste', paste)
    }
  }, [])

  useEffect(() => {
    const infiniteGridHelperEntity = rendererState.infiniteGridHelperEntity.value
    if (!infiniteGridHelperEntity) return
    setComponent(infiniteGridHelperEntity, InfiniteGridComponent, { size: editorHelperState.translationSnap.value })
  }, [editorHelperState.translationSnap, rendererState.infiniteGridHelperEntity])

  const viewerEntity = useMutableState(EngineState).viewerEntity.value

  useEffect(() => {
    if (!viewerEntity) return

    // set the active orbit camera to the main camera
    setComponent(viewerEntity, CameraOrbitComponent)
    setComponent(viewerEntity, InputComponent)

    return () => {
      removeComponent(viewerEntity, CameraOrbitComponent)
      removeComponent(viewerEntity, InputComponent)
    }
  }, [viewerEntity])

  return null
}

export const EditorControlSystem = defineSystem({
  uuid: 'ee.editor.EditorControlSystem',
  insert: { before: PresentationSystemGroup },
  execute,
  reactor
})
