# Native Windows speech-recognition helper for Tesh.
# Uses Windows' System.Speech engine locally and emits machine-readable lines.
Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$recognizer.SetInputToDefaultAudioDevice()
$recognizer.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))

$recognizer.add_SpeechRecognized({
    param($sender, $event)
    $text = ($event.Result.Text -replace "`r|`n", " ").Trim()
    if ($text.Length -gt 0) { Write-Output ("FINAL`t" + $text); [Console]::Out.Flush() }
})
$recognizer.add_RecognizeCompleted({
    param($sender, $event)
    if ($event.Error) {
        Write-Output ("ERROR`t" + $event.Error.Message)
        [Console]::Out.Flush()
    }
})

Write-Output "READY"
[Console]::Out.Flush()
$recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

try {
    while ($true) {
        $line = [Console]::ReadLine()
        if ($null -eq $line -or $line -eq "STOP") { break }
    }
} finally {
    try { $recognizer.RecognizeAsyncCancel() } catch {}
    try { $recognizer.Dispose() } catch {}
}
