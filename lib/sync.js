'use strict';


var path = require('path');
var ObsClient = require('./obs-sdk-3.0.0/obs');
var Promise = require('bluebird');
var crypto = require('crypto');
var hexofs = require('hexo-fs');
var fs = require('fs');
var urlencode = require('urlencode');
var request = require('request');
var xml2js = require('xml2js');

exports = module.exports = new function() {
    let checkSyncToOptions = (options) => {
        options = options || {};
        if (!options.hasOwnProperty('server') || !options.hasOwnProperty('bucket') 
            || !options.hasOwnProperty('accessKeyId') || !options.hasOwnProperty('secretAccessKey') 
            || !options.hasOwnProperty('localDir')) {
            throw new Error('server, bucket, accessKeyId, secretAccessKey, localDir must not be empty');
        }

        if (options.server.substring(0, 8) != "https://") {
            throw new Error('server option must start with "https://", e.g. "https://obs.cn-north-1.myhwclouds.com"');
        }

        if (!options.hasOwnProperty('localFilesIgnorePattern')) options.localFilesIgnorePattern = "$\\..*";
        if (!options.hasOwnProperty('remoteDir')) options.remoteDir = "/";
        if (!options.hasOwnProperty('syncDeletedFiles')) options.syncDeletedFiles = "yes";
        if (!options.hasOwnProperty('syncDeletedFilesIgnorePattern')) options.syncDeletedFilesIgnorePattern = "$\\..*";

        options.localDir = path.normalize(options.localDir).replace(/(^\s*)|(\s*$)/g, "")
        options.remoteDir = options.remoteDir.replace(/(^\/*)|(\/*$)/g, "").replace(/(^\s*)|(\s*$)/g, "")
        return options;
    }

    let checkSyncFileToOptions = (options) => {
        options = options || {};
        if (!options.hasOwnProperty('server') || !options.hasOwnProperty('bucket') 
            || !options.hasOwnProperty('accessKeyId') || !options.hasOwnProperty('secretAccessKey') 
            || !options.hasOwnProperty('localFileName') || !options.hasOwnProperty('remoteFileName')) {
            throw new Error('server, bucket, accessKeyId, secretAccessKey, localFileName  remoteFileName must not be empty');
        }

        if (options.server.substring(0, 8) != "https://") {
            throw new Error('server option must start with "https://", e.g. "https://obs.cn-north-1.myhwclouds.com"');
        }

        options.localFileName = path.normalize(options.localFileName).replace(/(^\s*)|(\s*$)/g, "")
        options.remoteFileName = options.remoteFileName.replace(/(^\/*)|(\/*$)/g, "").replace(/(^\s*)|(\s*$)/g, "")
        return options;
    }

    let getObsClient = (options) => {
        return new ObsClient({ 
            access_key_id: options.accessKeyId, 
            secret_access_key: options.secretAccessKey, 
            server : options.server, 
        });
    };

    let getOBSFileList = async (options) => {
        let baseUrl = options.server.replace("https://", "https://" + options.bucket + ".") + "?max-keys=1000&prefix=" + urlencode(options.remoteDir);
        let marker = "";
        let result = [];
        console.log("get remote obs file list ...");
        while (true) {
            let data = await new Promise((resolver, reject) => {
                let url = marker == "" ? baseUrl : baseUrl + "&marker=" + urlencode(marker);
                console.log(url);
                request(url, (error, response, body) => {
                    if (error) reject(error);
                    xml2js.parseString(body, {explicitArray:false, ignoreAttrs:true}, (error, result) => {
                        resolver(result);
                    });
                });
            });
            if (data.ListBucketResult.Contents != undefined) {
                result = result.concat(data.ListBucketResult.Contents);
            }
            if (data.ListBucketResult.NextMarker == "" || data.ListBucketResult.NextMarker == undefined) {
                break;
            }
            marker = data.ListBucketResult.NextMarker;
        }
        console.log("get remote obs file list success, total file " + result.length);
        return [options, result];
    }

    let getChangedFileList = (info) => {
        let options = info[0];
        let remoteFileList = info[1];
        console.log("=================sync files start================================");
        console.log("get local file list ...");
        let localFileList = hexofs.listDirSync(options.localDir).map(item => {
            let data = hexofs.readFileSync(path.join(options.localDir, item), {escape: false, encoding: null});
            let result = {
                filename: path.join(options.localDir, item), 
                linuxFilename: item.replace(/\\/g, "/"), 
                obsKey: options.remoteDir == "" ? item.replace(/\\/g, "/") : options.remoteDir + "/" + item.replace(/\\/g, "/"),
                md5: crypto.createHash('md5').update(data).digest('hex'),
                base64MD5: crypto.createHash('md5').update(data).digest("base64")
            };
            return result;
        })
        console.log("get local file list success, total file " + localFileList.length);

        console.log("calculate changed local file list ...");
        var updatedFileList = [];
        let localFilesIgnoreRegex = new RegExp(options.localFilesIgnorePattern);
        for (var i = 0; i < localFileList.length; i++) {
            let isUpdated = true;
            for (var j = 0; j < remoteFileList.length; j++) {
                if (remoteFileList[j].Key == localFileList[i].obsKey) {
                    if (remoteFileList[j].ETag.replace(/"/g, "") == localFileList[i].md5) {
                        isUpdated = false;
                    }
                    break;
                }
            }
            if (isUpdated && !localFilesIgnoreRegex.test(localFileList[i].linuxFilename)) {
                updatedFileList.push(localFileList[i]);
            }
        }
        console.log("calculate changed local file list success, total changed file " + updatedFileList.length);

        console.log("calculate deleted local file list ...");
        var deletedFileList = [];
        let syncDeletedFilesIgnoreRegex = new RegExp(options.syncDeletedFilesIgnorePattern);
        for (var i = 0; i < remoteFileList.length; i++) {
            let isExist = false;
            for (var j = 0; j < localFileList.length; j++) {
                if (remoteFileList[i].Key == localFileList[j].obsKey) {
                    isExist = true;
                    break;
                }
            }
            if (!isExist && !syncDeletedFilesIgnoreRegex.test(remoteFileList[i].Key)) {
                deletedFileList.push(remoteFileList[i]);
            }
        }
        console.log("calculate deleted local file list success, total changed file " + deletedFileList.length);
        return [options, updatedFileList, deletedFileList];
    }

    let uploadFiles = async (info) => {
        let options = info[0];
        let updatedFileList = info[1];
        let deletedFileList = info[2];
        let obsClient = getObsClient(options);

        console.log("===========> uploading files ...");
        await Promise.all(updatedFileList.map(function (item) {
            return new Promise((resolver, reject) => {
                obsClient.putObject({ 
                    Bucket : options.bucket, 
                    Key : item.obsKey, 
                    SourceFile : item.filename,
                    ContentMD5: item.base64MD5
                }, (err, result) => { 
                    if(err){ 
                        console.error('upload file--> ' + item.obsKey + ', error, ' + err);
                        reject(err);
                    }else{
                        console.error('upload file--> ' + item.obsKey + ', ' + result.CommonMsg.Status);  
                        resolver(result.CommonMsg.Status);
                    } 
                });
            });
        }));
        console.log("===========> uploading files finished...");

        if (options.syncDeletedFiles == "yes") {
            console.log("===========> deleting files ...");
            await Promise.all(deletedFileList.map(function (item) {
                return new Promise((resolver, reject) => {
                    obsClient.deleteObject({ 
                        Bucket : options.bucket, 
                        Key : item.Key
                    }, (err, result) => { 
                        if(err){ 
                            console.error('delete file--> ' + item.Ke + ', error, ' + err);
                            reject(err);
                        }else{
                            console.error('delete file --> ' + item.Key + ', response code: ' + result.CommonMsg.Status); 
                            resolver(result.CommonMsg.Status);
                        } 
                    });
                });
            }));
            console.log("===========> deleting files finished...");
        }
        obsClient.close();
        console.log("=================sync files finished================================");
    }

    this.syncFolderToOBS = (options) => {
        return getOBSFileList(checkSyncToOptions(options)).then(getChangedFileList).then(uploadFiles);
    }

    this.syncFileToOBS = (options) => {
        options = checkSyncFileToOptions(options);
        return new Promise((resolver, reject) => {
            let data = hexofs.readFileSync(options.localFileName, {escape: false, encoding: null});
            let obsClient = getObsClient(options);
            obsClient.putObject({ 
                Bucket : options.bucket, 
                Key : options.remoteFileName, 
                SourceFile : options.localFileName,
                ContentMD5: crypto.createHash('md5').update(data).digest("base64")
            }, (err, result) => { 
                obsClient.close();
                if(err){ 
                    console.error('upload file--> ' + item.obsKey + ', error, ' + err);
                    reject(err);
                }else{
                    console.error('upload file--> ' + item.obsKey + ', ' + result.CommonMsg.Status);  
                    resolver(result.CommonMsg.Status);
                } 
            });
        });
    }
}
