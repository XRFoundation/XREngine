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

import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { API } from '@etherealengine/common'
import config from '@etherealengine/common/src/config'
import { archiverPath } from '@etherealengine/common/src/schema.type.module'
import { bytesToSize } from '@etherealengine/common/src/utils/btyesToSize'
import { downloadBlobAsZip } from '@etherealengine/editor/src/functions/assetFunctions'
import { defineState, getMutableState, useMutableState } from '@etherealengine/hyperflux'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Progress from '../../../../../primitives/tailwind/Progress'

const DownloadProjectState = defineState({
  name: 'DownloadProjectState',
  initial: () => ({
    total: 0,
    progress: 0,
    isDownloading: false
  })
})

export const handleDownloadProject = async (projectName: string, selectedDirectory: string) => {
  const data = await API.instance
    .service(archiverPath)
    .get(null, { query: { project: projectName } })
    .catch((err: Error) => {
      NotificationService.dispatchNotify(err.message, { variant: 'warning' })
      return null
    })
  if (!data) return

  const downloadState = getMutableState(DownloadProjectState)

  downloadState.isDownloading.set(true) // Start Download

  const response = await fetch(`${config.client.fileServer}/${data}`)
  const totalBytes = parseInt(response.headers.get('Content-Length') || '0', 10)
  downloadState.total.set(totalBytes) // Set the total bytes

  const reader = response.body?.getReader()
  const chunks: Uint8Array[] = []
  let bytesReceived = 0

  while (true) {
    const { done, value } = await reader!.read()
    if (done) break
    chunks.push(value)
    bytesReceived += value.length
    downloadState.progress.set(bytesReceived)
  }

  const blob = new Blob(chunks)
  downloadState.isDownloading.set(false) // Mark as completed
  downloadState.progress.set(0)
  downloadState.total.set(0)

  let fileName: string
  if (selectedDirectory.at(-1) === '/') {
    fileName = selectedDirectory.split('/').at(-2) as string
  } else {
    fileName = selectedDirectory.split('/').at(-1) as string
  }

  downloadBlobAsZip(blob, fileName)
}

export const ProjectDownloadProgress = () => {
  const { t } = useTranslation()
  const downloadState = useMutableState(DownloadProjectState)
  const isDownloading = downloadState.isDownloading.value
  const completed = bytesToSize(downloadState.progress.value)
  const total = bytesToSize(downloadState.total.value)
  const progress = (downloadState.progress.value / downloadState.total.value) * 100

  return isDownloading ? (
    <div className="flex h-auto w-full justify-center pb-2 pt-2">
      <div className="flex w-1/2">
        <span className="inline-block pr-2 text-xs font-normal leading-none text-theme-primary">
          {t('editor:layout.filebrowser.downloadingProject', { completed, total })}
        </span>
        <div className="basis-1/2">
          <Progress value={progress} />
        </div>
      </div>
    </div>
  ) : null
}
