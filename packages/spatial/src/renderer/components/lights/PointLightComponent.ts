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
import { ColorRepresentation, PointLight } from 'three'

import {
  defineComponent,
  removeComponent,
  setComponent,
  useComponent,
  useOptionalComponent
} from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { matches, useMutableState } from '@etherealengine/hyperflux'

import { LightHelperComponent } from '../../../common/debug/LightHelperComponent'
import { matchesColor } from '../../../common/functions/MatchesUtils'
import { useDisposable } from '../../../resources/resourceHooks'
import { isMobileXRHeadset } from '../../../xr/XRState'
import { RendererState } from '../../RendererState'
import { addObjectToGroup, removeObjectFromGroup } from '../GroupComponent'
import { LightTagComponent } from './LightTagComponent'

export const PointLightComponent = defineComponent({
  name: 'PointLightComponent',
  jsonID: 'EE_point_light',

  onInit: (entity) => {
    return {
      color: 0xffffff as ColorRepresentation,
      intensity: 1,
      range: 0,
      decay: 2,
      castShadow: false,
      shadowBias: 0.5,
      shadowRadius: 1,
      helperEntity: null as Entity | null
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matchesColor.test(json.color)) component.color.set(json.color)
    if (matches.number.test(json.intensity)) component.intensity.set(json.intensity)
    if (matches.number.test(json.range)) component.range.set(json.range)
    if (matches.number.test(json.decay)) component.decay.set(json.decay)
    if (matches.boolean.test(json.castShadow)) component.castShadow.set(json.castShadow)
    /** backwards compat */
    if (matches.number.test(json.shadowBias)) component.shadowBias.set(json.shadowBias)
    if (matches.number.test(json.shadowRadius)) component.shadowRadius.set(json.shadowRadius)
  },

  toJSON: (entity, component) => {
    return {
      color: component.color.value,
      intensity: component.intensity.value,
      range: component.range.value,
      decay: component.decay.value,
      castShadow: component.castShadow.value,
      shadowBias: component.shadowBias.value,
      shadowRadius: component.shadowRadius.value
    }
  },

  reactor: function () {
    const entity = useEntityContext()
    const renderState = useMutableState(RendererState)
    const debugEnabled = renderState.nodeHelperVisibility
    const pointLightComponent = useComponent(entity, PointLightComponent)
    const [light] = useDisposable(PointLight, entity)
    const lightHelper = useOptionalComponent(entity, LightHelperComponent)

    useEffect(() => {
      setComponent(entity, LightTagComponent)
      if (isMobileXRHeadset) return
      addObjectToGroup(entity, light)
      return () => {
        removeObjectFromGroup(entity, light)
      }
    }, [])

    useEffect(() => {
      light.color.set(pointLightComponent.color.value)
      if (lightHelper) lightHelper.color.set(pointLightComponent.color.value)
    }, [pointLightComponent.color])

    useEffect(() => {
      light.intensity = pointLightComponent.intensity.value
    }, [pointLightComponent.intensity])

    useEffect(() => {
      light.distance = pointLightComponent.range.value
    }, [pointLightComponent.range])

    useEffect(() => {
      light.decay = pointLightComponent.decay.value
    }, [pointLightComponent.decay])

    useEffect(() => {
      light.castShadow = pointLightComponent.castShadow.value
    }, [pointLightComponent.castShadow])

    useEffect(() => {
      light.shadow.bias = pointLightComponent.shadowBias.value
    }, [pointLightComponent.shadowBias])

    useEffect(() => {
      light.shadow.radius = pointLightComponent.shadowRadius.value
    }, [pointLightComponent.shadowRadius])

    useEffect(() => {
      if (light.shadow.mapSize.x !== renderState.shadowMapResolution.value) {
        light.shadow.mapSize.set(renderState.shadowMapResolution.value, renderState.shadowMapResolution.value)
        light.shadow.map?.dispose()
        light.shadow.map = null as any
        light.shadow.camera.updateProjectionMatrix()
        light.shadow.needsUpdate = true
      }
    }, [renderState.shadowMapResolution])

    useEffect(() => {
      if (debugEnabled.value) {
        setComponent(entity, LightHelperComponent, { name: 'pointlight-helper', light: light })
      }
      return () => {
        removeComponent(entity, LightHelperComponent)
      }
    }, [debugEnabled])

    return null
  }
})
