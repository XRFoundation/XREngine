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

import {
  FILES_PAGE_LIMIT,
  FileBrowserService,
  FileBrowserState
} from '@etherealengine/client-core/src/common/services/FileBrowserService'
import { NotificationService } from '@etherealengine/client-core/src/common/services/NotificationService'
import { uploadToFeathersService } from '@etherealengine/client-core/src/util/upload'
import config from '@etherealengine/common/src/config'
import { archiverPath, fileBrowserUploadPath, staticResourcePath } from '@etherealengine/common/src/schema.type.module'
import { CommonKnownContentTypes } from '@etherealengine/common/src/utils/CommonKnownContentTypes'
import { processFileName } from '@etherealengine/common/src/utils/processFileName'
import { Engine } from '@etherealengine/ecs'
import { AssetSelectionChangePropsType } from '@etherealengine/editor/src/components/assets/AssetsPreviewPanel'
import {
  FilesViewModeSettings,
  FilesViewModeState
} from '@etherealengine/editor/src/components/assets/FileBrowser/FileBrowserState'
import { FileDataType } from '@etherealengine/editor/src/components/assets/FileBrowser/FileDataType'
import { DndWrapper } from '@etherealengine/editor/src/components/dnd/DndWrapper'
import { SupportedFileTypes } from '@etherealengine/editor/src/constants/AssetTypes'
import { downloadBlobAsZip, inputFileWithAddToScene } from '@etherealengine/editor/src/functions/assetFunctions'
import { bytesToSize, unique } from '@etherealengine/editor/src/functions/utils'
import { EditorState } from '@etherealengine/editor/src/services/EditorServices'
import { AssetLoader } from '@etherealengine/engine/src/assets/classes/AssetLoader'
import {
  ImageConvertDefaultParms,
  ImageConvertParms
} from '@etherealengine/engine/src/assets/constants/ImageConvertParms'
import { NO_PROXY, getMutableState, useHookstate } from '@etherealengine/hyperflux'
import { useFind } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import React, { useEffect, useRef } from 'react'
import { useDrop } from 'react-dnd'
import { useTranslation } from 'react-i18next'
import { FaList } from 'react-icons/fa'
import { FiDownload, FiGrid, FiRefreshCcw } from 'react-icons/fi'
import { HiOutlinePlusCircle } from 'react-icons/hi'
import { HiMagnifyingGlass } from 'react-icons/hi2'
import { IoArrowBack, IoSettingsSharp } from 'react-icons/io5'
import { PiFolderPlusBold } from 'react-icons/pi'
import { twMerge } from 'tailwind-merge'
import Button from '../../../../../primitives/tailwind/Button'
import Input from '../../../../../primitives/tailwind/Input'
import LoadingView from '../../../../../primitives/tailwind/LoadingView'
import Tooltip from '../../../../../primitives/tailwind/Tooltip'
import { FileBrowserItem, FileTableWrapper, canDropItemOverFolder } from '../browserGrid'

type FileBrowserContentPanelProps = {
  onSelectionChanged: (assetSelectionChange: AssetSelectionChangePropsType) => void
  disableDnD?: boolean
  selectedFile?: string
  folderName?: string
  nestingDirectory?: string
}

type DnDFileType = {
  dataTransfer: DataTransfer
  files: File[]
  items: DataTransferItemList
}

export type FileType = {
  fullName: string
  isFolder: boolean
  key: string
  name: string
  path: string
  size: string
  type: string
  url: string
}

const fileConsistsOfContentType = function (file: FileType, contentType: string): boolean {
  if (file.isFolder) {
    return contentType.startsWith('image')
  } else {
    const guessedType: string = CommonKnownContentTypes[file.type]
    return guessedType?.startsWith(contentType)
  }
}

export function isFileDataType(value: any): value is FileDataType {
  return value && value.key
}

/**
 * FileBrowserPanel used to render view for AssetsPanel.
 */
const FileBrowserContentPanel: React.FC<FileBrowserContentPanelProps> = (props) => {
  const { t } = useTranslation()

  const originalPath = `/${props.folderName || 'projects'}/${props.selectedFile ? props.selectedFile + '/' : ''}`
  const selectedDirectory = useHookstate(originalPath)
  const nestingDirectory = useHookstate(props.nestingDirectory || 'projects')
  const fileProperties = useHookstate<FileType | null>(null)
  const isLoading = useHookstate(true)

  const openProperties = useHookstate(false)
  const openCompress = useHookstate(false)
  const openConvert = useHookstate(false)
  const convertProperties = useHookstate<ImageConvertParms>(ImageConvertDefaultParms)

  const openConfirm = useHookstate(false)
  const contentToDeletePath = useHookstate('')

  const filesViewMode = useHookstate(getMutableState(FilesViewModeState).viewMode)
  const viewModeSettingsAnchorPosition = useHookstate({ left: 0, top: 0 })

  const fileState = useHookstate(getMutableState(FileBrowserState))
  const filesValue = fileState.files.value
  const { skip, total, retrieving } = fileState.value

  let page = skip / FILES_PAGE_LIMIT
  const files = fileState.files.value.map((file) => {
    const isFolder = file.type === 'folder'
    const fullName = isFolder ? file.name : file.name + '.' + file.type

    return {
      ...file,
      size: file.size ? bytesToSize(file.size) : '0',
      path: isFolder ? file.key.split(file.name)[0] : file.key.split(fullName)[0],
      fullName,
      isFolder
    }
  })

  useEffect(() => {
    if (filesValue) {
      isLoading.set(false)
    }
  }, [filesValue])

  useEffect(() => {
    refreshDirectory()
  }, [selectedDirectory])

  const refreshDirectory = async () => {
    await FileBrowserService.fetchFiles(selectedDirectory.value, page)
  }

  const changeDirectoryByPath = (path: string) => {
    selectedDirectory.set(path)
    FileBrowserService.resetSkip()
  }

  const onSelect = (params: FileDataType) => {
    if (params.type !== 'folder') {
      props.onSelectionChanged({
        resourceUrl: params.url,
        name: params.name,
        contentType: params.type,
        size: params.size
      })
    } else {
      const newPath = `${selectedDirectory.value}${params.name}/`
      changeDirectoryByPath(newPath)
    }
  }

  const handlePageChange = async (_event, newPage: number) => {
    await FileBrowserService.fetchFiles(selectedDirectory.value, newPage)
  }

  const createNewFolder = async () => {
    await FileBrowserService.addNewFolder(`${selectedDirectory.value}New_Folder`)
    page = 0 // more efficient than requesting the files again
    await refreshDirectory()
  }

  const dropItemsOnPanel = async (data: FileDataType | DnDFileType, dropOn?: FileDataType) => {
    if (isLoading.value) return

    const path = dropOn?.isFolder ? dropOn.key : selectedDirectory.value

    if (isFileDataType(data)) {
      if (dropOn?.isFolder) {
        moveContent(data.fullName, data.fullName, data.path, path, false)
      }
    } else {
      isLoading.set(true)
      await Promise.all(
        data.files.map(async (file) => {
          const assetType = !file.type ? AssetLoader.getAssetType(file.name) : file.type
          if (!assetType) {
            // file is directory
            await FileBrowserService.addNewFolder(`${path}${file.name}`)
          } else {
            try {
              const name = processFileName(file.name)
              await uploadToFeathersService(fileBrowserUploadPath, [file], {
                fileName: name,
                path,
                contentType: file.type
              }).promise
            } catch (err) {
              NotificationService.dispatchNotify(err.message, { variant: 'error' })
            }
          }
        })
      )
    }

    await refreshDirectory()
  }

  const onBackDirectory = () => {
    const pattern = /([^/]+)/g
    const result = selectedDirectory.value.match(pattern)
    if (!result || result.length === 1) return
    let newPath = '/'
    for (let i = 0; i < result.length - 1; i++) {
      newPath += result[i] + '/'
    }
    changeDirectoryByPath(newPath)
  }

  const moveContent = async (
    oldName: string,
    newName: string,
    oldPath: string,
    newPath: string,
    isCopy = false
  ): Promise<void> => {
    if (isLoading.value) return
    isLoading.set(true)
    await FileBrowserService.moveContent(oldName, newName, oldPath, newPath, isCopy)
    await refreshDirectory()
  }

  const handleConfirmDelete = (contentPath: string, type: string) => {
    contentToDeletePath.set(contentPath)

    openConfirm.set(true)
  }

  const handleConfirmClose = () => {
    contentToDeletePath.set('')

    openConfirm.set(false)
  }

  const deleteContent = async (): Promise<void> => {
    if (isLoading.value) return
    isLoading.set(true)
    openConfirm.set(false)
    await FileBrowserService.deleteContent(contentToDeletePath.value)
    props.onSelectionChanged({ resourceUrl: '', name: '', contentType: '', size: '' })
    await refreshDirectory()
  }

  const currentContentRef = useRef(null! as { item: FileDataType; isCopy: boolean })

  const showUploadAndDownloadButtons =
    selectedDirectory.value.slice(1).startsWith('projects/') &&
    !['projects', 'projects/'].includes(selectedDirectory.value.slice(1))
  const showBackButton = selectedDirectory.value !== originalPath

  const handleDownloadProject = async () => {
    const url = selectedDirectory.value
    const data = await Engine.instance.api
      .service(archiverPath)
      .get(null, { query: { directory: url } })
      .catch((err: Error) => {
        NotificationService.dispatchNotify(err.message, { variant: 'warning' })
        return null
      })
    if (!data) return
    const blob = await (await fetch(`${config.client.fileServer}/${data}`)).blob()

    let fileName: string
    if (selectedDirectory.value[selectedDirectory.value.length - 1] === '/') {
      fileName = selectedDirectory.value.split('/').at(-2) as string
    } else {
      fileName = selectedDirectory.value.split('/').at(-1) as string
    }

    downloadBlobAsZip(blob, fileName)
  }

  const BreadcrumbItems = () => {
    const handleBreadcrumbDirectoryClick = (targetFolder: string) => {
      const pattern = /([^/]+)/g
      const result = selectedDirectory.value.match(pattern)
      if (!result) return
      let newPath = '/'
      for (const folder of result) {
        newPath += folder + '/'
        if (folder === targetFolder) {
          break
        }
      }
      changeDirectoryByPath(newPath)
    }
    let breadcrumbDirectoryFiles = selectedDirectory.value.slice(1, -1).split('/')

    const nestedIndex = breadcrumbDirectoryFiles.indexOf(nestingDirectory.value)

    breadcrumbDirectoryFiles = breadcrumbDirectoryFiles.filter((_, idx) => idx >= nestedIndex)
    /*
    return (
      <Breadcrumbs
        maxItems={3}
        classes={{ separator: styles.separator, li: styles.breadcrumb, ol: styles.breadcrumbList }}
        separator="›"
      >
        {breadcrumbDirectoryFiles.map((file, index, arr) =>
          arr.length - 1 == index ? (
            <Typography key={file} style={{ fontSize: '0.9rem' }}>
              {file}
            </Typography>
          ) : (
            <Link
              underline="hover"
              key={file}
              color="#5d646c"
              style={{ fontSize: '0.9rem' }}
              onClick={() => handleBreadcrumbDirectoryClick(file)}
            >
              {file}
            </Link>
          )
        )}
      </Breadcrumbs>
    )*/

    return (
      <nav className="flex" aria-label="Breadcrumb">
        <ol className="bg-theme-primary flex items-center space-x-2 rounded-md px-4 py-2 shadow">
          {breadcrumbDirectoryFiles.map((file, index, arr) => (
            <li key={file} className="flex items-center">
              {index !== 0 && ( // Add separator for all but the first item
                <span className="text-sm text-gray-500">{'>'}</span>
              )}
              {index === arr.length - 1 ? (
                <span className="text-sm text-gray-700">{file}</span>
              ) : (
                <button
                  className="text-sm text-gray-500 hover:text-gray-700 focus:underline focus:outline-none"
                  onClick={() => handleBreadcrumbDirectoryClick(file)}
                >
                  {file}
                </button>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }

  const searchText = useHookstate('')
  const validFiles = useHookstate<typeof files>([])

  useEffect(() => {
    validFiles.set(files.filter((file) => file.fullName.toLowerCase().includes(searchText.value.toLowerCase())))
  }, [searchText.value, fileState.files])

  const projectName = useHookstate(getMutableState(EditorState).projectName)

  const makeAllThumbnails = async () => {
    await FileBrowserService.fetchAllFiles(`/projects/${projectName.value}`)
  }

  const DropArea = () => {
    const [{ isFileDropOver }, fileDropRef] = useDrop({
      accept: [...SupportedFileTypes],
      canDrop: (item: Record<string, unknown>) => 'key' in item || canDropItemOverFolder(selectedDirectory.value),
      drop: (dropItem) => dropItemsOnPanel(dropItem as any),
      collect: (monitor) => ({ isFileDropOver: monitor.canDrop() && monitor.isOver() })
    })

    const isListView = filesViewMode.value === 'list'
    const staticResourceData = useFind(staticResourcePath, {
      query: {
        key: {
          $in: isListView ? validFiles.value.map((file) => file.key) : []
        },
        $select: ['key', 'updatedAt'] as any,
        $limit: FILES_PAGE_LIMIT
      }
    })
    const staticResourceModifiedDates = useHookstate<Record<string, string>>({})

    useEffect(() => {
      const modifiedDates: Record<string, string> = {}
      staticResourceData.data.forEach((data) => {
        modifiedDates[data.key] = new Date(data.updatedAt).toLocaleString()
      })
      staticResourceModifiedDates.set(modifiedDates)
    }, [staticResourceData.data])

    return (
      <div
        ref={fileDropRef}
        className={twMerge('px-4 ', isListView ? '' : 'flex py-8')}
        style={{ border: isFileDropOver ? '3px solid #ccc' : '' }}
      >
        <div className={isListView ? '' : 'flex flex-wrap justify-start gap-3 pb-8'}>
          <FileTableWrapper wrap={isListView}>
            <>
              {unique(validFiles.get(NO_PROXY) as typeof files, (file) => file.key).map((file, i) => (
                <FileBrowserItem
                  key={file.key}
                  item={file}
                  disableDnD={props.disableDnD}
                  onClick={onSelect}
                  moveContent={moveContent}
                  deleteContent={handleConfirmDelete}
                  currentContent={currentContentRef}
                  setOpenPropertiesModal={openProperties.set}
                  setFileProperties={fileProperties.set}
                  setOpenCompress={openCompress.set}
                  setOpenConvert={openConvert.set}
                  dropItemsOnPanel={dropItemsOnPanel}
                  isFilesLoading={isLoading}
                  addFolder={createNewFolder}
                  refreshDirectory={refreshDirectory}
                  isListView={isListView}
                  staticResourceModifiedDates={staticResourceModifiedDates.value}
                />
              ))}
            </>
          </FileTableWrapper>
          {/*   
            {total > 0 && validFiles.value.length < total && (
            <TablePagination
              className={styles.pagination}
              component="div"
              count={total}
              page={page}
              rowsPerPage={FILES_PAGE_LIMIT}
              rowsPerPageOptions={[]}
              onPageChange={handlePageChange}
            />
          )}*/}
        </div>
      </div>
    )
  }

  const ViewModeSettings = () => {
    const viewModeSettings = useHookstate(getMutableState(FilesViewModeSettings))
    return (
      <>
        <div id="viewSettings" className="bg-theme-surfaceInput flex items-center">
          <Tooltip title={t('editor:layout.filebrowser.view-mode.settings.name')} direction="bottom">
            <Button
              variant="transparent"
              startIcon={<IoSettingsSharp />}
              className="p-0"
              onClick={(event) => viewModeSettingsAnchorPosition.set({ left: event.clientX, top: event.clientY })}
            />
          </Tooltip>
        </div>
        {/*
        <Popover
          anchorPosition={viewModeSettingsAnchorPosition.get(NO_PROXY)}
          open={!!viewModeSettingsAnchorPosition.left.value}
          onClose={() => viewModeSettingsAnchorPosition.set({ left: 0, top: 0 })} 
          anchorEl={null}>
          <div className={styles.viewModeSettings}>
            <div className = "flex flex-col w-40">
              {filesViewMode.value === 'icons' ? (

                <Slider
                  min={10}
                  max={100}
                  step={.5}
                  value={viewModeSettings.icons.iconSize.value}
                  onChange={viewModeSettings.icons.iconSize.set}
                  onRelease={viewModeSettings.icons.iconSize.set}    // label={t('editor:layout.filebrowser.view-mode.settings.iconSize')}             
                />
              ) : (
                <>
                <Slider
                  min={10}
                  max={100}
                  step={.5}
                  value={viewModeSettings.list.fontSize.value}
                  onChange={viewModeSettings.list.fontSize.set} 
                  onRelease={viewModeSettings.list.fontSize.set} //label={t('editor:layout.filebrowser.view-mode.settings.fontSize')}             
                  />
                  <div>
                    <div className="mt-1">
                      <label>{t('editor:layout.filebrowser.view-mode.settings.select-listColumns')}</label>
                    </div>
                    <div className="flex-col">
                      {availableTableColumns.map((column) => (  
                        <Checkbox
                          style={{ color: 'var(--textColor)' }}
                          checked={viewModeSettings.list.selectedTableColumns[column].value}
                          onChange={(_, checked) => viewModeSettings.list.selectedTableColumns[column].set(checked)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className = "flex flex-col w-40">
            <Button onClick={() => makeAllThumbnails()}>
              Generate thumbnails
            </Button>
          </div>
        </Popover>*/}
      </>
    )
  }

  const viewModes = [
    { mode: 'list', icon: <FaList /> },
    { mode: 'icons', icon: <FiGrid /> }
  ]

  return (
    <>
      <div className="mb-1 ml-1 flex items-center gap-2">
        {showBackButton && (
          <div id="backDir" className="bg-theme-surfaceInput flex items-center">
            <Tooltip title={t('editor:layout.filebrowser.back')} direction="bottom">
              <Button variant="transparent" startIcon={<IoArrowBack />} className="p-0" onClick={onBackDirectory} />
            </Tooltip>
          </div>
        )}

        <div id="refreshDir" className="bg-theme-surfaceInput flex items-center">
          <Tooltip title={t('editor:layout.filebrowser.refresh')} direction="bottom">
            <Button variant="transparent" startIcon={<FiRefreshCcw />} className="p-0" onClick={refreshDirectory} />
          </Tooltip>
        </div>

        <ViewModeSettings />

        <div className="w-30 bg-theme-surfaceInput flex h-7 flex-row items-center gap-1 rounded px-2 py-1">
          {viewModes.map(({ mode, icon }) => (
            <Button
              key={mode}
              variant="transparent"
              startIcon={icon}
              className={`p-0 ${filesViewMode.value !== mode ? 'opacity-50' : ''}`}
              onClick={() => filesViewMode.set(mode as 'icons' | 'list')}
            />
          ))}
        </div>

        <BreadcrumbItems />

        <Input
          placeholder={t('editor:layout.filebrowser.search-placeholder')}
          value={searchText.value}
          onChange={(e) => {
            searchText.set(e.target.value)
          }}
          className="bg-theme-primary rounded"
          startComponent={<HiMagnifyingGlass />}
        />

        <div id="newFolder" className="bg-theme-surfaceInput flex items-center">
          <Tooltip title={t('editor:layout.filebrowser.addNewFolder')} direction="bottom">
            <Button variant="transparent" startIcon={<FiDownload />} className="p-0" onClick={createNewFolder} />
          </Tooltip>
        </div>

        <div id="downloadProject" className="bg-theme-surfaceInput flex items-center">
          <Tooltip title={t('editor:layout.filebrowser.downloadProject')} direction="bottom">
            <Button
              variant="transparent"
              startIcon={<PiFolderPlusBold />}
              className="p-0"
              onClick={handleDownloadProject}
            />
          </Tooltip>
        </div>

        {showUploadAndDownloadButtons && (
          <Button
            id="uploadAsset"
            startIcon={<HiOutlinePlusCircle />}
            variant="transparent"
            rounded="none"
            className="bg-theme-highlight ml-auto w-32 px-2"
            size="small"
            textContainerClassName="mx-0"
            onClick={async () => {
              await inputFileWithAddToScene({ directoryPath: selectedDirectory.value })
                .then(refreshDirectory)
                .catch((err) => {
                  NotificationService.dispatchNotify(err.message, { variant: 'error' })
                })
            }}
          >
            {t('editor:layout.filebrowser.uploadAsset')}
          </Button>
        )}
      </div>
      {retrieving && <LoadingView title={t('editor:layout.filebrowser.loadingFiles')} />}
      <div id="file-browser-panel" style={{ overflowY: 'auto', height: '100%' }}>
        <DndWrapper id="file-browser-panel">
          <DropArea />
        </DndWrapper>
      </div>
    </>
  )
}

export default function FilesPanelContainer() {
  const assetsPreviewPanelRef = React.useRef()
  const projectName = useHookstate(getMutableState(EditorState).projectName).value

  const onSelectionChanged = (props: AssetSelectionChangePropsType) => {
    ;(assetsPreviewPanelRef as any).current?.onSelectionChanged?.(props)
  }

  return (
    <>
      <FileBrowserContentPanel selectedFile={projectName ?? undefined} onSelectionChanged={onSelectionChanged} />
    </>
  )
}

/*<div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        color: 'var(--textColor)',
        fontFamily: 'var(--lato)',
        fontSize: '12px'
      }}
    >
      <Header />
      <div className={styles.searchContainer}>
        <StringInput
          placeholder={t('editor:layout.filebrowser.search-placeholder')}
          value={searchText.value}
          onChange={searchText.set}
        />
      </div>
      {retrieving && (
        <LoadingView className={styles.filesLoading} title={t('editor:layout.filebrowser.loadingFiles')} />
      )}
      <div id="file-browser-panel" style={{ overflowY: 'auto', height: '100%' }}>
        <DndWrapper id="file-browser-panel">
          <DropArea />
        </DndWrapper>
      </div>

      {openConvert.value && fileProperties.value && (
        <ImageConvertPanel
          openConvert={openConvert}
          fileProperties={fileProperties}
          convertProperties={convertProperties}
          onRefreshDirectory={refreshDirectory}
        />
      )}

      {openCompress.value && fileProperties.value && fileConsistsOfContentType(fileProperties.value, 'model') && (
        <ModelCompressionPanel
          openCompress={openCompress}
          fileProperties={fileProperties as any}
          onRefreshDirectory={refreshDirectory}
        />
      )}

      {openCompress.value && fileProperties.value && fileConsistsOfContentType(fileProperties.value, 'image') && (
        <ImageCompressionPanel
          openCompress={openCompress}
          fileProperties={fileProperties as any}
          onRefreshDirectory={refreshDirectory}
        />
      )}

      {openProperties.value && fileProperties.value && (
        <FilePropertiesPanel openProperties={openProperties} fileProperties={fileProperties} />
      )}
      <ConfirmDialog
        open={openConfirm.value}
        description={t('editor:dialog.delete.confirm-content', {
          content: contentToDeletePath.value.split('/').at(-1)
        })}
        onClose={handleConfirmClose}
        onSubmit={deleteContent}
      />
      </div>*/
