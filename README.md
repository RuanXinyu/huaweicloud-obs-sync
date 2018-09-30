# huaweicloud-obs-sync

同步本地文件目录到华为云OBS文件夹。

## 特性说明

1. 支持增量同步本地文件目录到华为云OBS文件夹
1. 支持设置是否同步删除OBS文件和目录
1. 支持指定OBS同步目录
1. 支持设置本地过滤文件和OBS过滤文件

## 安装说明

``` bash
npm install huaweicloud-obs-sync --save
```

## 使用说明

``` javascript
var obsSync = require('huaweicloud-obs-sync');

// 同步整个本地目录
obsSync.syncFolderToOBS({
        server : "https://obs.cn-north-1.myhwclouds.com",
        bucket: "obs-2f97",
        accessKeyId: "R7DYQD3DQRRLTDWYttE3S",
        secretAccessKey: "TERHf0NGpDrbhsbc1h3xymB9w22wK8lLgOhdgFkgjCB2",
        localDir: "D:\\public",
        localFilesIgnorePattern: "^\\..*",
        remoteDir: "/",
        syncDeletedFiles: "yes",
        syncDeletedFilesIgnorePattern: "^\\..*",
    })

//同步本地目录下的单个文件
obsSync.syncFileToOBS("D:\\public\\images\\avast.png", {
        server : "https://obs.cn-north-1.myhwclouds.com",
        bucket: "obs-2f97",
        accessKeyId: "R7DYQD3DQRRLTDWYttE3S",
        secretAccessKey: "TERHf0NGpDrbhsbc1h3xymB9w22wK8lLgOhdgFkgjCB2"
        localFileName: "D:\\public\\images\\avast.png",
        remoteFileName: "images/avast.png"
    })
```

### syncFolderToOBS(options)

同步整个本地目录到OBS

| 名称 | 必选 | 默认值 | 描述 |
| -- | -- | -- |-- |
| server | 必填 | null | OBS服务器地址，以`https://`开头，不包含桶名称，<br>比如`https://obs.cn-north-1.myhwclouds.com` |
| bucket |必填 | null | OBS桶名称 |
| accessKeyId | 必填 | null | 访问OBS的accessKeyId |
| secretAccessKey | 必填 | null | 访问OBS的secretAccessKey |
| localDir | 必填 | null | 本地同步目录的绝对路径 |
| localFilesIgnorePattern | 可选 | "^\\..*" | 本地忽略文件的正则表达式，<br>该正则表达式会应用到文件相对于`localDir`的相对路径，路径分隔符为`/` |
| remoteDir | 可选 | / | 同步到远端的目录，路径分隔符为`/` |
| syncDeletedFiles | 可选 | yes | `yes`或者`no`, <br>如果是`yes`，则本地文件删除后，OBS中的文件也会对应删除，<br>但是`syncDeletedFilesIgnorePattern`匹配上的文件除外 |
| syncDeletedFilesIgnorePattern | 可选 | "^\\..*" | 远端忽略文件的正则表达式，<br>该正则表达式会应用到文件相对于`remoteDir`的相对路径，路径分隔符为`/` |

### syncFileToOBS(options)

同步本地目录的单个文件到OBS目录

| 名称 | 必选 | 默认值 | 描述 |
| -- | -- | -- |-- |
| server | 必填 | null | OBS服务器地址，以`https://`开头，不包含桶名称，<br>比如`https://obs.cn-north-1.myhwclouds.com` |
| bucket |必填 | null | OBS桶名称 |
| accessKeyId | 必填 | null | 访问OBS的accessKeyId |
| secretAccessKey | 必填 | null | 访问OBS的secretAccessKey |
| localFileName | 必填 | null | 本地文件的绝对路径 |
| remoteFileName | 必填 | null | OBS中的全路径，路径分隔符为`/` |

## 应用场景

### 1. Hexo插件

使用Hexo将文件发布到OBS，然后运用OBS的静态网站功能对外提供服务，参考：

### 2. VSCode插件

使用VSCode编辑博客，粘贴图片自动将文件上传至OBS并自动在博客中插入图片地址，参考:

### 3. 定期备份

定期备份本地目录到OBS

## 相关资料

华为云OBS的SDK地址： https://developer.huaweicloud.com/sdk?OBS

Hexo插件中心地址： https://hexo.io/plugins/