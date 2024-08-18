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

/**
 * This is a modified version of figbird. https://humaans.github.io/figbird/
 * It now runs on hookstate instead of redux, and has been modified to work with
 */

/**
 * API:
 * useFind(serviceName, options) => { data, status, refetch, isFetching, error }
 * useGet(serviceName, id, options) => { data, status, refetch, isFetching, error }
 * useMutation(serviceName) => { create, update, patch, remove, status, data, error }
 */

import { Params, Query } from '@feathersjs/feathers'
import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react'

import { API } from '@etherealengine/common'
import { ServiceTypes } from '@etherealengine/common/declarations'
import { OpaqueType } from '@etherealengine/common/src/interfaces/OpaqueType'
import { defineState, getState, NO_PROXY, State, useHookstate, useMutableState } from '@etherealengine/hyperflux'

export type Methods = 'find' | 'get' | 'create' | 'update' | 'patch' | 'remove'

export type MethodArgs = {
  find: [Params, any?]
  get: [string, any?]
  create: [any, any?]
  update: [string, any, any?]
  patch: [string, any, any?]
  remove: [string, any?]
}

type QueryHash = OpaqueType<'QueryHash'> & string

type Paginated<T> = {
  data: T[]
  total: number
  limit: number
  skip: number
}

type ArrayOrPaginated<T> = T[] | Paginated<T>

type ArrayOrPaginatedType<T> = T extends ArrayOrPaginated<infer R> ? R[] : never

export const FeathersState = defineState({
  name: 'ee.engine.FeathersState',
  initial: () =>
    ({}) as Record<
      keyof ServiceTypes,
      Record<
        QueryHash,
        {
          fetch: () => void
          query: any
          response: unknown
          status: 'pending' | 'success' | 'error'
          error: string
        }
      >
    >,

  reactor: () => {
    const feathersState = useMutableState(FeathersState)
    return (
      <>
        {feathersState.keys.map((serviceName: keyof ServiceTypes) => (
          <FeathersChildReactor key={serviceName} serviceName={serviceName} />
        ))}
      </>
    )
  }
})

const FeathersChildReactor = (props: { serviceName: keyof ServiceTypes }) => {
  const fetch = () => {
    const feathersState = getState(FeathersState)
    for (const queryId in feathersState[props.serviceName]) {
      feathersState[props.serviceName][queryId].fetch()
    }
  }

  useRealtime(props.serviceName, fetch)

  return null
}

type Args = MethodArgs[Methods]

export const useService = <S extends keyof ServiceTypes, M extends Methods>(
  serviceName: S,
  method: M,
  ...args: Args
) => {
  const service = API.instance.service(serviceName)
  const state = useMutableState(FeathersState)

  const queryParams = {
    serviceName,
    method,
    args
  }

  const queryId = `${method.substring(0, 1)}:${hashObject(queryParams)}` as QueryHash

  const fetch = () => {
    if (method === 'get' && !args) {
      state[serviceName][queryId].merge({
        status: 'error',
        error: 'Get method requires an id or query object'
      })
      return
    }
    state[serviceName][queryId].merge({
      status: 'pending',
      error: ''
    })
    return service[method](...args)
      .then((res) => {
        state[serviceName][queryId].merge({
          response: res,
          status: 'success',
          error: ''
        })
      })
      .catch((error) => {
        console.error(`Error in service: ${serviceName}, method: ${method}, args: ${JSON.stringify(args)}`, error)
        state[serviceName][queryId].merge({
          status: 'error',
          error: error.message
        })
      })
  }

  useLayoutEffect(() => {
    if (!state.get(NO_PROXY)[serviceName]) state[serviceName].set({})
    if (!state.get(NO_PROXY)[serviceName][queryId]) {
      state[serviceName].merge({
        [queryId]: {
          fetch,
          query: queryParams,
          response: null,
          status: 'pending',
          error: ''
        }
      })
      fetch()
    }
  }, [serviceName, method, ...args])

  const query = state[serviceName]?.[queryId]
  const queryObj = state.get(NO_PROXY)[serviceName]?.[queryId]
  const data = queryObj?.response as Awaited<ReturnType<ServiceTypes[S][M]>> | undefined
  const error = queryObj?.error
  const status = queryObj?.status

  return useMemo(
    () => ({
      data,
      status,
      error,
      refetch: fetch
    }),
    [data, query?.response, query?.status, query?.error]
  )
}

export const useGet = <S extends keyof ServiceTypes>(serviceName: S, id: string | undefined, params: Params = {}) => {
  return useService(serviceName, 'get', id, params)
}

export type PaginationQuery = Partial<PaginationProps> & Query

export const useFind = <S extends keyof ServiceTypes>(serviceName: S, params: Params<PaginationQuery> = {}) => {
  const paginate = usePaginate(params.query)

  let requestParams
  if (params.query?.paginate === false || params.query?.$paginate === false) {
    requestParams = {
      ...params,
      query: {
        ...params.query
      }
    }
  } else {
    requestParams = {
      ...params,
      query: {
        ...params.query,
        ...paginate.query
      }
    }
  }

  const response = useService(serviceName, 'find', requestParams)

  const data = response?.data
    ? Array.isArray(response.data)
      ? response.data
      : response.data.data
      ? response.data.data
      : response.data
    : []
  const total: number = response?.data && !Array.isArray(response.data) ? response.data.total : 0

  return {
    ...response,
    total,
    setSort: paginate.setSort,
    setLimit: paginate.setLimit,
    setPage: paginate.setPage,
    search: paginate.search,
    page: paginate.page,
    skip: paginate.query.$skip,
    limit: paginate.query.$limit,
    sort: paginate.query.$sort,
    data: data as Readonly<ArrayOrPaginatedType<(typeof response)['data']>>
  }
}

const forceRefetch = (serviceName: keyof ServiceTypes) => {
  const feathersState = getState(FeathersState)
  if (!feathersState[serviceName]) return
  for (const queryId in feathersState[serviceName]) {
    feathersState[serviceName][queryId].fetch()
  }
}

const created = ({ serviceName, item }) => {
  forceRefetch(serviceName)
}

const updated = ({ serviceName, item }) => {
  forceRefetch(serviceName)
}

const removed = ({ serviceName, item }) => {
  forceRefetch(serviceName)
}

type CreateMethodParameters<S extends keyof ServiceTypes> = ServiceTypes[S]['create']
type UpdateMethodParameters<S extends keyof ServiceTypes> = ServiceTypes[S]['update']
type PatchMethodParameters<S extends keyof ServiceTypes> = ServiceTypes[S]['patch']
type RemoveMethodParameters<S extends keyof ServiceTypes> = ServiceTypes[S]['remove']

/**
 * Simple mutation hook exposing crud methods
 * of any feathers service. The resulting state
 * of calling these operations needs to be handled
 * by the caller. as you create/update/patch/remove
 * entities using this helper, the entities cache gets updated
 */
export function useMutation<S extends keyof ServiceTypes>(serviceName: S, forceRefetch = true) {
  const state = useHookstate({
    status: 'idle',
    data: null as unknown | null,
    error: null as string | null
  })

  const create = useMethod(
    'create',
    forceRefetch ? created : undefined,
    serviceName,
    state
  ) as CreateMethodParameters<S>
  const update = useMethod(
    'update',
    forceRefetch ? updated : undefined,
    serviceName,
    state
  ) as UpdateMethodParameters<S>
  const patch = useMethod('patch', forceRefetch ? updated : undefined, serviceName, state) as PatchMethodParameters<S>
  const remove = useMethod(
    'remove',
    forceRefetch ? removed : undefined,
    serviceName,
    state
  ) as RemoveMethodParameters<S>

  return useMemo(
    () => ({
      create,
      update,
      patch,
      remove,
      data: state.data.value,
      status: state.status.value,
      error: state.value.error
    }),
    [create, update, patch, remove, state]
  )
}

function useMethod(
  method: Methods,
  action: undefined | ((props: { serviceName: keyof ServiceTypes; item: any }) => void),
  serviceName: keyof ServiceTypes,
  state: State<any>
) {
  return useCallback(
    (...args) => {
      const service = API.instance.service(serviceName)
      state.merge({ status: 'loading', loading: true, data: null, error: null })
      return service[method](...args)
        .then((item) => {
          action && action({ serviceName, item })
          state.merge({ status: 'success', loading: false, data: item })
          return item
        })
        .catch((err) => {
          state.merge({ status: 'error', loading: false, error: err })
          throw err
        })
    },
    [serviceName, method, action]
  )
}

export function hashObject(obj) {
  let hash = 0
  const str = JSON.stringify(obj)

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }

  return hash
}

/**
 * An internal hook that will listen to realtime updates to a service
 * and update the cache as changes happen.
 */
export function useRealtime(
  serviceName: keyof ServiceTypes,
  refetch: (data: any, eventType: 'created' | 'updated' | 'patched' | 'removed') => void
) {
  useLayoutEffect(() => {
    const service = API.instance.service(serviceName)

    const handleCreated = (data: any) => refetch(data, 'created')
    const handleUpdated = (data: any) => refetch(data, 'updated')
    const handlePatched = (data: any) => refetch(data, 'patched')
    const handleRemoved = (data: any) => refetch(data, 'removed')

    service.on('created', handleCreated)
    service.on('updated', handleUpdated)
    service.on('patched', handlePatched)
    service.on('removed', handleRemoved)

    return () => {
      service.off('created', handleCreated)
      service.off('updated', handleUpdated)
      service.off('patched', handlePatched)
      service.off('removed', handleRemoved)
    }
  }, [serviceName])
}

export type FeathersOrder = -1 | 0 | 1

type PaginationProps = {
  $skip: number
  $limit: number
  $sort: Record<string, FeathersOrder>
}

function resetPaginationProps(defaultProps: Partial<PaginationProps>) {
  return {
    $skip: defaultProps.$skip ?? 0,
    $limit: defaultProps.$limit ?? 10,
    $sort: defaultProps.$sort ?? {}
  } as PaginationProps
}

export function usePaginate(defaultProps = {} as Partial<PaginationProps>) {
  const store = useHookstate(resetPaginationProps(defaultProps))

  const query = store.get(NO_PROXY)
  const storedPagination = useHookstate({ stored: false, query })

  const setSort = (sort: Record<string, FeathersOrder>) => {
    store.$sort.set(sort)
  }

  const setLimit = (limit: number) => {
    store.$limit.set(limit)
  }

  const setPage = (page: number) => {
    store.$skip.set(page * store.$limit.value)
  }

  const reset = () => {
    store.set(resetPaginationProps(defaultProps))
  }

  const _storePagination = () => {
    if (storedPagination.stored.value) return
    storedPagination.set({ stored: true, query: structuredClone(query) })
    reset()
  }

  const _restorePagination = () => {
    if (!storedPagination.stored.value) return
    store.set(structuredClone(storedPagination.get(NO_PROXY).query))
    storedPagination.merge({ stored: false })
  }

  const search = (searchQuery?: object) => {
    if (searchQuery) {
      _storePagination()
      store.merge(searchQuery)
    } else {
      _restorePagination()
    }
  }

  return {
    query,
    page: Math.floor(store.$skip.value / store.$limit.value),
    setSort,
    setLimit,
    setPage,
    search
  }
}

/**
 * Mutates the query object to store the pagination props, and add the search query
 */
export const useSearch = (query: ReturnType<typeof useFind>, searchQuery: object, active: any) => {
  useEffect(() => {
    if (active) {
      query.search(searchQuery)
    } else {
      query.search()
    }
  }, [active])
}
