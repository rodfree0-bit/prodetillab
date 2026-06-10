# ocr_candidates.ps1
# Runs built-in Windows OCR on cropped candidates using compiled C# helper

$Source = @"
using System;
using System.IO;
using System.Threading.Tasks;
using Windows.Storage;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;

public class WinOcr {
    public static string Recognize(string filePath) {
        try {
            return Task.Run(async () => {
                var file = await StorageFile.GetFileFromPathAsync(filePath);
                using (var stream = await file.OpenAsync(FileAccessMode.Read)) {
                    var decoder = await BitmapDecoder.CreateAsync(stream);
                    var bitmap = await decoder.GetSoftwareBitmapAsync();
                    var engine = OcrEngine.TryCreateFromUserProfileLanguages();
                    if (engine == null) return "ENGINE_FAILED";
                    var ocrResult = await engine.RecognizeAsync(bitmap);
                    return ocrResult.Text;
                }
            }).GetAwaiter().GetResult();
        } catch (Exception ex) {
            return "ERROR: " + ex.Message;
        }
    }
}
"@

# Load WinRT assemblies in PowerShell
[void][Windows.Security.Cryptography.CryptographicBuffer, Windows.Security.Cryptography, ContentType=WindowsRuntime]
[void][Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
[void][Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
[void][Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]

Add-Type -TypeDefinition $Source

$candidatesDir = "C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\scratch\candidates"
$outputFile = "C:\Users\cramr\OneDrive\Documents\My-Carwash-app-\scratch\ocr_results.json"

$files = Get-ChildItem -Path $candidatesDir -Filter "*.jpg"
Write-Output "Running OCR on $($files.Count) candidates..."

$results = @{}

foreach ($f in $files) {
    $absPath = $f.FullName
    $text = [WinOcr]::Recognize($absPath)
    if (![string]::IsNullOrWhiteSpace($text) -and !$text.StartsWith("ERROR:") -and !$text.StartsWith("ENGINE_FAILED")) {
        $cleanedText = $text -replace '[^A-Za-z0-9]', ''
        if ($cleanedText.Length -ge 2) {
            Write-Output "File: $($f.Name) -> OCR Text: $text (Cleaned: $cleanedText)"
            $results[$f.Name] = @{
                text = $text
                cleaned = $cleanedText
            }
        }
    } else {
        if ($text.StartsWith("ERROR:")) {
            Write-Output "Error on $($f.Name): $text"
        }
    }
}

$resultsJson = $results | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outputFile, $resultsJson)
Write-Output "OCR complete. Saved results to $outputFile"
