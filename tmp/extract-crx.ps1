param(
    [string]$ProjectRoot = "C:\Users\Administrator\Desktop\myProjects\tansaction-popup"
)

$crxPath = Join-Path $ProjectRoot "src\renderer\assets\extensions\grammarly\grammarly.crx"
$extBaseDir = Join-Path $ProjectRoot "src\renderer\assets\extensions\grammarly"
$oldFolder = Join-Path $extBaseDir "14.1275.0_0"

# Read CRX bytes
$crxBytes = [System.IO.File]::ReadAllBytes($crxPath)
Write-Host "CRX file size: $($crxBytes.Length) bytes"

# Find ZIP header (PK = 0x50 0x4B 0x03 0x04)
$zipStart = -1
$len = $crxBytes.Length - 4
for ($i = 0; $i -lt $len; $i++) {
    if ($crxBytes[$i] -eq 0x50 -and $crxBytes[$i+1] -eq 0x4B -and $crxBytes[$i+2] -eq 0x03 -and $crxBytes[$i+3] -eq 0x04) {
        $zipStart = $i
        break
    }
}

if ($zipStart -eq -1) {
    Write-Error "ZIP signature not found in CRX file"
    exit 1
}
Write-Host "ZIP data starts at byte offset: $zipStart"

# Write ZIP portion to temp file
$zipPath = Join-Path $extBaseDir "grammarly_temp.zip"
$zipBytes = $crxBytes[$zipStart..($crxBytes.Length - 1)]
[System.IO.File]::WriteAllBytes($zipPath, $zipBytes)
Write-Host "ZIP temp file written: $($zipBytes.Length) bytes"

# Extract ZIP to temp folder
$extractPath = Join-Path $extBaseDir "extracted_new"
if (Test-Path $extractPath) { Remove-Item $extractPath -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
Write-Host "Extracted to: $extractPath"

# Clean up zip temp
Remove-Item $zipPath -Force

# Read version from manifest
$manifestPath = Join-Path $extractPath "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$mv = $manifest.manifest_version
Write-Host "Extension version: $version  manifest_version: $mv"

# Destination folder: version_0
$destFolder = Join-Path $extBaseDir "${version}_0"
Write-Host "Destination folder: $destFolder"

# Remove old extension folder
if (Test-Path $oldFolder) {
    Remove-Item $oldFolder -Recurse -Force
    Write-Host "Removed old folder: $oldFolder"
}

# Remove existing new-version folder if it exists
if (Test-Path $destFolder) {
    Remove-Item $destFolder -Recurse -Force
    Write-Host "Removed existing: $destFolder"
}

# Move extracted folder to final destination
Move-Item $extractPath $destFolder
Write-Host "Installed new extension to: $destFolder"

# Output version for use in config update
Write-Host "GRAMMARLY_VERSION=$version"
