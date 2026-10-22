' ============================================================
' Parrot Office — lanzador (Windows, sin ventana de consola)
' ------------------------------------------------------------
' 1) arranca el servidor del chat de Orión si no está corriendo
' 2) abre la suite en modo app (ventana propia, sin barra del
'    navegador), con un perfil dedicado de Chrome
'
' Este archivo es una PLANTILLA: el instalador (instalar.ps1)
' copia una versión con la ruta real de tu PC escrita adentro.
' Si moviste la carpeta, volvé a correr instalar.ps1.
' ============================================================
Dim sh, fso, wmi, proceso, chrome, args
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' --- ruta de la carpeta de Parrot Office (la ajusta el instalador) ---
base = fso.GetParentFolderName(WScript.ScriptFullName)
If Not fso.FolderExists(base & "\index.html") Then
    ' si el .vbs quedó en el escritorio, buscar la carpeta junto al acceso
    base = "C:\Parrot-Office"
End If

perfil = CreateObject("WScript.Shell").ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\ParrotOffice\perfil"

' --- ¿ya está corriendo el chat? (buscamos node con parrot-chat.js) ---
yaCorriendo = False
On Error Resume Next
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
If Not wmi Is Nothing Then
    For Each proceso In wmi.ExecQuery("Select * from Win32_Process Where Name='node.exe'")
        If InStr(proceso.CommandLine, "parrot-chat.js") > 0 Then yaCorriendo = True
    Next
End If
On Error GoTo 0

If Not yaCorriendo Then
    ' 0 = ventana oculta, False = no espera
    sh.Run "node """ & base & "\parrot-chat.js""", 0, False
End If

' --- abrir la suite en modo app ---
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
args = "--app=file:///" & base & "/index.html" & _
       " --user-data-dir=""" & perfil & """" & _
       " --window-size=1400,900"
sh.Run """" & chrome & """ " & args, 1, False
