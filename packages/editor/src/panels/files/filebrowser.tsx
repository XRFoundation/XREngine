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

import { projectPath } from '@etherealengine/common/src/schema.type.module'
import { Engine } from '@etherealengine/ecs'
import { useMutableState } from '@etherealengine/hyperflux'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorState } from '../../services/EditorServices'
import { FilesQueryProvider, FilesState } from '../../services/FilesState'
import FilesToolbar from './toolbar'

const getValidProjectForFileBrowser = async (path: string) => {
  const [orgName, projectName] = path.split('/').slice(2, 4)
  const projects = await Engine.instance.api.service(projectPath).find({
    query: {
      $or: [
        {
          name: `${orgName}/${projectName}`
        },
        {
          name: orgName
        }
      ],
      action: 'studio',
      allowed: true
    }
  })
  return (
    projects.data.find((project) => project.name === orgName || project.name === `${orgName}/${projectName}`)?.name ??
    ''
  )
}

export default function FileBrowser() {
  const { t } = useTranslation()
  const filesState = useMutableState(FilesState)

  const originalPath = useMutableState(EditorState).projectName.value
  useEffect(() => {
    if (originalPath) filesState.selectedDirectory.set(originalPath)
  }, [originalPath])

  useEffect(() => {
    ;(async () => {
      const projectName = await getValidProjectForFileBrowser(filesState.selectedDirectory.value)
      const orgName = projectName.includes('/') ? projectName.split('/')[0] : ''
      filesState.merge({ projectName, orgName })
    })()
  }, [filesState.selectedDirectory])

  return (
    <FilesQueryProvider>
      <FilesToolbar />
    </FilesQueryProvider>
  )
}
