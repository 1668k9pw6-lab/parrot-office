# ============================================================
# Parrot Office — instalador para Windows
# ------------------------------------------------------------
# Crea el acceso "Parrot Office" en el escritorio, que abre la
# suite como aplicación de ventana propia (sin barra del
# navegador) y arranca el servidor del chat de Orión si hace
# falta. No copia ni mueve nada: trabaja sobre esta carpeta.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File instalar.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$raiz = $PSScriptRoot
if (-not (Test-Path (Join-Path $raiz 'index.html'))) {
    Write-Host 'No encuentro index.html junto a este script. Copia la carpeta completa de Parrot Office y volvé a ejecutar.' -ForegroundColor Red
    exit 1
}

$escritorio = [Environment]::GetFolderPath('Desktop')
$vbs = Join-Path $escritorio 'Parrot Office.vbs'

# --- acceso del escritorio (.vbs con la ruta real de esta PC) ---
$contenido = @"
' Parrot Office - lanzador (generado por instalar.ps1)
Dim sh, fso, wmi, proceso, chrome, args
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

base = "$raiz"
perfil = CreateObject("WScript.Shell").ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\ParrotOffice\perfil"

' arrancar el chat de Orion si no esta corriendo
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
    sh.Run "node """ & base & "\parrot-chat.js""", 0, False
End If

' abrir la suite en modo app
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chrome) Then
    MsgBox "No encontré Google Chrome." & vbCrLf & "Instalá Chrome desde google.com/chrome y volvé a probar, o abrí index.html con doble clic.", vbExclamation, "Parrot Office"
    WScript.Quit
End If
args = "--app=file:///" & base & "/index.html" & _
       " --user-data-dir=""" & perfil & """" & _
       " --window-size=1400,900"
sh.Run """" & chrome & """ " & args, 1, False
"@

Set-Content -Path $vbs -Value $contenido -Encoding ASCII
Write-Host "Acceso creado: $vbs" -ForegroundColor Green

# --- acceso en el menú Inicio (opcional, silencioso si falla) ---
try {
    $menu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    if (Test-Path $menu) {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut((Join-Path $menu 'Parrot Office.lnk'))
        $lnk.TargetPath = $vbs
        $lnk.WorkingDirectory = $raiz
        $lnk.Description = 'Parrot Office - suite de oficina propia'
        $lnk.Save()
        Write-Host 'Acceso creado también en el menú Inicio.' -ForegroundColor Green
    }
} catch {
    Write-Host '(no pude crear el acceso del menú Inicio; el del escritorio alcanza)' -ForegroundColor DarkYellow
}

# --- comprobaciones amables ---
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host ''
    Write-Host 'Aviso: no encontré Node.js. La suite funciona igual (abrila con doble clic);' -ForegroundColor DarkYellow
    Write-Host 'Node solo hace falta para el chat completo con Orión (modo local funciona sin él).' -ForegroundColor DarkYellow
}

$claves = Join-Path $raiz 'claves-publicas.txt'
Write-Host ''
Write-Host 'Listo. Abrí "Parrot Office" desde el escritorio.' -ForegroundColor Cyan
Write-Host "La primera vez te pide una clave: están en $claves" -ForegroundColor Cyan
