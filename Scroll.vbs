Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root

' Daily path: always prefer electron + out/ when available.
' Packaged release\win-unpacked is for pack.bat / explicit testing only —
' flipping between them used different UserData folders and "lost" the shelf.
packaged = root & "\release\win-unpacked\Scroll.exe"
devExe = root & "\node_modules\electron\dist\electron.exe"
devApp = root & "\out\main\index.js"

If fso.FileExists(devExe) And fso.FileExists(devApp) Then
    shell.Run """" & devExe & """ """ & devApp & """", 1, False
    WScript.Quit 0
End If

If fso.FileExists(packaged) Then
    shell.Run """" & packaged & """", 1, False
    WScript.Quit 0
End If

If Not fso.FileExists(devExe) Then
    MsgBox "Electron not found. Run install.bat first.", 48, "Scroll"
    WScript.Quit 1
End If

MsgBox "App not built. Run rebuild.bat first.", 48, "Scroll"
WScript.Quit 1
