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

import { VRM, VRMHumanBoneName, VRMHumanBones } from '@pixiv/three-vrm'
import { useEffect } from 'react'
import { AnimationAction, Group, Matrix4, SkeletonHelper, Vector3 } from 'three'

import {
  defineComponent,
  getComponent,
  setComponent,
  useComponent,
  useOptionalComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { createEntity, entityExists, removeEntity, useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { getMutableState, matches, useHookstate } from '@etherealengine/hyperflux'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { addObjectToGroup } from '@etherealengine/spatial/src/renderer/components/GroupComponent'
import { setObjectLayers } from '@etherealengine/spatial/src/renderer/components/ObjectLayerComponent'
import { setVisibleComponent, VisibleComponent } from '@etherealengine/spatial/src/renderer/components/VisibleComponent'
import { ObjectLayers } from '@etherealengine/spatial/src/renderer/constants/ObjectLayers'
import { RendererState } from '@etherealengine/spatial/src/renderer/RendererState'
import { ComputedTransformComponent } from '@etherealengine/spatial/src/transform/components/ComputedTransformComponent'

import { ModelComponent } from '../../scene/components/ModelComponent'
import { preloadedAnimations } from '../animation/Util'
import { AnimationState } from '../AnimationManager'
import {
  retargetAvatarAnimations,
  setAvatarSpeedFromRootMotion,
  setupAvatarForUser,
  setupAvatarProportions
} from '../functions/avatarFunctions'
import { AvatarState } from '../state/AvatarNetworkState'
import { AvatarComponent } from './AvatarComponent'
import { AvatarPendingComponent } from './AvatarPendingComponent'

export const AvatarAnimationComponent = defineComponent({
  name: 'AvatarAnimationComponent',

  onInit: (entity) => {
    return {
      animationGraph: {
        blendAnimation: undefined as undefined | AnimationAction,
        fadingOut: false,
        blendStrength: 0,
        layer: 0
      },
      /** ratio between original and target skeleton's root.position.y */
      rootYRatio: 1,
      /** The input vector for 2D locomotion blending space */
      locomotion: new Vector3(),
      /** Time since the last update */
      deltaAccumulator: 0,
      /** Tells us if we are suspended in midair */
      isGrounded: true
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matches.number.test(json.rootYRatio)) component.rootYRatio.set(json.rootYRatio)
    if (matches.object.test(json.locomotion)) component.locomotion.value.copy(json.locomotion)
    if (matches.number.test(json.deltaAccumulator)) component.deltaAccumulator.set(json.deltaAccumulator)
    if (matches.boolean.test(json.isGrounded)) component.isGrounded.set(json.isGrounded)
  }
})

export type Matrices = { local: Matrix4; world: Matrix4 }
export const AvatarRigComponent = defineComponent({
  name: 'AvatarRigComponent',

  onInit: (entity) => {
    return {
      /** rig bones with quaternions relative to the raw bones in their bind pose */
      normalizedRig: null! as VRMHumanBones,
      /** contains the raw bone quaternions */
      rawRig: null! as VRMHumanBones,
      /** contains ik solve data */
      ikMatrices: {} as Record<VRMHumanBoneName, Matrices>,
      /** The VRM model */
      vrm: null! as VRM,
      avatarURL: null as string | null
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matches.object.test(json.normalizedRig)) component.normalizedRig.set(json.normalizedRig)
    if (matches.object.test(json.rawRig)) component.rawRig.set(json.rawRig)
    if (matches.object.test(json.vrm)) component.vrm.set(json.vrm as VRM)
    if (matches.string.test(json.avatarURL)) component.avatarURL.set(json.avatarURL)
  },

  reactor: function () {
    const entity = useEntityContext()
    const debugEnabled = useHookstate(getMutableState(RendererState).avatarDebug)
    const rigComponent = useComponent(entity, AvatarRigComponent)
    const pending = useOptionalComponent(entity, AvatarPendingComponent)
    const visible = useOptionalComponent(entity, VisibleComponent)
    const modelComponent = useOptionalComponent(entity, ModelComponent)
    const locomotionAnimationState = useHookstate(
      getMutableState(AnimationState).loadedAnimations[preloadedAnimations.locomotion]
    )

    useEffect(() => {
      if (!visible?.value || !debugEnabled.value || pending?.value || !rigComponent.value.normalizedRig?.hips?.node)
        return

      const helper = new SkeletonHelper(rigComponent.value.vrm.scene as Group)
      helper.frustumCulled = false
      helper.name = `target-rig-helper-${entity}`

      const helperEntity = createEntity()
      setVisibleComponent(helperEntity, true)
      addObjectToGroup(helperEntity, helper)
      setComponent(helperEntity, NameComponent, helper.name)
      setObjectLayers(helper, ObjectLayers.AvatarHelper)

      setComponent(helperEntity, ComputedTransformComponent, {
        referenceEntities: [entity],
        computeFunction: () => {
          // this updates the bone helper lines
          helper.updateMatrixWorld(true)
        }
      })

      return () => {
        removeEntity(helperEntity)
      }
    }, [visible, debugEnabled, pending, rigComponent.normalizedRig])

    useEffect(() => {
      if (!modelComponent?.asset?.value) return
      const model = getComponent(entity, ModelComponent)
      setupAvatarProportions(entity, model.asset as VRM)
      setComponent(entity, AvatarRigComponent, {
        vrm: model.asset as VRM,
        avatarURL: model.src
      })
      return () => {
        if (!entityExists(entity)) return
        setComponent(entity, AvatarRigComponent, {
          vrm: null!,
          avatarURL: null
        })
      }
    }, [modelComponent?.asset])

    useEffect(() => {
      if (
        !rigComponent.value ||
        !rigComponent.value.vrm ||
        !rigComponent.value.avatarURL ||
        !locomotionAnimationState?.value
      )
        return
      const rig = getComponent(entity, AvatarRigComponent)
      try {
        setupAvatarForUser(entity, rig.vrm)
        retargetAvatarAnimations(entity)
      } catch (e) {
        console.error('Failed to load avatar', e)
        if (entity === AvatarComponent.getSelfAvatarEntity()) AvatarState.selectRandomAvatar()
      }
    }, [rigComponent.vrm])

    useEffect(() => {
      if (!locomotionAnimationState?.value) return
      setAvatarSpeedFromRootMotion()
    }, [locomotionAnimationState])

    return null
  }
})
