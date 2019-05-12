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

  * https://medium.com/@aakashbanerjee/upload-files-to-amazon-s3-from-the-browser-using-pre-signed-urls-4602a9a90eb5
  * https://stackoverflow.com/questions/44888301/upload-file-to-s3-with-post

## Assertion

  * curl works
  * curl with invalid parameters gives error
  * serverless invoke -f handlePost -d "{ \"s3Url\": \"s3://dsads/1.jpg\" }"
  * serverless invoke local -f handlePost -d "{ \"s3Url\": \"s3://dsads/1.jpg\" }"
  * Lambda invoke from UI with test payload { "s3Url": "s3://dsdss/1.jpg" } works
  * API GW endpoint invoke from AWS Console UI
  * Run test with DEPLOYED_URL
