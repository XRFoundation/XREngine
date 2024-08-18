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

import { fileBrowserPath } from '@etherealengine/common/src/schema.type.module'
import { defineState, syncStateWithLocalStorage, useMutableState } from '@etherealengine/hyperflux'
import { useFind, useMutation, useSearch } from '@etherealengine/spatial/src/common/functions/FeathersHooks'
import React, { ReactNode, createContext, useContext } from 'react'

export const FilesViewModeState = defineState({
  name: 'FilesViewModeState',
  initial: {
    viewMode: 'icons' as 'icons' | 'list'
  },
  extension: syncStateWithLocalStorage(['viewMode'])
})

export const availableTableColumns = ['name', 'type', 'dateModified', 'size'] as const

export const FilesViewModeSettings = defineState({
  name: 'FilesViewModeSettings',
  initial: {
    icons: {
      iconSize: 90
    },
    list: {
      fontSize: 15,
      selectedTableColumns: {
        name: true,
        type: true,
        dateModified: true,
        size: true
      }
    }
  },
  extension: syncStateWithLocalStorage(['icons', 'list'])
})

export const FILES_PAGE_LIMIT = 100

export const FilesState = defineState({
  name: 'FilesState',
  initial: () => ({
    selectedDirectory: '',
    projectName: '',
    orgName: '',
    searchText: ''
  })
})

const FilesQueryContext = createContext({
  filesQuery: null as null | ReturnType<typeof useFind<'file-browser'>>,
  onChangeDirectoryByPath: (_path: string) => {},
  onBackDirectory: () => {},
  onRefreshDirectory: () => {},
  onCreateNewFolder: () => {}
})

export const FilesQueryProvider = ({ children }: { children?: ReactNode }) => {
  const filesState = useMutableState(FilesState)

  const filesQuery = useFind(fileBrowserPath, {
    query: {
      $limit: FILES_PAGE_LIMIT * 100,
      directory: filesState.selectedDirectory.value
    }
  })

  useSearch(
    filesQuery,
    {
      key: {
        $like: `%${filesState.searchText.value}%`
      }
    },
    filesState.searchText.value
  )

  const onChangeDirectoryByPath = (path: string) => {
    filesState.merge({ selectedDirectory: path })
    filesQuery.setPage(0)
  }

  const onBackDirectory = () => {
    const pattern = /([^/]+)/g
    const result = filesState.selectedDirectory.value.match(pattern)
    if (!result || result.length === 1 || (filesState.orgName && result.length === 2)) return
    let newPath = '/'
    for (let i = 0; i < result.length - 1; i++) {
      newPath += result[i] + '/'
    }
    onChangeDirectoryByPath(newPath)
  }

  const onRefreshDirectory = async () => {
    await filesQuery.refetch()
  }

  const onCreateNewFolder = () => useMutation(fileBrowserPath).create(`${filesState.selectedDirectory.value}New_Folder`)

  return (
    <FilesQueryContext.Provider
      value={{ filesQuery, onChangeDirectoryByPath, onBackDirectory, onRefreshDirectory, onCreateNewFolder }}
    >
      {children}
    </FilesQueryContext.Provider>
  )
}

export const useFilesQuery = () => useContext(FilesQueryContext)
