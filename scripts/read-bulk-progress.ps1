$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskSource=Join-Path $taskRoot 'CSQ參考資料/訂單追蹤/BULK_STATUS_SPORTSKITE_PILOT.xlsx.xlsx'
$taskExcel=New-Object -ComObject Excel.Application
$taskExcel.Visible=$false
$taskExcel.DisplayAlerts=$false
try {
 $taskBook=$taskExcel.Workbooks.Open($taskSource,0,$true)
 try {
  $taskValues=$taskBook.Worksheets.Item('CURRENT BULK').UsedRange.Value2
  $taskRows=@()
  for($taskRow=1;$taskRow -le $taskValues.GetLength(0);$taskRow++){
   $taskCells=@()
   for($taskCol=1;$taskCol -le $taskValues.GetLength(1);$taskCol++){$taskCells+=,$taskValues[$taskRow,$taskCol]}
   $taskRows+=,$taskCells
  }
  $taskWork=Join-Path $taskRoot 'work'
  New-Item -ItemType Directory -Path $taskWork -Force | Out-Null
  $taskResult=@{source='CSQ參考資料/訂單追蹤/BULK_STATUS_SPORTSKITE_PILOT.xlsx.xlsx';rows=$taskRows}
  [System.IO.File]::WriteAllText((Join-Path $taskWork 'bulk-original-pilot.json'),($taskResult|ConvertTo-Json -Depth 8),[System.Text.UTF8Encoding]::new($false))
 } finally {$taskBook.Close($false)}
} finally {$taskExcel.Quit()}
