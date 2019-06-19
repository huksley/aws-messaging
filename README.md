# AWS Messaging handler

[![Sponsored](https://img.shields.io/badge/chilicorn-sponsored-brightgreen.svg)](http://spiceprogram.org/oss-sponsorship)

Registers new sessions and sends async messages to the sessions using Google FCM/Cloud Messaging

  * Typescript
  * Unit and e2e tests
  * Configuration
  * Deployment using [Serverless framework](https://serverless.com)
  * Connect to API Gateway
  * Payload testing using [io-ts](https://github.com/gcanti/io-ts)

## Installing && running

  * Create bucket
  * `> yarn`
  * `> yarn lint && yarn format && yarn test && yarn build`
  * IMAGE_BUCKET=my-image-bucket yarn deploy
  * Invoke Lambda by saving .jpg file to S3 bucket
  * Check CloudWatch logs for processing journal
  * To run e2e test run `TEST_RUN_E2E=1 E2E_IMAGE_BUCKET=my-image-bucket yarn test`

## Links

  * https://firebase.google.com/docs/cloud-messaging/js/client
