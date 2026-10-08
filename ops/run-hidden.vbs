Option Explicit
Dim shell, files, program, script, result
If WScript.Arguments.Count <> 2 Then WScript.Quit 2
program = WScript.Arguments(0)
script = WScript.Arguments(1)
Set files = CreateObject("Scripting.FileSystemObject")
If Not files.FileExists(program) Or Not files.FileExists(script) Then WScript.Quit 2
If InStr(program, Chr(34)) > 0 Or InStr(script, Chr(34)) > 0 Then WScript.Quit 2
Set shell = CreateObject("WScript.Shell")
' Window style 0 hides the child from creation, rather than hiding a console
' after PowerShell has already opened it. Wait so Task Scheduler gets its exit code.
result = shell.Run(Chr(34) & program & Chr(34) & " " & Chr(34) & script & Chr(34), 0, True)
WScript.Quit result
