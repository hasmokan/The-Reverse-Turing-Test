#!/bin/bash
# 魔搭创空间部署脚本
# Usage: ./scripts/deploy-modelscope.sh
#
# Token 配置方式（二选一）:
#   1. 创建 .env.modelscope 文件（推荐，从队友处获取）
#   2. 设置环境变量: export MODELSCOPE_TOKEN="your-token"

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.modelscope"
MODELSCOPE_REMOTE="modelscope"

# 尝试从 .env.modelscope 文件加载 token
if [ -f "$ENV_FILE" ]; then
    echo "Loading token from .env.modelscope..."
    source "$ENV_FILE"
fi

# 检查 token
if [ -z "$MODELSCOPE_TOKEN" ]; then
    echo "Error: MODELSCOPE_TOKEN not found."
    echo ""
    echo "Please do one of the following:"
    echo "  1. Get .env.modelscope file from your teammate"
    echo "  2. Set environment variable: export MODELSCOPE_TOKEN='your-token'"
    echo ""
    echo "You can get your token from: https://modelscope.cn/my/myaccesstoken"
    exit 1
fi

MODELSCOPE_URL="http://oauth2:${MODELSCOPE_TOKEN}@www.modelscope.cn/studios/hasmokan/The-Reverse-Turing-Test.git"

# 检查是否已添加 modelscope remote
if ! git remote get-url $MODELSCOPE_REMOTE &>/dev/null; then
    echo "Adding ModelScope remote..."
    git remote add $MODELSCOPE_REMOTE $MODELSCOPE_URL
    echo "ModelScope remote added successfully!"
else
    # 更新 remote URL（以防 token 变更）
    git remote set-url $MODELSCOPE_REMOTE $MODELSCOPE_URL
fi

# 推送到魔搭（强制推送，因为 GitHub 是主仓库）
echo "Pushing to ModelScope..."
git push --force $MODELSCOPE_REMOTE main:master

echo ""
echo "Deploy complete!"
echo "View your app at: https://modelscope.cn/studios/hasmokan/The-Reverse-Turing-Test"
