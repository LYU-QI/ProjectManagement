// Electron 主进程入口
// 负责启动后端服务、加载前端页面、管理应用生命周期

const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// 后端端口
const BACKEND_PORT = 3000;

let mainWindow = null;
let backendProcess = null;

/** 获取资源路径 (打包后在 Resources 目录下) */
function getResourcePath(...segments) {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, ...segments);
    }
    return path.join(__dirname, '..', ...segments);
}

/** 启动 NestJS 后端 */
function startBackend() {
    return new Promise((resolve, reject) => {
        const backendEntry = getResourcePath('backend', 'dist', 'src', 'main.js');
        const backendCwd = getResourcePath('backend');

        // node_modules 在打包后位于 Resources/node_modules
        const nodeModulesPath = getResourcePath('node_modules');

        // 设置环境变量
        const env = {
            ...process.env,
            NODE_ENV: 'production',
            PORT: String(BACKEND_PORT),
            // 关键：让 Node.js 从正确的路径查找模块
            NODE_PATH: nodeModulesPath,
        };

        // 打包后，使用 userData 目录存放数据库（可写入）
        if (app.isPackaged) {
            const userDataDir = app.getPath('userData');
            const dbPath = path.join(userDataDir, 'projectlvqi.db');
            env.DATABASE_URL = `file:${dbPath}`;

            // 复制初始数据库到 userData（如果还不存在）
            if (!fs.existsSync(dbPath)) {
                const srcDb = getResourcePath('backend', 'prisma', 'projectlvqi.db');
                if (fs.existsSync(srcDb)) {
                    fs.mkdirSync(userDataDir, { recursive: true });
                    fs.copyFileSync(srcDb, dbPath);
                    console.log('已复制初始数据库到:', dbPath);
                }
            }

            // 设置 .env 中的 DATABASE_URL 为 SQLite
            env.DATABASE_URL = `file:${dbPath}`;
        }

        console.log('正在检查资源文件...');
        const filesToCheck = [backendEntry, backendCwd, nodeModulesPath];
        filesToCheck.forEach(f => {
            console.log(`- 检查路径 [${fs.existsSync(f) ? 'OK' : 'MISSING'}]: ${f}`);
        });

        backendProcess = fork(backendEntry, [], {
            cwd: backendCwd,
            env,
            silent: true,
            execArgv: [] // 确保不继承主进程的调试参数
        });

        let resolved = false;

        backendProcess.stdout?.on('data', (data) => {
            const msg = data.toString();
            console.log('[后端]', msg);
            // 某些情况下 Nest 输出可能被截断，进行模糊匹配
            if (!resolved && (msg.includes('Nest application successfully started') || msg.includes('started on port'))) {
                resolved = true;
                console.log('检测到后端启动成功信号');
                resolve();
            }
        });

        let stderrBuffer = '';
        backendProcess.stderr?.on('data', (data) => {
            const errorMsg = data.toString();
            console.error('[后端错误]', errorMsg);
            stderrBuffer += errorMsg;
        });

        backendProcess.on('error', (err) => {
            console.error('后端进程创建失败:', err);
            if (!resolved) {
                resolved = true;
                reject(new Error(`无法启动后端进程: ${err.message}\n${stderrBuffer}`));
            }
        });

        backendProcess.on('exit', (code, signal) => {
            console.log(`后端进程退出: code=${code}, signal=${signal}`);
            if (!resolved) {
                resolved = true;
                reject(new Error(`后端进程异常退出 (code=${code})。\n报错详情:\n${stderrBuffer || '无详情'}`));
            }
            backendProcess = null;
        });

        // 超时 30 秒（加载大量依赖可能较慢）
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                reject(new Error(`后端启动超时(30s)。\n当前 stderr:\n${stderrBuffer || '无输出'}`));
            }
        }, 30000);
    });
}

/** 创建主窗口 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        title: '天枢 · 全局管控矩阵',
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // 加载前端静态文件
    const frontendPath = getResourcePath('frontend', 'dist', 'index.html');
    console.log('加载前端:', frontendPath);
    console.log('文件存在:', fs.existsSync(frontendPath));
    mainWindow.loadFile(frontendPath);

    // 开发调试：打开 DevTools
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

/** 停止后端 */
function stopBackend() {
    if (backendProcess) {
        backendProcess.kill('SIGTERM');
        backendProcess = null;
    }
}

// ---- 应用生命周期 ----
app.whenReady().then(async () => {
    try {
        await startBackend();
        console.log('✅ 后端服务就绪');
    } catch (err) {
        console.error('❌ 后端启动失败:', err.message);
        dialog.showErrorBox('启动提示', `后端服务启动异常：${err.message}\n\n应用仍可打开，但数据功能可能不可用。`);
    }
    createWindow();
});

app.on('window-all-closed', () => { stopBackend(); app.quit(); });
app.on('before-quit', () => { stopBackend(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
