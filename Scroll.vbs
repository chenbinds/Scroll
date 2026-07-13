Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
exe = root & "\node_modules\electron\dist\electron.exe"
app = root & "\out\main\index.js"
If Not fso.FileExists(exe) Then
    MsgBox "Electron not found. Run install.bat first.", 48, "Scroll"
    WScript.Quit 1
End If
If Not fso.FileExists(app) Then
    MsgBox "App not built. Run rebuild.bat first.", 48, "Scroll"
    WScript.Quit 1
End If
' Launch Electron directly (no cmd.exe wrapper — faster startup)
shell.Run """" & exe & """ """ & app & """", 1, False
