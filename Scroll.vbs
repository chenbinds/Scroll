Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root

' Prefer packaged exe (faster cold start, no node_modules scan)
packaged = root & "\release\Scroll.exe"
devExe = root & "\node_modules\electron\dist\electron.exe"
devApp = root & "\out\main\index.js"

If fso.FileExists(packaged) Then
    shell.Run """" & packaged & """", 1, False
    WScript.Quit 0
End If

If Not fso.FileExists(devExe) Then
    MsgBox "Electron not found. Run install.bat first.", 48, "Scroll"
    WScript.Quit 1
End If
If Not fso.FileExists(devApp) Then
    MsgBox "App not built. Run rebuild.bat first.", 48, "Scroll"
    WScript.Quit 1
End If

' Dev path: launch Electron directly (no cmd.exe wrapper)
shell.Run """" & devExe & """ """ & devApp & """", 1, False
