import { logger as log } from '../src/logger'
import { config } from '../src/config'
import { processEvent } from '../src/messaging'

describe('send single message', () => {
  const skip = config.TEST_E2E && config.FCM_SERVER_KEY && config.E2E_SAMPLE_TOKEN ? it : it.skip

  const userIdHolder = {
    userId: '' as any,
  }

  const fake = {
    success: (payload: any, statusCode?: number /* = 200 */, headers?: any) => {
      // No-op
      log.info('success', payload, statusCode, headers)
      if (payload.userId) {
        log.info('Got userId = ' + payload.userId)
        userIdHolder.userId = payload.userId
      }
    },
    failure: (
      payload?: any /* = "Internal server error"*/,
      statusCode?: number /* = 500 */,
      headers?: any,
    ) => {
      // No-op
      log.info('failure', payload, statusCode, headers)
    },
  }

  skip('register', () => {
    return processEvent(
      {
        event: 'register',
        token: config.E2E_SAMPLE_TOKEN,
        topic: undefined,
        userId: null,
        fields: null,
      },
      fake,
    )
  })

  skip('message', () => {
    return processEvent(
      {
        event: 'message',
        token: null,
        userId: userIdHolder.userId,
        topic: undefined,
        fields: {
          hello: 'World!',
        },
      },
      fake,
    )
  })

  skip('unregister', () => {
    return processEvent(
      {
        event: 'unregister',
        token: config.E2E_SAMPLE_TOKEN,
        userId: userIdHolder.userId,
        topic: undefined,
        fields: null,
      },
      fake,
    )
  })

  skip('topic', () => {
    return processEvent(
      {
        event: 'topic',
        userId: undefined,
        token: undefined,
        topic: 'profile-update',
        fields: {
          code: 'user-online',
          message: 'User online test',
        },
      },
      fake,
    )
  })

  skip('messages', () => {
    return processEvent(
      {
        event: 'messages',
        userId: userIdHolder.userId,
        token: undefined,
        topic: undefined,
        fields: undefined,
      },
      fake,
    )
  })
})
