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

import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { getOptionalComponent, useOptionalComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import { Entity } from '@etherealengine/ecs/src/Entity'
import { useHookstate } from '@etherealengine/hyperflux'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { GroupComponent } from '@etherealengine/spatial/src/renderer/components/GroupComponent'

import { EditorControlFunctions } from '../../functions/EditorControlFunctions'
import InputGroup from '../inputs/InputGroup'
import StringInput from '../inputs/StringInput'
import { EditorComponentType } from './Util'

/**
 * Creating component using InputGroup component.
 *
 * @type {Component}
 */
const styledNameInputGroupStyle = {
  label: {
    width: 'auto !important'
  }
}

/**
 * NameInputGroup is used to render input group PropertiesPanelContainer.
 *
 * @type {class component}
 */
export const NameInputGroup: EditorComponentType = (props) => {
  const nameComponent = useOptionalComponent(props.entity, NameComponent)
  // temp name is used to store the name of the entity, which is then updated upon onBlur event
  const tempName = useHookstate('')

  useEffect(() => {
    if (!nameComponent) return
    tempName.set(nameComponent.value)
  }, [nameComponent?.value])

  const focusedNode = useHookstate<Entity | undefined>(undefined)
  const { t } = useTranslation()

  //function to handle change in name property
  const updateName = () => {
    EditorControlFunctions.modifyName([props.entity], tempName.value)

    const group = getOptionalComponent(props.entity, GroupComponent)
    if (group) for (const obj3d of group) obj3d.name = tempName.value
  }

  //function called when element get focused
  const onFocus = () => {
    if (!nameComponent) return
    focusedNode.set(props.entity)
    tempName.set(nameComponent.value)
  }

  // function to handle onBlur event on name property
  const onBlurName = () => {
    if (!nameComponent) return
    // Check that the focused node is current node before setting the property.
    // This can happen when clicking on another node in the HierarchyPanel
    if (nameComponent.value !== tempName.value && props.entity === focusedNode.value) {
      updateName()
    }

    focusedNode.set(undefined)
  }

  //function to handle keyUp event on name property
  const onKeyUpName = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      updateName()
    }
  }

  return (
    <InputGroup {...{ style: { styledNameInputGroupStyle } }} name="Name" label={t('editor:properties.name.lbl-name')}>
      <StringInput
        value={tempName.value}
        onChange={tempName.set}
        onFocus={onFocus}
        onBlur={onBlurName}
        onKeyUp={onKeyUpName}
      />
    </InputGroup>
  )
}

export default NameInputGroup
