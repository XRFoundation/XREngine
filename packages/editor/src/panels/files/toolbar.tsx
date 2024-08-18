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
import { NO_PROXY, useMutableState } from '@etherealengine/hyperflux'
import BooleanInput from '@etherealengine/ui/src/components/editor/input/Boolean'
import InputGroup from '@etherealengine/ui/src/components/editor/input/Group'
import { Popup } from '@etherealengine/ui/src/components/tailwind/Popup'
import Button from '@etherealengine/ui/src/primitives/tailwind/Button'
import Input from '@etherealengine/ui/src/primitives/tailwind/Input'
import Slider from '@etherealengine/ui/src/primitives/tailwind/Slider'
import Tooltip from '@etherealengine/ui/src/primitives/tailwind/Tooltip'
import React, { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { FaList } from 'react-icons/fa'
import { FiDownload, FiGrid, FiRefreshCcw } from 'react-icons/fi'
import { HiOutlineFolder, HiOutlinePlusCircle } from 'react-icons/hi'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { IoArrowBack, IoSettingsSharp } from 'react-icons/io5'
import { PiFolderPlusBold } from 'react-icons/pi'
import { inputFileWithAddToScene } from '../../functions/assetFunctions'
import { EditorState } from '../../services/EditorServices'
import {
  FilesState,
  FilesViewModeSettings,
  FilesViewModeState,
  availableTableColumns,
  useFilesQuery
} from '../../services/FilesState'
import { handleDownloadProject } from './download'

const VIEW_MODES = [
  { mode: 'list', icon: <FaList /> },
  { mode: 'icons', icon: <FiGrid /> }
]

function extractDirectoryWithoutOrgName(directory: string, orgName: string) {
  if (!orgName) return directory
  return directory.replace(`projects/${orgName}`, 'projects/')
}

function BreadcrumbItems() {
  const filesState = useMutableState(FilesState)
  const { onChangeDirectoryByPath } = useFilesQuery()

  const handleBreadcrumbDirectoryClick = (targetFolder: string) => {
    if (filesState.orgName.value && targetFolder === 'projects') return
    const pattern = /([^/]+)/g
    const result = filesState.selectedDirectory.value.match(pattern)
    if (!result) return
    let newPath = '/'
    for (const folder of result) {
      newPath += folder + '/'
      if (folder === targetFolder) {
        break
      }
    }
    onChangeDirectoryByPath(newPath)
  }

  let breadcrumbDirectoryFiles = extractDirectoryWithoutOrgName(
    filesState.selectedDirectory.value,
    filesState.orgName.value
  )
    .slice(1, -1)
    .split('/')

  const nestedIndex = breadcrumbDirectoryFiles.indexOf('projects')

  breadcrumbDirectoryFiles = breadcrumbDirectoryFiles.filter((_, idx) => idx >= nestedIndex)

  return (
    <div className="flex h-[28px] w-96 items-center gap-1 rounded-lg border border-theme-input bg-[#141619] px-2 ">
      <HiOutlineFolder className="text-sm text-[#A3A3A3]" />
      {breadcrumbDirectoryFiles.map((file, index, arr) => (
        <Fragment key={index}>
          {index !== 0 && <span className="cursor-default items-center text-sm text-[#A3A3A3]"> {'>'} </span>}
          {index === arr.length - 1 || (filesState.orgName.value && index === 0) ? (
            <span className="cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-[#A3A3A3] hover:underline">
              {file}
            </span>
          ) : (
            <a
              className="inline-flex cursor-pointer items-center overflow-hidden text-sm text-[#A3A3A3] hover:text-theme-highlight hover:underline focus:text-theme-highlight"
              onClick={() => handleBreadcrumbDirectoryClick(file)}
            >
              <span className="cursor-pointer overflow-hidden overflow-ellipsis whitespace-nowrap text-xs text-[#A3A3A3] hover:underline">
                {file}
              </span>
            </a>
          )}
        </Fragment>
      ))}
    </div>
  )
}

const ViewModeSettings = () => {
  const { t } = useTranslation()
  const viewModeSettings = useMutableState(FilesViewModeSettings)
  const filesViewMode = useMutableState(FilesViewModeState).viewMode

  return (
    <Popup
      contentStyle={{ background: '#15171b', border: 'solid', borderColor: '#5d646c' }}
      position={'bottom left'}
      trigger={
        <Tooltip content={t('editor:layout.filebrowser.view-mode.settings.name')}>
          <Button startIcon={<IoSettingsSharp />} className="h-7 w-7 rounded-lg bg-[#2F3137] p-0" />
        </Tooltip>
      }
    >
      {filesViewMode.value === 'icons' ? (
        <InputGroup label={t('editor:layout.filebrowser.view-mode.settings.iconSize')}>
          <Slider
            min={10}
            max={100}
            step={0.5}
            value={viewModeSettings.icons.iconSize.value}
            onChange={viewModeSettings.icons.iconSize.set}
            onRelease={viewModeSettings.icons.iconSize.set}
          />
        </InputGroup>
      ) : (
        <>
          <InputGroup label={t('editor:layout.filebrowser.view-mode.settings.fontSize')}>
            <Slider
              min={10}
              max={100}
              step={0.5}
              value={viewModeSettings.list.fontSize.value}
              onChange={viewModeSettings.list.fontSize.set}
              onRelease={viewModeSettings.list.fontSize.set}
            />
          </InputGroup>

          <div>
            <div className="mt-1 flex flex-auto text-white">
              <label>{t('editor:layout.filebrowser.view-mode.settings.select-listColumns')}</label>
            </div>
            <div className="flex-col">
              {availableTableColumns.map((column) => (
                <InputGroup label={t(`editor:layout.filebrowser.table-list.headers.${column}`)}>
                  <BooleanInput
                    value={viewModeSettings.list.selectedTableColumns[column].value}
                    onChange={(value) => viewModeSettings.list.selectedTableColumns[column].set(value)}
                  />
                </InputGroup>
              ))}
            </div>
          </div>
        </>
      )}
    </Popup>
  )
}

export default function FilesToolbar() {
  const { t } = useTranslation()
  const filesState = useMutableState(FilesState)

  const originalPath = useMutableState(EditorState).projectName.value
  const filesViewMode = useMutableState(FilesViewModeState).viewMode

  const showBackButton = filesState.selectedDirectory.value.split('/').length > (originalPath?.split('/').length || 0)
  const showDownloadButtons = filesState.selectedDirectory.value.startsWith(
    '/projects/' + filesState.projectName.value + '/'
  )
  const showUploadButtons =
    filesState.selectedDirectory.value.startsWith('/projects/' + filesState.projectName.value + '/public/') ||
    filesState.selectedDirectory.value.startsWith('/projects/' + filesState.projectName.value + '/assets/')

  const { onBackDirectory, onRefreshDirectory, onCreateNewFolder } = useFilesQuery()

  return (
    <div className="mb-1 flex h-9 items-center gap-2 bg-theme-surface-main">
      <div className="ml-2" />
      {showBackButton && (
        <div id="backDir" className={`pointer-events-auto flex h-7 w-7 items-center rounded-lg bg-[#2F3137]`}>
          <Tooltip content={t('editor:layout.filebrowser.back')} className="left-1">
            <Button variant="transparent" startIcon={<IoArrowBack />} className={`p-0`} onClick={onBackDirectory} />
          </Tooltip>
        </div>
      )}

      <div id="refreshDir" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
        <Tooltip content={t('editor:layout.filebrowser.refresh')}>
          <Button variant="transparent" startIcon={<FiRefreshCcw />} className="p-0" onClick={onRefreshDirectory} />
        </Tooltip>
      </div>

      <ViewModeSettings />

      <div className="w-30 flex h-7 flex-row items-center gap-1 rounded-lg bg-[#2F3137] px-2 py-1 ">
        {VIEW_MODES.map(({ mode, icon }) => (
          <Button
            key={mode}
            variant="transparent"
            startIcon={icon}
            className={`p-0 ${filesViewMode.value !== mode ? 'opacity-50' : ''}`}
            onClick={() => filesViewMode.set(mode as 'icons' | 'list')}
          />
        ))}
      </div>

      <div className="align-center flex h-7 w-full justify-center gap-2 sm:px-2 md:px-4 lg:px-6 xl:px-10">
        <BreadcrumbItems />
        <Input
          placeholder={t('editor:layout.filebrowser.search-placeholder')}
          value={filesState.searchText.value}
          onChange={(e) => {
            filesState.searchText.set(e.target.value)
          }}
          labelClassname="text-sm text-red-500"
          containerClassname="flex h-full w-auto"
          className="h-7 rounded-lg border border-theme-input bg-[#141619] px-2 py-0 text-xs text-[#A3A3A3] placeholder:text-[#A3A3A3] focus-visible:ring-0"
          startComponent={<HiMagnifyingGlass className="h-[14px] w-[14px] text-[#A3A3A3]" />}
        />
      </div>

      <div id="downloadProject" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
        <Tooltip content={t('editor:layout.filebrowser.downloadProject')}>
          <Button
            variant="transparent"
            startIcon={<FiDownload />}
            className="p-0"
            onClick={() => handleDownloadProject(filesState.projectName.value, filesState.selectedDirectory.value)}
            disabled={!showDownloadButtons}
          />
        </Tooltip>
      </div>

      <div id="newFolder" className="flex h-7 w-7 items-center rounded-lg bg-[#2F3137]">
        <Tooltip content={t('editor:layout.filebrowser.addNewFolder')}>
          <Button variant="transparent" startIcon={<PiFolderPlusBold />} className="p-0" onClick={onCreateNewFolder} />
        </Tooltip>
      </div>

      <Button
        id="uploadFiles"
        startIcon={<HiOutlinePlusCircle />}
        disabled={!showUploadButtons}
        rounded="none"
        className="h-full whitespace-nowrap bg-theme-highlight px-2"
        size="small"
        onClick={() =>
          inputFileWithAddToScene({
            projectName: filesState.projectName.value,
            directoryPath: filesState.selectedDirectory.get(NO_PROXY).slice(1)
          })
            .then(() => onRefreshDirectory())
            .catch((err) => {
              NotificationService.dispatchNotify(err.message, { variant: 'error' })
            })
        }
      >
        {t('editor:layout.filebrowser.uploadFiles')}
      </Button>
      <Button
        id="uploadFiles"
        startIcon={<HiOutlinePlusCircle />}
        disabled={!showUploadButtons}
        rounded="none"
        className="h-full whitespace-nowrap bg-theme-highlight px-2"
        size="small"
        onClick={() =>
          inputFileWithAddToScene({
            projectName: filesState.projectName.value,
            directoryPath: filesState.selectedDirectory.get(NO_PROXY).slice(1),
            preserveDirectory: true
          })
            .then(onRefreshDirectory)
            .catch((err) => {
              NotificationService.dispatchNotify(err.message, { variant: 'error' })
            })
        }
      >
        {t('editor:layout.filebrowser.uploadFolder')}
      </Button>
    </div>
  )
}
