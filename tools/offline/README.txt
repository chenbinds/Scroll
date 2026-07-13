Optional offline packages for electron-builder (slow GitHub downloads).

Place these .7z files in this folder BEFORE running pack.bat:

  nsis-3.0.4.1.7z
  nsis-resources-3.4.1.7z

winCodeSign is NOT required — pack script disables code signing.

Download mirrors (browser):
  https://npmmirror.com/mirrors/electron-builder-binaries/

GitHub originals:
  https://github.com/electron-userland/electron-builder-binaries/releases

If you dropped winCodeSign*.7z in the project root, pack.bat moves it here automatically.
