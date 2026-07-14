import { app } from 'electron'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'

/**
 * Packaged builds keep all user data beside Scroll.exe (true portable folder).
 * Dev / unpackaged builds still use the default Electron userData (AppData).
 */
function configurePortableUserData(): void {
  if (!app.isPackaged) return

  const appDir = dirname(process.execPath)
  const userDataDir = join(appDir, 'UserData')
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true })
  }
  app.setPath('userData', userDataDir)
}

configurePortableUserData()
