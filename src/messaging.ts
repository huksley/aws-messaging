import { DynamoDB } from 'aws-sdk'
import * as t from 'io-ts'
import { decode, apiResponse, findPayload, ApiResponseHandler } from './util'
import { Context as LambdaContext, APIGatewayEvent, Callback as LambdaCallback } from 'aws-lambda'
import { logger as log, logger } from './logger'
import { config } from './config'
import * as uuidV4 from 'uuid/v4'
import fetch from 'node-fetch'
import * as R from 'ramda'

export const InputPayload = t.type({
  event: t.union([
    t.literal('register'),
    t.literal('unregister'),
    t.literal('message'),
    t.literal('topic'),
  ]),
  topic: t.union([t.string, t.undefined]),
  token: t.union([t.string, t.null, t.undefined]),
  userId: t.union([t.string, t.null, t.undefined]),
  // Meta data on register
  fields: t.any,
})

export type Input = t.TypeOf<typeof InputPayload>

export const OutputPayload = t.intersection([
  InputPayload,
  t.partial({
    ok: t.boolean,
  }),
])

export type Output = t.TypeOf<typeof OutputPayload>

const db = new DynamoDB.DocumentClient({
  signatureVersion: 'v4',
  region: config.AWS_REGION,
})

/** Invoked on API Gateway call */
export const postHandler = (
  event: APIGatewayEvent,
  context: LambdaContext,
  callback: LambdaCallback,
) => {
  log.info(
    'event(' +
      typeof event +
      ') ' +
      JSON.stringify(event, null, 2) +
      ' context ' +
      JSON.stringify(context, null, 2),
  )

  const api = apiResponse(event, context, callback)
  const payload = findPayload(event)
  log.info('Using payload', payload)

  try {
    const input = decode<Input>(InputPayload, payload)
    processEvent(input, api).then(_ => {
      return api.success(input)
    })
  } catch (err) {
    log.warn('Failed to process event', err)
    api.failure('Exception processing event: ' + err)
  }
}

export const processEvent = (input: Input, api: ApiResponseHandler) => {
  if (input.event === 'register') {
    if (!input.token) {
      throw new Error('No token specified')
    }
    const token = input.token
    logger.info('Looking for user token', { token })
    return db
      .query({
        IndexName: 'token-index',
        TableName: config.TABLE_NAME,
        KeyConditionExpression: '#TOKEN = :TokenRef',
        ExpressionAttributeValues: {
          ':TokenRef': token,
        },
        ExpressionAttributeNames: {
          '#TOKEN': 'token',
        },
        Limit: 1,
      })
      .promise()
      .then(result => {
        logger.info('Got users by token', result.Count)
        if (result.Count === 0) {
          // Add session to table
          const userId = uuidV4()
          logger.info('Creating user by token', { userId, token })
          return db
            .put({
              TableName: config.TABLE_NAME,
              Item: {
                id: userId,
                token,
                ...input.fields,
              },
            })
            .promise()
            .then(addSessionResult => {
              log.info('Got create user response', addSessionResult)
              return subscribeToTopic(token, config.PROFILE_TOPIC)
                .then(subscribeToTopicResult => {
                  log.info('Subscribed to topic', subscribeToTopicResult)
                  return sendToTopic(config.PROFILE_TOPIC, { code: 'new-user', userId })
                    .then(sendToTopicResult => {
                      log.info('Sent to topic', sendToTopicResult)
                      return api.success({ ...input, userId, ok: true, existing: false })
                    })
                    .catch(error => {
                      log.warn('Failed to send to topic', error)
                      api.failure('Failed to send to topic: ' + error)
                    })
                })
                .catch(error => {
                  log.warn('Failed to subscribe to topic', error)
                  api.failure('Failed to subscribe to topic: ' + error)
                })
            })
            .catch(error => {
              log.warn('Failed to register', error)
              api.failure('Failed to register: ' + error)
            })
        } else {
          const session = result.Items![0]
          log.info('Subscribing user to topic', {
            token,
            userId: session.id,
            topic: config.PROFILE_TOPIC,
          })
          return subscribeToTopic(token, config.PROFILE_TOPIC)
            .then(subscribeToTopicResult => {
              log.info('Subscribed to topic', subscribeToTopicResult)
              return sendToTopic(config.PROFILE_TOPIC, { code: 'user-online', userId: session.id })
                .then(sendToTopicResult => {
                  log.info('Sent to topic', sendToTopicResult)
                  return api.success({
                    ...input,
                    userId: session.id,
                    fields: session,
                    ok: true,
                    existing: true,
                  })
                })
                .catch(error => {
                  log.warn('Failed to send to topic', error)
                  api.failure('Failed to send to topic: ' + error)
                })
            })
            .catch(error => {
              log.warn('Failed to subscribe to topic', error)
              api.failure('Failed to subscribe to topic: ' + error)
            })
        }
      })
      .catch(err => {
        logger.warn('Failed to query', err)
        api.failure('Failed to query: ' + err, 500)
      })
  } else if (input.event === 'unregister') {
    if (!input.userId) {
      throw new Error('No userId specified')
    }
    // Remove session from table buy userId and token
    return db
      .get({ TableName: config.TABLE_NAME, Key: { id: input.userId } })
      .promise()
      .then(result => {
        if (result.Item) {
          if (result.Item.token !== input.token) {
            throw new Error('To unregister specify both userId and token')
          }
          return db
            .delete({ TableName: config.TABLE_NAME, Key: { id: input.userId } })
            .promise()
            .then(deleteResult => {
              log.info('Got delete response', deleteResult)
              api.success({ ...input, ok: true })
            })
            .catch(error => {
              log.warn('Cant unregister: ' + input.userId, error)
              api.failure('Failed to unregister: ' + error)
            })
        }
      })
      .catch(error => {
        log.warn('Failed to find: ' + input.userId, error)
        api.failure('Failed to unregister: ' + error)
      })
  } else if (input.event === 'message') {
    // Send specified userId message
    log.info('Looking for id = ' + input.userId)
    return db
      .get({ TableName: config.TABLE_NAME, Key: { id: input.userId } })
      .promise()
      .then(result => {
        if (result.Item) {
          log.info('Got user response', result)
          const { token } = result.Item
          log.info('Sending message to ' + token, input.fields)
          return sendMessage(token, input.fields)
        } else {
          log.warn('Cant find: ' + input.userId)
          api.failure('Cant find session: ' + input.userId, 404)
        }
      })
      .catch(error => {
        log.warn('Failed to find: ' + input.userId, error)
        api.failure('Failed to unregister: ' + error)
      })
  } else if (input.event === 'topic') {
    // Send message to topic
    log.info('Sending message to ' + input.topic, input.fields)
    return sendToTopic(input.topic!, input.fields)
  } else {
    throw new Error('Invalid event type')
  }
}

export const sendMessage = (tokenId: string, fields: any) => {
  return fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'key=' + config.FCM_SERVER_KEY,
    },
    body: JSON.stringify({
      registration_ids: [tokenId],
      data: R.assoc(
        'message',
        fields && fields.message ? fields.message : 'No message',
        fields ? fields : { empty: true },
      ),
    }),
  })
    .then(response => {
      log.info('sendMessage response ' + response.status)
      return response
    })
    .catch(err => {
      log.warn('sendMessage failed', err)
      throw err
    })
}

export const sendToTopic = (topic: string, fields: any) => {
  return fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'key=' + config.FCM_SERVER_KEY,
    },
    body: JSON.stringify({
      data: R.assoc(
        'message',
        fields && fields.message ? fields.message : 'No message',
        fields ? fields : { empty: true },
      ),
      to: '/topics/' + topic,
    }),
  })
    .then(response => response.json())
    .then(response => {
      log.info('sendToTopic response', response)
      return response
    })
    .catch(err => {
      log.warn('sendToTopic failed', err)
      throw err
    })
}

export const subscribeToTopic = (tokenId: string, topicName: string) => {
  return fetch(`https://iid.googleapis.com/iid/v1/${tokenId}/rel/topics/${topicName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'key=' + config.FCM_SERVER_KEY,
    },
    body: JSON.stringify({}),
  })
    .then(response => response.json())
    .then(response => {
      log.info('subscribeToTopic response ', response)
      return response
    })
    .catch(err => {
      log.warn('subscribeToTopic failed', err)
      throw err
    })
}
