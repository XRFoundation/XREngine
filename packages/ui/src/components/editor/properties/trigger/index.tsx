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

import { UUIDComponent, defineQuery, getComponent, hasComponent, useComponent } from '@etherealengine/ecs'
import {
  EditorComponentType,
  commitProperties,
  commitProperty,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import { useHookstate } from '@etherealengine/hyperflux'
import { CallbackComponent } from '@etherealengine/spatial/src/common/CallbackComponent'
import { NameComponent } from '@etherealengine/spatial/src/common/NameComponent'
import { TriggerComponent } from '@etherealengine/spatial/src/physics/components/TriggerComponent'
import { EntityTreeComponent } from '@etherealengine/spatial/src/transform/components/EntityTree'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { HiPlus, HiTrash } from 'react-icons/hi2'
import Button from '../../../../primitives/tailwind/Button'
import { SelectOptionsType } from '../../../../primitives/tailwind/Select'
import InputGroup from '../../input/Group'
import SelectInput from '../../input/Select'
import StringInput from '../../input/String'
import NodeEditor from '../nodeEditor'

const callbackQuery = defineQuery([CallbackComponent])

type TargetOptionType = { label: string; value: string; callbacks: SelectOptionsType[] }

const TriggerProperties: EditorComponentType = (props) => {
  const { t } = useTranslation()
  const targets = useHookstate<TargetOptionType[]>([{ label: 'Self', value: 'Self', callbacks: [] }])

  const triggerComponent = useComponent(props.entity, TriggerComponent)

  useEffect(() => {
    const options = [] as TargetOptionType[]
    options.push({
      label: 'Self',
      value: 'Self',
      callbacks: []
    })
    for (const entity of callbackQuery()) {
      if (entity === props.entity || !hasComponent(entity, EntityTreeComponent)) continue
      const callbacks = getComponent(entity, CallbackComponent)
      options.push({
        label: getComponent(entity, NameComponent),
        value: getComponent(entity, UUIDComponent),
        callbacks: Object.keys(callbacks).map((cb) => ({ label: cb, value: cb }))
      })
    }
    targets.set(options)
  }, [])

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.trigger.name')}
      description={t('editor:properties.trigger.description')}
    >
      <div className="my-3 flex justify-end">
        <Button
          variant="transparent"
          title={t('editor:properties.triggerVolume.lbl-addTrigger')}
          startIcon={<HiPlus />}
          className="text-sm text-[#8B8B8D]"
          onClick={() => {
            const triggers = [
              ...triggerComponent.triggers.value,
              {
                target: 'Self',
                onEnter: '',
                onExit: ''
              }
            ]
            commitProperties(TriggerComponent, { triggers: JSON.parse(JSON.stringify(triggers)) }, [props.entity])
          }}
        />
      </div>
      {triggerComponent.triggers.map((trigger, index) => {
        const targetOption = targets.value.find((o) => o.value === trigger.target.value)
        const target = targetOption ? targetOption.value : 'Self'
        console.log('debug1 ', targetOption, 'and', targetOption?.callbacks.length)
        return (
          <div className="-ml-4 h-[calc(100%+1.5rem)] w-[calc(100%+2rem)] bg-[#1A1A1A] pb-1.5">
            <Button
              variant="transparent"
              title={t('editor:properties.triggerVolume.lbl-removeTrigger')}
              startIcon={<HiTrash />}
              className="ml-auto text-sm text-[#8B8B8D]"
              onClick={() => {
                const triggers = [...triggerComponent.triggers.value]
                triggers.splice(index, 1)
                commitProperties(TriggerComponent, { triggers: JSON.parse(JSON.stringify(triggers)) }, [props.entity])
              }}
            />
            <InputGroup name="Target" label={t('editor:properties.triggerVolume.lbl-target')}>
              <SelectInput
                value={trigger.target.value ?? 'Self'}
                onChange={commitProperty(TriggerComponent, `triggers.${index}.target` as any)}
                options={targets.value.map(({ label, value }) => ({ label, value }))}
                disabled={props.multiEdit}
              />
            </InputGroup>
            <InputGroup name="On Enter" label={t('editor:properties.triggerVolume.lbl-onenter')}>
              {targetOption?.callbacks.length ? (
                <SelectInput
                  value={trigger.onEnter.value!}
                  onChange={commitProperty(TriggerComponent, `triggers.${index}.onEnter` as any)}
                  options={targetOption?.callbacks ? targetOption.callbacks.slice() : []}
                  disabled={props.multiEdit || !target}
                />
              ) : (
                <StringInput
                  value={trigger.onEnter.value!}
                  onChange={updateProperty(TriggerComponent, `triggers.${index}.onEnter` as any)}
                  onRelease={commitProperty(TriggerComponent, `triggers.${index}.onEnter` as any)}
                  disabled={props.multiEdit || !target}
                  className="bg-[#212226]"
                />
              )}
            </InputGroup>

            <InputGroup name="On Exit" label={t('editor:properties.triggerVolume.lbl-onexit')}>
              {targetOption?.callbacks.length ? (
                <SelectInput
                  value={trigger.onExit.value!}
                  onChange={commitProperty(TriggerComponent, `triggers.${index}.onExit` as any)}
                  options={targetOption?.callbacks ? targetOption.callbacks.slice() : []}
                  disabled={props.multiEdit || !target}
                />
              ) : (
                <StringInput
                  value={trigger.onExit.value!}
                  onRelease={updateProperty(TriggerComponent, `triggers.${index}.onExit` as any)}
                  onChange={commitProperty(TriggerComponent, `triggers.${index}.onExit` as any)}
                  disabled={props.multiEdit || !target}
                  className="bg-[#212226]"
                />
              )}
            </InputGroup>
          </div>
        )
      })}
    </NodeEditor>
  )
}

export default TriggerProperties
