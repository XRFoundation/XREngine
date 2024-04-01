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

import { Quaternion, Vector3 } from 'three'
import matches from 'ts-matches'

import { defineAction, defineState, getMutableState, getState, useHookstate } from '@etherealengine/hyperflux'

import { Entity } from '@etherealengine/ecs/src/Entity'
import { useEffect } from 'react'
import { DepthDataTexture } from './DepthDataTexture'

export class XRAction {
  static sessionChanged = defineAction({
    type: 'xre.xr.sessionChanged' as const,
    active: matches.boolean,
    $cache: { removePrevious: true }
  })

  // todo, support more haptic formats other than just vibrating controllers
  static vibrateController = defineAction({
    type: 'xre.xr.vibrateController',
    handedness: matches.literals('left', 'right'),
    value: matches.number,
    duration: matches.number
  })
}

// TODO: divide this up into the systems that manage these states
export const XRState = defineState({
  name: 'XRState',
  initial: () => {
    return {
      sessionActive: false, // TODO: remove this; it's redundant, just need to check if session exists
      requestingSession: false,
      scenePosition: new Vector3(),
      sceneRotation: new Quaternion(),
      sceneScale: 1,
      sceneScaleAutoMode: true,
      sceneScaleTarget: 1,
      sceneRotationOffset: 0,
      scenePlacementMode: 'unplaced' as 'unplaced' | 'placing' | 'placed',
      supportedSessionModes: {
        inline: false,
        'immersive-ar': false,
        'immersive-vr': false
      },
      unassingedInputSources: [] as XRInputSource[],
      session: null as XRSession | null,
      sessionMode: 'none' as 'inline' | 'immersive-ar' | 'immersive-vr' | 'none',
      /** Stores the depth map data - will exist if depth map is supported */
      depthDataTexture: null as DepthDataTexture | null,
      is8thWallActive: false,
      viewerInputSourceEntity: 0 as Entity,
      viewerPose: null as XRViewerPose | null | undefined,
      /** @todo replace with proper proportions API */
      userEyeHeight: 1.75,
      userHeightRatio: 1,
      xrFrame: null as XRFrame | null
    }
  },

  /**
   * Gets the world scale according to avatar scaling factor and scene scale
   * - divide any world-space distances by this to get the real-world distance
   * @todo - can we think of a better name for this?
   * @returns {number} the world scale
   */
  get worldScale(): number {
    const { sceneScale, userHeightRatio } = getState(XRState)
    return sceneScale * userHeightRatio
  },

  setTrackingSpace: () => {
    const { xrFrame, userEyeHeight } = getState(XRState)

    if (!xrFrame) {
      getMutableState(XRState).userHeightRatio.set(1)
      return
    }

    const viewerPose = xrFrame.getViewerPose(ReferenceSpace.localFloor!)

    if (!viewerPose) {
      getMutableState(XRState).userHeightRatio.set(1)
      return
    }

    getMutableState(XRState).userHeightRatio.set(viewerPose.transform.position.y / userEyeHeight)
  }
})

export const XRControlsState = defineState({
  name: 'XRControlsState',
  initial: () => ({
    /**
     * Specifies that the user has movement controls if:
     * - in an immersive session
     * - or in an immersive session with a world-space interaction mode
     * - or in an immersive-ar and dollhouse mode
     */
    isMovementControlsEnabled: true,
    /**
     * Specifies that the camera is attached to the avatar if:
     * - in an immersion session and not in placement mode or miniature mode
     */
    isCameraAttachedToAvatar: true,

    avatarCameraMode: 'auto' as 'auto' | 'attached' | 'detached'
  })
})

export const useXRMovement = () => {
  const xrMovementState = getMutableState(XRControlsState)
  const avatarCameraMode = useHookstate(xrMovementState.avatarCameraMode)

  const xrState = getMutableState(XRState)
  const sceneScale = useHookstate(xrState.sceneScale)
  const scenePlacementMode = useHookstate(xrState.scenePlacementMode)
  const session = useHookstate(xrState.session)
  const sessionMode = useHookstate(xrState.sessionMode)
  const sessionActive = useHookstate(xrState.sessionActive)

  const getAvatarCameraMode = () => {
    if (!session.value || scenePlacementMode.value === 'placing') return false
    if (avatarCameraMode.value === 'auto') {
      return sceneScale.value === 1
    }
    return avatarCameraMode.value === 'attached'
  }

  useEffect(() => {
    xrMovementState.isCameraAttachedToAvatar.set(getAvatarCameraMode())
  }, [avatarCameraMode, sceneScale, scenePlacementMode, session])

  const getMovementControlsEnabled = () => {
    if (!sessionActive.value) return true
    const isMiniatureScale = sceneScale.value !== 1
    return sessionMode.value === 'immersive-ar' ? isMiniatureScale : true
  }

  useEffect(() => {
    xrMovementState.isMovementControlsEnabled.set(getMovementControlsEnabled())
  }, [sceneScale, sessionActive, sessionMode])
}

export const ReferenceSpace = {
  /**
   * The scene origin reference space describes where the origin of the tracking space is
   * TODO: this will be deprecated in a future reference space refactor
   */
  origin: null as XRReferenceSpace | null,
  /**
   * @see https://www.w3.org/TR/webxr/#dom-xrreferencespacetype-local-floor
   */
  localFloor: null as XRReferenceSpace | null,
  /**
   * @see https://www.w3.org/TR/webxr/#dom-xrreferencespacetype-viewer
   */
  viewer: null as XRReferenceSpace | null
}
globalThis.ReferenceSpace = ReferenceSpace

const userAgent = 'navigator' in globalThis ? navigator.userAgent : ''

/**
 * Wheter or not this is a mobile XR headset
 **/
export const isMobileXRHeadset =
  userAgent.includes('Oculus') ||
  userAgent.includes('VR') ||
  userAgent.includes('AR') ||
  userAgent.includes('Reality') ||
  userAgent.includes('Wolvic')
