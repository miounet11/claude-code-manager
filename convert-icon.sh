#!/bin/bash

# 创建一个简单的 PNG 图标
cat > assets/icon.png << 'EOF'
#!/usr/bin/env python3
import cairo

# 创建 512x512 的图像
WIDTH, HEIGHT = 512, 512
surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, WIDTH, HEIGHT)
ctx = cairo.Context(surface)

# 黑色背景
ctx.set_source_rgb(0, 0, 0)
ctx.paint()

# 绿色 M 字母
ctx.set_source_rgb(0, 1, 0)
ctx.select_font_face("Consolas", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
ctx.set_font_size(120)
text_extents = ctx.text_extents("M")
x = (WIDTH - text_extents.width) / 2 - text_extents.x_bearing
y = 200
ctx.move_to(x, y)
ctx.show_text("M")

# 终端框
ctx.set_source_rgb(0, 1, 0)
ctx.set_line_width(8)
ctx.rectangle(100, 250, 312, 180)
ctx.stroke()

# Miaoda 文字
ctx.set_source_rgb(0.75, 0.75, 0.75)
ctx.set_font_size(48)
text_extents = ctx.text_extents("Miaoda")
x = (WIDTH - text_extents.width) / 2 - text_extents.x_bearing
ctx.move_to(x, 350)
ctx.show_text("Miaoda")

# 终端按钮
ctx.set_source_rgb(1, 0, 0)
ctx.arc(130, 280, 12, 0, 2 * 3.14159)
ctx.fill()

ctx.set_source_rgb(1, 1, 0)
ctx.arc(160, 280, 12, 0, 2 * 3.14159)
ctx.fill()

ctx.set_source_rgb(0, 1, 0)
ctx.arc(190, 280, 12, 0, 2 * 3.14159)
ctx.fill()

# 保存为 PNG
surface.write_to_png("assets/icon.png")
print("Icon created: assets/icon.png")
EOF

# 如果有 Python3 和 cairo，运行脚本
if command -v python3 &> /dev/null && python3 -c "import cairo" &> /dev/null; then
    python3 assets/icon.png
    rm assets/icon.png
    mv assets/icon.png assets/icon_temp.png 2>/dev/null || true
else
    echo "需要安装 Python3 和 pycairo 来生成图标"
    echo "运行: pip3 install pycairo"
fi

echo "图标生成脚本已创建"