#!/bin/sh
# 本地预览用：改完 JS/CSS 后执行本脚本，强制浏览器重新拉取资源（Android WebView 不需要，assets 每次重装即更新）
cd "$(dirname "$0")/game" || exit 1
TS=$(date +%s)
sed -i "s/\(style\.css?t=\)[0-9]*/\1$TS/; s/\(\.js?t=\)[0-9]*/\1$TS/g" index.html
echo "cache-bust -> $TS"
grep -o "t=[0-9]*" index.html | head -1
