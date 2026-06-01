#!/bin/bash
# WangPet 动画全播放测试脚本
# 用法: bash test-demo.sh [每个动画秒数，默认8]

DELAY=${1:-8}

SVGS=(
  "wang-pet-idle-living.svg"
  "wang-pet-sleeping.svg"
  "wang-pet-working-thinking.svg"
  "wang-pet-working-typing.svg"
  "wang-pet-working-juggling.svg"
  "wang-pet-working-sweeping.svg"
  "wang-pet-working-building.svg"
  "wang-pet-working-debugger.svg"
  "wang-pet-working-wizard.svg"
  "wang-pet-working-carrying.svg"
  "wang-pet-working-conducting.svg"
  "wang-pet-working-confused.svg"
  "wang-pet-working-overheated.svg"
  "wang-pet-error.svg"
  "wang-pet-working-ultrathink.svg"
  "wang-pet-happy.svg"
  "wang-pet-notification.svg"
  "wang-pet-disconnected.svg"
)

echo "=== WangPet Demo: ${#SVGS[@]} animations, ${DELAY}s each ==="
for i in "${!SVGS[@]}"; do
  svg="${SVGS[$i]}"
  echo "[$((i+1))/${#SVGS[@]}] $svg"
  curl -s -X POST http://127.0.0.1:23333/state \
    -H "Content-Type: application/json" \
    -d "{\"state\":\"working\",\"svg\":\"$svg\"}"
  sleep "$DELAY"
done
echo "=== DONE ==="
