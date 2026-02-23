// 安全的预加载脚本 - 不暴露 Node.js API 到渲染进程
// 如需扩展可在此通过 contextBridge 暴露接口

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopApp', {
    platform: process.platform,
    version: process.env.npm_package_version || '1.0.0',
});
