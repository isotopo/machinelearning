'use strict'
var AWS = require('aws-sdk')
var converter = require('json-2-csv')
const debug = require('./debug')
const updatePolicy = require('./updatePolicy')
AWS.config.region = 'us-east-1'
function s3 (json, name, bucket, path) {
  name = name || this.options.DataSourceName
  bucket = bucket || this.options.bucket
  path = path || this.options.path
  var now = new Date()
  var jsonDate = now.toJSON()
  debug.info('name', name, 'bucket', bucket, 'path', path)
  return new Promise(function (resolve, reject) {
    // params to create de object into de bucket
    var s3bucket = new AWS.S3({
      params: {
        Bucket: bucket,
        Key: path.length ? path + '/' + jsonDate + ':' + name + '.csv' : jsonDate + ':' + name + '.csv'
      }
    })
    // the bucket is created
    s3bucket.createBucket({}, function (err, createBucket) {
      if (err && !err.BucketAlreadyExists &&
          err.code !== 'OperationAborted' &&
          !err.retryDelay) {
        debug.error('error on create bucket with s3', err)
        reject(err)
        return
      }
      s3bucket.putBucketPolicy({
        Bucket: bucket, /* required */
        Policy: require('./policy')(bucket) /* required */}).promise()
      .then(() => {
        if (err && err.code === 'OperationAborted') {
          return setTimeout(() => {
            s3(json, name, bucket, path)
          .then(resolve)
          .catch(reject)
          }, ((err.retryDelay || 60) * 1000))
        }
        updatePolicy(bucket, path).then(() => {
          debug.info('createBucket on create bucket with s3', createBucket)
          // the object with the csv is obtainded
            // the data are convert to json
              // next the object stored into s3 is concat to object passed
          converter.json2csv(json, function (e, csv) {
            if (e) {
              debug.error('err on json2csv object in bucket with s3', e)
              reject(e)
              return
            }
            var params = {
              Body: csv,
              ACL: 'authenticated-read'
            }
                  // the object is uploaded
            s3bucket.upload(params, function (err, dataUploaded) {
              if (err) {
                debug.error('err on upload object in bucket with s3', err)
                reject(err)
                return
              }
                    // the promise is resolved
              debug.info('object in bucket with s3', {
                data: dataUploaded,
                createBucket: createBucket
              })
              resolve({
                data: dataUploaded,
                createBucket: createBucket
              })
            })
          })
        })
      .catch(reject)
      })
      .catch((err) => {
        debug.info('error on updatePolicy', err)
        reject(err)
      })
    })
  })
}

module.exports = s3
