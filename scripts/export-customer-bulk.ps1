param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskTemplate=Join-Path $taskRoot 'CSQ參考資料/訂單追蹤/BULK_STATUS_SPORTSKITE_PILOT.xlsx.xlsx'
$taskPayload=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskRows=@($taskPayload.rows)
if($taskRows.Count -gt 995){throw '原表最多容納 995 筆明細，請縮小篩選範圍後再匯出。'}
foreach($taskRow in $taskRows){if($taskRow.Count -ne 45){throw '客戶進度欄位數不符。'}}
$taskExcel=$null;$taskBook=$null
try {
 $taskExcel=New-Object -ComObject Excel.Application
 $taskExcel.Visible=$false;$taskExcel.DisplayAlerts=$false;$taskExcel.AskToUpdateLinks=$false
 $taskBook=$taskExcel.Workbooks.Open($taskTemplate,0,$true)
 $taskSheet=$taskBook.Worksheets.Item('CURRENT BULK')
 if($taskSheet.Cells.Item(5,3).Text -ne 'STYLE' -or $taskSheet.Cells.Item(5,32).Text -ne 'RESULT – AUTO'){throw '客戶原表版本與輸出欄位不符。'}
 # Use only the template's editable input blocks. Never unprotect or overwrite AF formulas.
 foreach($taskBlock in @(@{First=1;Last=31},@{First=33;Last=45})){
  $taskRange=$taskSheet.Range($taskSheet.Cells.Item(6,$taskBlock.First),$taskSheet.Cells.Item(1000,$taskBlock.Last))
  if($taskRange.Locked -ne $false -or $taskRange.HasFormula -ne $false){throw '輸入範圍包含受保護欄位或公式，未修改保護設定。'}
  $taskRange.ClearContents()
  if($taskRows.Count){
   $taskWidth=$taskBlock.Last-$taskBlock.First+1
   $taskValues=New-Object 'object[,]' $taskRows.Count,$taskWidth
   for($taskR=0;$taskR -lt $taskRows.Count;$taskR++){for($taskC=0;$taskC -lt $taskWidth;$taskC++){
    $taskValue=$taskRows[$taskR][$taskBlock.First+$taskC-1]
    if($null -eq $taskValue){$taskValue=''}
    elseif($taskValue -is [ValueType]){$taskValue=[double]$taskValue}
    elseif($taskValue -is [string] -and $taskValue -match '^[=+@-]'){$taskValue="'"+$taskValue}
    $taskValues[$taskR,$taskC]=$taskValue
   }}
   $taskSheet.Range($taskSheet.Cells.Item(6,$taskBlock.First),$taskSheet.Cells.Item(5+$taskRows.Count,$taskBlock.Last)).Value2=$taskValues
  }
 }
 $taskWeekCell=$taskBook.Worksheets.Item('CONTROL').Cells.Item(4,4)
 if($taskWeekCell.Locked -eq $false -and $taskWeekCell.HasFormula -eq $false){$taskWeekCell.Value2=[double]$taskPayload.week}
 $taskExcel.CalculateFull()
 $taskBook.SaveCopyAs($OutputFile)
 if(-not (Test-Path -LiteralPath $OutputFile)){throw '原表匯出未完成。'}
 Write-Output 'Customer template exported through Excel; protection, sheets and formulas retained.'
} finally {
 if($taskBook){$taskBook.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskBook)}
 if($taskExcel){$taskExcel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskExcel)}
}
