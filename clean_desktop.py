#!/usr/bin/env python3
''' A script that cleans up your desktop and
sorts them into the correct directory based on what type of file they are '''

# Import the required modules
import os
import mimetypes
import shutil
from rich.console import Console
import time

console = Console()

print(r"""
   ___ _                       ___          _    _
  / __\ | ___  __ _ _ __      /   \___  ___| | _| |_ ___  _ __
 / /  | |/ _ \/ _` | '_ \    / /\ / _ \/ __| |/ / __/ _ \| '_ \
/ /___| |  __/ (_| | | | |  / /_//  __/\__ \   <| || (_) | |_) |
\____/|_|\___|\__,_|_| |_| /___,' \___||___/_|\_\\__\___/| .__/
                                                         |_|
""")

# Specify the different paths
home = os.path.expanduser('~')
desktop = os.path.join(home, 'Desktop')
audio_path = os.path.join(home, 'Music')
documents_path = os.path.join(home, 'Documents')
videos_path = os.path.join(home,'Movies')
photos_path = os.path.join(home, 'Pictures')

with console.status(f"🔍 Reading files located in {desktop} ...", spinner='star'):
    time.sleep(4)
print('')

# Close the script if there's no files on the desktop
if not os.listdir(desktop):
    print('✅ Nothing to cleanup! Closing script.')
    time.sleep(1)
    exit()

# Reading in the files located on the desktop and sort them into the correct path
# Depending on what kind of file type it is.
for file in os.listdir(desktop):
    mime, _ = mimetypes.guess_type(file)

    if mime is None:
        time.sleep(1)
        print(f'❓ {file} type not found - keeping it on desktop.')
        continue

    category = mime.split("/")[0]

    if category == 'audio':
        shutil.move(os.path.join(desktop, file), os.path.join(audio_path, file))
        time.sleep(1)
        print(f'🎵 {file} moved to {audio_path}')
    elif category == 'text':
        shutil.move(os.path.join(desktop, file), os.path.join(documents_path, file))
        time.sleep(1)
        print(f'📄 {file} moved to {documents_path}')
    elif category == 'video':
        shutil.move(os.path.join(desktop, file), os.path.join(videos_path, file))
        time.sleep(1)
        print(f'🎬 {file} moved to {videos_path}')
    elif category == 'image':
        shutil.move(os.path.join(desktop, file), os.path.join(photos_path, file))
        time.sleep(1)
        print(f'🖼️  {file} moved to {photos_path}')
    else:
        time.sleep(1)
        print(f'❓ {file} type not found - keeping it on desktop.')

print('')
print('🧹 Desktop cleaned up!')
