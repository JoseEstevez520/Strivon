#!/bin/sh
# Stills and clips of the two videos in the web deck, cut the way the slides show them.
# Run from the folder that holds these scripts. FFMPEG is a full ffmpeg (the one in imageio-ffmpeg works).
V=../../web-deck/vid
mkdir -p frames
"$FFMPEG" -y -ss 7.9 -i $V/store-3d.mp4 -frames:v 1 -vf "crop=1410:1015:260:30" frames/store.png
"$FFMPEG" -y -ss 8.3 -i $V/chat-to-gondola.mp4 -frames:v 1 frames/chat.png
"$FFMPEG" -y -i $V/store-3d.mp4 -vf "crop=1410:1015:260:30" -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -an -movflags +faststart frames/store-clip.mp4
cp $V/chat-to-gondola.mp4 frames/chat-clip.mp4
