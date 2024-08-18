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
import { HiOutlineVideoCamera } from 'react-icons/hi2'

import { useComponent, useOptionalComponent } from '@etherealengine/ecs/src/ComponentFunctions'
import {
  EditorComponentType,
  commitProperty,
  updateProperty
} from '@etherealengine/editor/src/components/properties/Util'
import { ItemTypes } from '@etherealengine/editor/src/constants/AssetTypes'
import {
  MediaComponent,
  MediaElementComponent,
  setTime
} from '@etherealengine/engine/src/scene/components/MediaComponent'
import { PlayMode } from '@etherealengine/engine/src/scene/constants/PlayMode'
import Button from '../../../../primitives/tailwind/Button'
import Slider from '../../../../primitives/tailwind/Slider'
import ArrayInputGroup from '../../input/Array'
import BooleanInput from '../../input/Boolean'
import InputGroup from '../../input/Group'
import NumericInput from '../../input/Numeric'
import SelectInput from '../../input/Select'
import NodeEditor from '../nodeEditor'

const AUDIO_MULTIPLIER = 50
const PlayModeOptions = [
  {
    label: 'Single',
    value: PlayMode.single
  },
  {
    label: 'Random',
    value: PlayMode.random
  },
  {
    label: 'Loop',
    value: PlayMode.loop
  },
  {
    label: 'SingleLoop',
    value: PlayMode.singleloop
  }
]

/**
 * MediaNodeEditor used to render editor view for property customization.
 */
export const MediaNodeEditor: EditorComponentType = (props) => {
  const { t } = useTranslation()

  const media = useComponent(props.entity, MediaComponent)
  const element = useOptionalComponent(props.entity, MediaElementComponent)

  const toggle = () => {
    media.paused.set(!media.paused.value)
  }

  const reset = () => {
    if (element) {
      setTime(element.element, media.seekTime.value)
    }
  }

  return (
    <NodeEditor
      {...props}
      name={t('editor:properties.media.name')}
      description={t('editor:properties.media.description')}
      icon={<MediaNodeEditor.iconComponent />}
    >
      <InputGroup name="Volume" label={t('editor:properties.media.lbl-volume')} className="w-auto">
        <Slider
          min={0}
          max={100}
          step={1}
          value={media.volume.value * AUDIO_MULTIPLIER}
          onChange={(value) => updateProperty(MediaComponent, 'volume')(value / AUDIO_MULTIPLIER)}
          onRelease={(value) => commitProperty(MediaComponent, 'volume')(value / AUDIO_MULTIPLIER)}
        />
      </InputGroup>

      <InputGroup name="Start Time" label={t('editor:properties.media.seektime')}>
        <NumericInput
          value={media.seekTime.value}
          onChange={updateProperty(MediaComponent, 'seekTime')}
          onRelease={commitProperty(MediaComponent, 'seekTime')}
        />
      </InputGroup>

      <InputGroup name="Is Music" label={t('editor:properties.media.lbl-isMusic')}>
        <BooleanInput value={media.isMusic.value} onChange={commitProperty(MediaComponent, 'isMusic')} />
      </InputGroup>

      <InputGroup
        name="Controls"
        label={t('editor:properties.media.lbl-controls')}
        info={t('editor:properties.media.info-controls')}
      >
        <BooleanInput value={media.controls.value} onChange={commitProperty(MediaComponent, 'controls')} />
      </InputGroup>

      <InputGroup
        name="Auto Play"
        label={t('editor:properties.media.lbl-autoplay')}
        info={t('editor:properties.media.info-autoplay')}
      >
        <BooleanInput value={media.autoplay.value} onChange={commitProperty(MediaComponent, 'autoplay')} />
      </InputGroup>

      <InputGroup
        name="Synchronize"
        label={t('editor:properties.media.lbl-synchronize')}
        info={t('editor:properties.media.info-synchronize')}
      >
        <BooleanInput value={media.synchronize.value} onChange={commitProperty(MediaComponent, 'synchronize')} />
      </InputGroup>

      <ArrayInputGroup
        label={t('editor:properties.media.paths')}
        inputLabel={t('editor:properties.media.path')}
        values={media.resources.value as string[]}
        dropTypes={[...ItemTypes.Audios, ...ItemTypes.Videos]}
        onChange={commitProperty(MediaComponent, 'resources')}
      />

      <InputGroup name="Play Mode" label={t('editor:properties.media.playmode')}>
        <SelectInput
          key={props.entity}
          options={PlayModeOptions}
          value={media.playMode.value}
          onChange={commitProperty(MediaComponent, 'playMode')}
        />
      </InputGroup>
      {media.resources.length > 0 && (
        <InputGroup
          name="media-controls"
          label={t('editor:properties.media.lbl-mediaControls')}
          className="flex flex-row gap-2"
        >
          <Button variant="outline" onClick={toggle}>
            {media.paused.value ? t('editor:properties.media.playtitle') : t('editor:properties.media.pausetitle')}
          </Button>
          <Button variant="outline" onClick={reset}>
            {t('editor:properties.media.resettitle')}
          </Button>
        </InputGroup>
      )}
    </NodeEditor>
  )
}

MediaNodeEditor.iconComponent = HiOutlineVideoCamera

export default MediaNodeEditor
