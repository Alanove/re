@echo off
call "%~dp0scripts\win-env.cmd"
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" --preserve-symlinks --preserve-symlinks-main scripts\run.cjs dev
) else (
  node --preserve-symlinks --preserve-symlinks-main scripts\run.cjs dev
)
