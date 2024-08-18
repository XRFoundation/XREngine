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
 * An isomorphic logger with a built-in transport, meant to make
 * error aggregation easier on the client side.
 *
 * All log events (info, warn, error, etc) are:
 *  1. Printed to the console (likely browser console), and (optionally)
 *  2. Sent to the server-side logs-api service, where the pino logger
 *     instance (see packages/server-core/src/logger.ts) sends them to Elastic etc.
 *     Note: The sending/aggregation to Elastic only happens when APP_ENV !== 'development'.
 *
 */

import type { FeathersApplication } from '@feathersjs/feathers'
import NodeCache from 'node-cache'
import schedule from 'node-schedule'

import { ServiceTypes } from '../declarations'
import config from './config'
import { logsApiPath } from './schema.type.module'

// Initialize the cache
const engineCache = new NodeCache()

// Schedule the data push at a certain time (e.g., every hour)
schedule.scheduleJob('*/15 * * * * *', pushToEngine)

// Function to cache a string
function cacheLog(value: string): void {
  const timestamp = new Date().getTime().toString()
  engineCache.set(timestamp, value)
}

// Function to push cached strings to the server
function pushToEngine(): void {
  if (config.client.serverHost && LogConfig.api) {
    const cachedData = engineCache.keys().map((key) => {
      const cachedValue = engineCache.get<string>(key)
      if (cachedValue) {
        return cachedValue
      }
    })

    if (cachedData.length > 0) {
      try {
        LogConfig.api.service(logsApiPath).create(cachedData)

        sendToGoogleAnalytics(cachedData)
      } catch (err) {
        console.log(err)
      }

      engineCache.flushAll()
    }
  }
}

// Function to send cached data to Google Analytics
function sendToGoogleAnalytics(data: any): void {
  // Log to Google Analytics if gtag is available
  if (typeof window !== 'undefined' && window.gtag) {
    if (Array.isArray(data)) {
      data.forEach((item) => {
        if (item && window.gtag) {
          window.gtag('event', 'irengine_logs', item)
        }
      })
    } else {
      window.gtag('event', 'irengine_logs', data)
    }
  }
}

class LogConfig {
  static api: FeathersApplication<ServiceTypes> | undefined = undefined
}

export const pipeLogs = (api: FeathersApplication<ServiceTypes>) => {
  LogConfig.api = api
}

const baseComponent = 'client-core'
/**
 * No-op logger, used for unit testing (or other disabling of logger)
 */
const nullLogger = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
  fatal: console.error
}

/**
 * A logger class (similar to the one provided by Pino.js) to replace
 * console.log() usage on the client side.
 */
const multiLogger = {
  debug: console.debug.bind(console, `[${baseComponent}]`),
  info: console.log.bind(console, `[${baseComponent}]`),
  warn: console.warn.bind(console, `[${baseComponent}]`),
  error: console.error.bind(console, `[${baseComponent}]`),
  fatal: console.error.bind(console, `[${baseComponent}]`),

  /**
   * Usage:
   *
   * import multiLogger from '@etherealengine/common/src/logger'
   * const logger = multiLogger.child({ component: 'client-core:authentication' })
   *
   * logger.info('Logging in...')
   * // will result in:
   * // [client-core:authentication] Logging in...
   *
   * @param opts {object}
   * @param opts.component {string}
   */
  child: (opts: { component: string; modifier?: (params: LogParamsObject) => LogParamsObject }) => {
    if (!config.client.serverHost || (config.client.localBuildOrDev && !config.client.logs.forceClientAggregate)) {
      // Locally, this will provide correct file & line numbers in browser console
      return {
        debug: console.debug.bind(console, `[${opts.component}]`),
        info: console.log.bind(console, `[${opts.component}]`),
        warn: console.warn.bind(console, `[${opts.component}]`),
        error: console.error.bind(console, `[${opts.component}]`),
        fatal: console.error.bind(console, `[${opts.component}]`)
      }
    } else {
      // For non-local builds, this send() is used
      const send = (level) => {
        const consoleMethods = {
          debug: console.debug.bind(console, `[${opts.component}]`),
          info: console.log.bind(console, `[${opts.component}]`),
          warn: console.warn.bind(console, `[${opts.component}]`),
          error: console.error.bind(console, `[${opts.component}]`),
          fatal: console.error.bind(console, `[${opts.component}]`)
        }

        return async (...args) => {
          try {
            // @ts-ignore
            let logParams = encodeLogParams(...args)

            if (typeof opts.modifier === 'function') logParams = opts.modifier(logParams)

            // In addition to sending to logging endpoint,  output to console
            consoleMethods[level](...args)

            // Send an async rate-limited request to backend logs-api service for aggregation
            // Also suppress logger.info() levels (the equivalent to console.log())

            cacheLog({
              level,
              component: opts.component,
              ...logParams
            })
          } catch (error) {
            console.error(error)
          }
        }
      }

      return config.client.logs.disabled === 'true'
        ? nullLogger
        : {
            debug: send('debug'),
            info: send('info'),
            warn: send('warn'),
            error: send('error'),
            fatal: send('fatal')
          }
    }
  }
}

/**
 * Support a limited subset of Pino's log parameters
 * @see https://getpino.io/#/docs/api?id=logging-method-parameters
 *
 * Limitations:
 * - Pino supports multiple interpolation values, but we're only going to use one in our code.
 * - Only supports %o interpolation (for %s or %d, just use native `${}`).
 *
 * Usage:
 * encodeLogParams(new TypeError('Error message'))
 * -> { msg: '{"error": "TypeError"", "message": "Error message", stack, cause }' }
 *
 * encodeLogParams(new Error('Error message'), 'Error while loading user')
 * -> { msg: '{"error": "Error"", "message": "Error while loading user: Error message", stack, cause }' }
 *
 * encodeLogParams('Message') -> { msg: 'Message' }
 *
 * encodeLogParams({ merge: 'object' }) -> { merge: 'object' }
 *
 * encodeLogParams({ merge: 'object' }, 'Message') -> { merge: 'object', msg: 'Message' }
 *
 * encodeLogParms('Message %o', { interpolation: 'value' })
 * -> { msg: 'Message {"interpolation": "value"}' }
 *
 * encodeLogParms({ merge: 'object' }, 'Message %o', { interpolation: 'value' })
 * -> { merge: 'object', msg: 'Message {"interpolation": "value"}' }
 *
 */
function encodeLogParams(first, second, third) {
  if (Array.isArray(first)) {
    first = first[0]
  }
  let mergeObject: any = {}
  let message: string

  if (first instanceof Error) {
    message = stringifyError(first, second)
  } else if (typeof first === 'string') {
    message = interpolate(first, second)
    if (second && !message.includes('%o')) {
      mergeObject = second
    }
  } else {
    mergeObject = first
    message = interpolate(second, third)
  }

  return { ...mergeObject, msg: message }
}

/**
 * Note: Only supports %o interpolation (for %s or %d, just use native `${}`).
 * @param message {string}
 * @param interpolationObject {object}
 */
function interpolate(message, interpolationObject): string {
  if (!interpolationObject || !message?.includes('%o')) {
    return message
  }

  return message?.replace('%o', JSON.stringify(interpolationObject))
}

function stringifyError(error, errorContextMessage?) {
  let cause, stack

  const trace = { stack: '' }
  Error.captureStackTrace?.(trace) // In Firefox captureStackTrace is undefined
  stack = trace.stack

  if (error.cause) {
    cause = stringifyError(error.cause)
  }

  let message = error.message

  if (errorContextMessage) {
    message = `${errorContextMessage}: ${message}`
  }

  return JSON.stringify({ error: error.name, message, stack, cause })
}

export type LogParamsObject = {
  [key: string]: any
}

export default multiLogger

globalThis.logger = multiLogger
