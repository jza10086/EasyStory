@echo off
chcp 65001 > nul
echo ========================================================
echo    StoryFlow - 本地可视化游戏多分支剧情工作台
echo ========================================================
echo.
echo [1/2] 正在启动本地数据存储服务 (端口 3001)...
echo [2/2] 正在启动前端开发画布 (端口 5173)...
echo.
echo 稍后将在默认浏览器自动打开：http://localhost:5173
echo 按 Ctrl+C 可停止运行。
echo.

start "" http://localhost:5173
npm run dev
pause
