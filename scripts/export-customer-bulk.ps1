param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile,[string]$PreviewFile)
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
 if($PreviewFile){
  # Read only the customer report; preserve the protected original file for download.
  $taskLast=5+$taskRows.Count
  $taskData=$taskSheet.Range($taskSheet.Cells.Item(1,1),$taskSheet.Cells.Item($taskLast,45)).Value2
  $taskPreviewRows=New-Object 'System.Collections.Generic.List[object]'
  for($taskR=1;$taskR -le $taskLast;$taskR++){
   $taskLine=New-Object 'object[]' 45
   for($taskC=1;$taskC -le 45;$taskC++){$taskLine[$taskC-1]=$taskData[$taskR,$taskC]}
   $taskPreviewRows.Add($taskLine)
  }
  $taskFormats=New-Object 'System.Collections.Generic.List[string]'
  $taskStyles=@{};$taskMerges=New-Object 'System.Collections.Generic.HashSet[string]'
  for($taskC=1;$taskC -le 45;$taskC++){
   $taskFormats.Add([string]$taskSheet.Cells.Item(6,$taskC).NumberFormat)
   for($taskR=1;$taskR -le 6;$taskR++){
    $taskCell=$taskSheet.Cells.Item($taskR,$taskC)
    $taskAddress=$taskCell.Address($false,$false)
    $taskBgr=[int]$taskCell.Interior.Color
    $taskFill='{0:X2}{1:X2}{2:X2}' -f ($taskBgr -band 255),(($taskBgr -shr 8) -band 255),(($taskBgr -shr 16) -band 255)
    $taskBgr=[int]$taskCell.Font.Color
    $taskFont='{0:X2}{1:X2}{2:X2}' -f ($taskBgr -band 255),(($taskBgr -shr 8) -band 255),(($taskBgr -shr 16) -band 255)
    $taskStyles[$taskAddress]=@{fill=$taskFill;color=$taskFont}
    if($taskR -le 5 -and $taskCell.MergeCells){[void]$taskMerges.Add($taskCell.MergeArea.Address($false,$false))}
   }
  }
  @{name='CURRENT BULK';values=$taskPreviewRows.ToArray();formats=$taskFormats.ToArray();merges=@($taskMerges);styles=$taskStyles} | ConvertTo-Json -Depth 8 -Compress | Set-Content -LiteralPath $PreviewFile -Encoding UTF8
 }
 $taskBook.SaveCopyAs($OutputFile)
 if(-not (Test-Path -LiteralPath $OutputFile)){throw '原表匯出未完成。'}
 Write-Output 'Customer template exported through Excel; protection, sheets and formulas retained.'
} finally {
 if($taskBook){$taskBook.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskBook)}
 if($taskExcel){$taskExcel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskExcel)}
}
