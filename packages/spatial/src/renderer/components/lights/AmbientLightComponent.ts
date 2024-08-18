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
import { AmbientLight, ColorRepresentation } from 'three'

import { defineComponent, setComponent, useComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { useEntityContext } from '@etherealengine/ecs/src/EntityFunctions'
import { matches } from '@etherealengine/hyperflux'

import { matchesColor } from '../../../common/functions/MatchesUtils'
import { useDisposable } from '../../../resources/resourceHooks'
import { addObjectToGroup, removeObjectFromGroup } from '../GroupComponent'
import { LightTagComponent } from './LightTagComponent'

export const AmbientLightComponent = defineComponent({
  name: 'AmbientLightComponent',
  jsonID: 'EE_ambient_light',

  onInit: (entity) => {
    return {
      color: 0xffffff as ColorRepresentation,
      intensity: 1
    }
  },

  onSet: (entity, component, json) => {
    if (!json) return
    if (matchesColor.test(json.color)) component.color.set(json.color)
    if (matches.number.test(json.intensity)) component.intensity.set(json.intensity)
  },

  toJSON: (entity, component) => {
    return {
      color: component.color.value,
      intensity: component.intensity.value
    }
  },

  reactor: function () {
    const entity = useEntityContext()
    const ambientLightComponent = useComponent(entity, AmbientLightComponent)
    const [light] = useDisposable(AmbientLight, entity)

    useEffect(() => {
      setComponent(entity, LightTagComponent)
      addObjectToGroup(entity, light)
      return () => {
        removeObjectFromGroup(entity, light)
      }
    }, [])

    useEffect(() => {
      light.color.set(ambientLightComponent.color.value)
    }, [ambientLightComponent.color])

    useEffect(() => {
      light.intensity = ambientLightComponent.intensity.value
    }, [ambientLightComponent.intensity])

    return null
  }
})
