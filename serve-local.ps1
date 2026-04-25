param(
    [int]$Port = 4173
)

$projectRoot = Split-Path -Parent $PSCommandPath

$candidates = @(
    "C:\Users\sondr\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
if ($pyLauncher) {
    $candidates += $pyLauncher.Source
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $candidates += $pythonCommand.Source
}

$pythonPath = $candidates |
    Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
    Select-Object -First 1

if (-not $pythonPath) {
    throw "Fant ikke en Python-runtime som kan starte lokal server."
}

Write-Host "Serveren starter paa http://localhost:$Port/"
Write-Host "Trykk Ctrl+C for aa stoppe serveren."

& $pythonPath -m http.server $Port --directory $projectRoot
