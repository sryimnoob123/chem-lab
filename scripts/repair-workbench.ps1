# Repair double-encoded UTF-8 in app/exp/[id]/workbench.tsx  (pass 2: lossy lines)
#
# Pass 1 (strict) already restored 39 lines. The remaining broken lines contain GBK-invalid byte
# sequences, so strict UTF-8 decoding throws. For those we do a LOOSE decode and keep the result
# only when it looks like real text rather than garbage.
#
# How we tell a mojibake line from a healthy Chinese line, without any Chinese literal:
#   GBK-encode the line, then UTF-8 decode it loosely and count U+FFFD.
#     - mojibake line  -> few U+FFFD   (only the truly lost bytes)  -> adopt
#     - healthy Chinese -> almost every byte pair is invalid -> U+FFFD dominates -> keep original
#   Threshold: adopt when replacement chars are under 30% of the decoded length.
#
# .NET APIs with explicit UTF-8 (no BOM) only. Never Set-Content / Out-File / pipe redirection.

$ErrorActionPreference = "Stop"

$path = "app/exp/[id]/workbench.tsx"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
$gbk = [System.Text.Encoding]::GetEncoding(936)
$replacement = [char]0xFFFD

$lines = [System.IO.File]::ReadAllLines($path, $utf8)
Write-Output ("total lines: " + $lines.Count)

$strictOk = 0
$looseOk = 0
$lossyOk = 0
$untouched = 0
$out = New-Object System.Collections.Generic.List[string]

foreach ($line in $lines) {
    $bytes = $gbk.GetBytes($line)

    # 1) strict round-trip: fully reversible
    $strict = $null
    try { $strict = $strictUtf8.GetString($bytes) } catch { $strict = $null }
    if ($null -ne $strict -and $strict -ne $line) {
        $out.Add($strict); $strictOk++; continue
    }

    # 2) loose round-trip: adopt only if the result is mostly clean text
    $loose = $utf8.GetString($bytes)
    if ($loose -ne $line -and $loose.Length -gt 0) {
        $bad = 0
        foreach ($ch in $loose.ToCharArray()) { if ($ch -eq $replacement) { $bad++ } }
        $ratio = $bad / $loose.Length
        if ($ratio -lt 0.3) {
            $out.Add($loose); $looseOk++
            if ($bad -gt 0) { $lossyOk++ }
            continue
        }
    }

    $out.Add($line); $untouched++
}

Write-Output ("strict restored : " + $strictOk)
Write-Output ("loose restored  : " + $looseOk + "  (with lost chars: " + $lossyOk + ")")
Write-Output ("untouched       : " + $untouched)

Write-Output "--- preview lines 74..99 ---"
for ($i = 73; $i -lt 99; $i++) { Write-Output ("  [" + ($i + 1) + "] " + $out[$i]) }

[System.IO.File]::WriteAllLines("$path.repaired", $out, $utf8)
Write-Output ("written: " + $path + ".repaired")
