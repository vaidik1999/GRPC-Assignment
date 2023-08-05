const express = require('express');
const bodyParser = require('body-parser');
const aws = require('aws-sdk');
const app = express();
const info = require('./information.json');
const bucket = "csci-5409-a2";
const grpc = require("@grpc/grpc-js");
const protoLoader = require('@grpc/proto-loader');
const axios = require("axios");
const packageDefinition = protoLoader.loadSync('computeandstorage.proto');
const computeAndStorageProto = grpc.loadPackageDefinition(packageDefinition).computeandstorage;
const server = new grpc.Server();
const s3 = new aws.S3({
  credentials: info
});

app.use(bodyParser.json());

function generateRandomKeyName() {
    const timestamp = Date.now(); // Get current timestamp
    const randomString = Math.random().toString(36).substring(2, 8); // Generate a random alphanumeric string
    return `${timestamp}_${randomString}`;
  }
// Unique Key name for the file generated
const key = generateRandomKeyName();


// Function to store data in S3 bucket
function storeData(call, callback) {
  console.log(call);
  const s3Uri = `https://${bucket}.s3.amazonaws.com/${key}`;
  const params = {
  Bucket: bucket,
  Key: key,
  Body: call.request.data
  };

  s3.upload(params, (err, data) => {
    if (err) {
        callback(err);
    } else {
        const response = {
            s3uri: data.Location
        };
        callback(null, response);
    }
  }
);
}

// API to append the data
function appendData(call, callback) {
  console.log(call);
  const params = {
  Bucket: bucket,
  Key: key
  };

  let existingData = "";
  let updatedData = "";
  
  s3.getObject(params, (err, data) => {
      if (err) {
          callback(null, err);
      } else {
          existingData = Buffer.from(data.Body).toString();
          console.log("Existing Data: " + existingData);
          updatedData = existingData + call.request.data;
          console.log("Updated Data: " + updatedData);
  
          const updatedParams = {
              Bucket: bucket,
              Key: key,
              Body: updatedData
          };
  
          s3.upload(updatedParams, (err, data) => {
              if (err) {
                  callback(null, err);
              } else {
                  const response = {};
                  callback(null);
              }
          });
      }
  });
}

// API to delete the file
function deleteFile(call, callback) {
  console.log(call);
  const params = {
      Bucket: bucket,
      Key: key
  };

  s3.deleteObject(params, (err, data) => {
      if (err) {
          callback(null, err);
      } else {
          callback(null);
      }
  });
}

server.addService(computeAndStorageProto.EC2Operations.service, {
  StoreData: storeData,
  AppendData: appendData,
  DeleteFile: deleteFile
});

server.bindAsync(
  "0.0.0.0:50051",
  grpc.ServerCredentials.createInsecure(),
  async () => {
    server.start();
    try {
      const response = await axios.post("http://54.173.209.76:9000/start", {
        banner: "B00925420",
        ip: "44.211.205.130:50051",
      });

      console.log(response);
    } catch (error) {
      console.log(error);
    }
  }
);

