param (
    [string]$DocxPath,
    [string]$OutputPath
)

Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($DocxPath)
    $entry = $zip.GetEntry("word/document.xml")
    if ($null -ne $entry) {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $xml = $reader.ReadToEnd()
        $reader.Close()
        
        # Simple regex to strip XML tags and leave text
        $text = $xml -replace '<w:p[^>]*>', "`r`n" -replace '<[^>]+>', ''
        $text = $text -replace '&amp;', '&' -replace '&lt;', '<' -replace '&gt;', '>' -replace '&quot;', '"'
        
        Set-Content -Path $OutputPath -Value $text -Encoding UTF8
        Write-Host "Success: Extracted text to $OutputPath"
    } else {
        Write-Host "Error: word/document.xml not found in archive."
    }
} catch {
    Write-Host "Error: $_"
} finally {
    if ($null -ne $zip) { $zip.Dispose() }
}
