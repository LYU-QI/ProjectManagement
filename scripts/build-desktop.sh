#!/bin/bash
# ============================================================
# 桌面版一键打包脚本
# 将 ProjectLVQI 前后端打包为 Mac 桌面应用 (.dmg)
# ============================================================

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
DESKTOP_DIR="$ROOT_DIR/desktop"

echo "=========================================="
echo "🚀 ProjectLVQI 桌面应用打包开始"
echo "=========================================="
echo ""

# ---- 步骤 1: 构建前端 ----
echo "📦 [1/6] 构建前端静态文件..."
cd "$FRONTEND_DIR"
npx vite build
echo "✅ 前端构建完成"
echo ""

# ---- 步骤 2: 构建后端 ----
echo "📦 [2/6] 构建后端编译产物..."
cd "$BACKEND_DIR"
npx nest build
echo "✅ 后端构建完成"
echo ""

# ---- 步骤 3: 生成桌面版 Prisma Client (SQLite) ----
echo "📦 [3/6] 生成桌面版 Prisma Client (SQLite)..."
cd "$BACKEND_DIR"

# 备份原始 schema
cp prisma/schema.prisma prisma/schema.prisma.bak

# 使用桌面版 schema
cp prisma/schema.desktop.prisma prisma/schema.prisma

# 生成 Prisma Client
npx prisma generate --schema prisma/schema.prisma

echo "✅ SQLite Prisma Client 生成完成"
echo ""

# ---- 步骤 4: 创建并初始化 SQLite 数据库 ----
echo "📦 [4/6] 初始化 SQLite 数据库..."
cd "$BACKEND_DIR"

# 设置 SQLite 数据库路径
DB_PATH="$BACKEND_DIR/prisma/projectlvqi.db"
export DATABASE_URL="file:$DB_PATH"

# 删除旧数据库（如果存在）
rm -f "$DB_PATH"

# 使用 Prisma 推送 schema 到 SQLite（用 db push 而非 migrate）
npx prisma db push --schema prisma/schema.prisma --accept-data-loss

# 运行种子数据
npx ts-node prisma/seed.ts

echo "✅ SQLite 数据库初始化完成: $DB_PATH"
echo ""

# ---- 步骤 5: 还原原始 schema ----
echo "📦 [5/6] 还原开发环境 schema..."
cd "$BACKEND_DIR"
cp prisma/schema.prisma.bak prisma/schema.prisma
rm prisma/schema.prisma.bak

# 重新生成 PostgreSQL 版本的 Prisma Client（恢复开发环境）
npx prisma generate --schema prisma/schema.prisma

echo "✅ 开发环境 schema 已还原"
echo ""

# ---- 步骤 6: Electron 打包 ----
echo "📦 [6/6] 使用 electron-builder 打包 .dmg..."
cd "$DESKTOP_DIR"

# 安装 desktop 依赖（如果还没装的话）
npm install

# 打包
npx electron-builder --mac

echo ""
echo "=========================================="
echo "🎉 打包完成！"
echo "=========================================="
echo "输出目录: $DESKTOP_DIR/dist/"
echo ""
ls -lh "$DESKTOP_DIR/dist/"*.dmg 2>/dev/null || echo "(查找 .dmg 文件...)"
find "$DESKTOP_DIR/dist" -name "*.dmg" -exec echo "📀 DMG 文件: {}" \;
echo ""
