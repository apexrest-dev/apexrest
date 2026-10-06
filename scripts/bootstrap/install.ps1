# APEXREST local bootstrap. Windows 11 x64 profile requires platform CI evidence.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Bundle,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$Sha256,
  [switch]$Yes,[switch]$Offline,[Alias('Home')][string]$InstallHome,[string]$CodexHome,
  [switch]$AcceptOracleLicense,[switch]$NativeOnly,[switch]$DryRun,[switch]$NonInteractive,
  [switch]$SkipBrowser,[string]$CacheDir,[string]$Version,[ValidateSet('user','project')][string]$Scope='user',
  [string]$Manifest,[string]$PublicKey
)
$ErrorActionPreference = 'Stop'
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'UNSUPPORTED_PLATFORM: Windows x64 is required.' }
$apexrestRoot = if ($InstallHome) { $InstallHome } elseif ($env:APEXREST_HOME) { $env:APEXREST_HOME } else { Join-Path $env:USERPROFILE '.apexrest' }
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCmd) { $nodeCmd.Source } else { $null }
if (!$nodePath -or (& $nodePath -p 'process.versions.node') -ne '24.21.0') {
  if ($DryRun) { Write-Output '{"status":"planned","action":"install pinned user-local Node 24 before package setup"}'; exit 0 }
  if (!$Yes) { throw 'SETUP_APPROVAL_REQUIRED: use -Yes after reviewing -DryRun.' }
  $nodeVersion = '24.21.0'
  $runtime = Join-Path $apexrestRoot "bootstrap/node-v$nodeVersion-win-x64"
  $nodePath = Join-Path $runtime 'node.exe'
  if (!(Test-Path $nodePath)) {
    $cacheRoot = if ($CacheDir) { $CacheDir } else { Join-Path $apexrestRoot "cache" }
    $cache = Join-Path $cacheRoot "node-v$nodeVersion-win-x64.zip"
    New-Item -ItemType Directory -Force (Split-Path $cache) | Out-Null
    if (!(Test-Path $cache)) {
      if ($Offline) { throw 'OFFLINE_CACHE_MISS: Node archive is absent.' }
      Invoke-WebRequest -Uri "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip" -MaximumRedirection 0 -OutFile "$cache.part"
      Move-Item "$cache.part" $cache
    }
    if ((Get-FileHash $cache -Algorithm SHA256).Hash.ToLowerInvariant() -ne '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541') { Remove-Item -Force $cache; throw "Node archive integrity failure; removed corrupt cache: $cache" }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($cache)
    try { foreach ($entry in $archive.Entries) { if ($entry.FullName -match '(^[/\\]|(^|[/\\])\.\.([/\\]|$)|^[A-Za-z]:)') { throw 'Unsafe archive entry.' } } } finally { $archive.Dispose() }
    $stage = Join-Path $apexrestRoot ('bootstrap/stage-' + [guid]::NewGuid())
    Expand-Archive -LiteralPath $cache -DestinationPath $stage
    New-Item -ItemType Directory -Force (Split-Path $runtime) | Out-Null
    Move-Item (Join-Path $stage "node-v$nodeVersion-win-x64") $runtime
    Remove-Item $stage
  }
}
$parameters = @('--bundle',$Bundle,'--sha256',$Sha256,'--home',$apexrestRoot)
if ($Yes) { $parameters += '--yes' }; if ($Offline) { $parameters += '--offline' }
if ($CodexHome) { $parameters += @('--codex-home',$CodexHome) }
if ($AcceptOracleLicense) { $parameters += '--accept-oracle-license' }; if ($NativeOnly) { $parameters += '--native-only' }
if ($DryRun) { $parameters += '--dry-run' }; if ($NonInteractive) { $parameters += '--non-interactive' }
if ($SkipBrowser) { $parameters += '--skip-browser' }; if ($CacheDir) { $parameters += @('--cache-dir',$CacheDir) }
if ($Version) { $parameters += @('--version',$Version) }; $parameters += @('--scope',$Scope)
if ($Manifest) { $parameters += @('--manifest',$Manifest,'--public-key',$PublicKey) }
& $nodePath --use-env-proxy (Join-Path $PSScriptRoot 'bootstrap-runtime.mjs') @parameters
exit $LASTEXITCODE
