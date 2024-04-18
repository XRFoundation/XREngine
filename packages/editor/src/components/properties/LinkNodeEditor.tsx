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

import React from 'react'
import { useTranslation } from 'react-i18next'

import { useComponent } from '@etherealengine/ecs/src/ComponentFunctions'

import LinkIcon from '@mui/icons-material/Link'

import { getEntityErrors } from '@etherealengine/engine/src/scene/components/ErrorComponent'
import { LinkComponent } from '@etherealengine/engine/src/scene/components/LinkComponent'
import BooleanInput from '../inputs/BooleanInput'
import InputGroup from '../inputs/InputGroup'
import { ControlledStringInput } from '../inputs/StringInput'
import NodeEditor from './NodeEditor'
import { EditorComponentType, commitProperty, updateProperty } from './Util'

/**
 * LinkNodeEditor component used to provide the editor view to customize link properties.
 *
 * @type {Class component}
 */
export const LinkNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  const linkComponent = useComponent(props.entity, LinkComponent)
  const errors = getEntityErrors(props.entity, LinkComponent)

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.linkComp.title')}
      description={t('editor:properties.linkComp.description')}
    >
      {errors ? (
        Object.entries(errors).map(([err, message]) => (
          <div key={err} style={{ marginTop: 2, color: '#FF8C00' }}>
            {'Error: ' + err + '--' + message}
          </div>
        ))
      ) : (
        <></>
      )}
      <InputGroup name="Navigate Path" label={t('editor:properties.linkComp.lbl-navigateScene')}>
        <BooleanInput value={linkComponent.sceneNav.value} onChange={commitProperty(LinkComponent, 'sceneNav')} />
      </InputGroup>
      {linkComponent.sceneNav.value ? (
        <>
          <InputGroup name="Location" label={t('editor:properties.linkComp.lbl-locaiton')}>
            <ControlledStringInput
              value={linkComponent.location.value}
              onChange={updateProperty(LinkComponent, 'location')}
              onRelease={commitProperty(LinkComponent, 'location')}
            />
          </InputGroup>
        </>
      ) : (
        <InputGroup name="LinkUrl" label={t('editor:properties.linkComp.lbl-url')}>
          <ControlledStringInput
            value={linkComponent.url.value}
            onChange={updateProperty(LinkComponent, 'url')}
            onRelease={commitProperty(LinkComponent, 'url')}
          />
        </InputGroup>
      )}
    </NodeEditor>
  )
}

LinkNodeEditor.iconComponent = LinkIcon

export default LinkNodeEditor
