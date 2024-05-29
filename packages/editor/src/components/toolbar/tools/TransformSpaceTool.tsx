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

import LanguageIcon from '@mui/icons-material/Language'
import { t } from 'i18next'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { TransformSpace } from '@etherealengine/engine/src/scene/constants/transformConstants'
import { getMutableState, useHookstate } from '@etherealengine/hyperflux'

import { setTransformSpace, toggleTransformSpace } from '../../../functions/transformFunctions'
import { EditorHelperState } from '../../../services/EditorHelperState'
import SelectInput from '../../inputs/SelectInput'
import { InfoTooltip } from '../../layout/Tooltip'
import * as styles from '../styles.module.scss'

const transformSpaceOptions = [
  {
    label: t('editor:toolbar.transformSpace.lbl-selection'),
    info: t('editor:toolbar.transformSpace.info-selection'),
    value: TransformSpace.local
  },
  {
    label: t('editor:toolbar.transformSpace.lbl-world'),
    info: t('editor:toolbar.transformSpace.info-world'),
    value: TransformSpace.world
  }
]

const TransformSpaceTool = () => {
  const { t } = useTranslation()

  const transformSpace = useHookstate(getMutableState(EditorHelperState).transformSpace)

  return (
    <InfoTooltip title={t('editor:toolbar.transformSpace.description')} placement="right">
      <div className={styles.toolbarInputGroup} id="transform-space">
        <InfoTooltip title={t('editor:toolbar.transformSpace.lbl-toggleTransformSpace')}>
          <button onClick={toggleTransformSpace} className={styles.toolButton}>
            <LanguageIcon fontSize="small" />
          </button>
        </InfoTooltip>
        <SelectInput
          key={transformSpace.value}
          className={styles.selectInput}
          onChange={setTransformSpace}
          options={transformSpaceOptions}
          value={transformSpace.value}
          creatable={false}
          isSearchable={false}
        />
      </div>
    </InfoTooltip>
  )
}

export default TransformSpaceTool
