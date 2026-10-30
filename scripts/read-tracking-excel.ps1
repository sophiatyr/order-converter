param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
$taskExcel=$null;$taskBook=$null
try {
 $taskExcel=New-Object -ComObject Excel.Application
 $taskExcel.Visible=$false;$taskExcel.DisplayAlerts=$false;$taskExcel.AskToUpdateLinks=$false
 $taskExcel.AutomationSecurity=3
 $taskExcel.EnableEvents=$false
 $taskBook=$taskExcel.Workbooks.Open($InputFile,0,$true)
 $taskSheets=@{}
 foreach($taskName in @('CSQ','CURRENT BULK')){
  $taskSheet=$null
  foreach($taskCandidate in $taskBook.Worksheets){if($taskCandidate.Name -eq $taskName){$taskSheet=$taskCandidate;break}}
  if(-not $taskSheet){continue}
  $taskLast=[Math]::Min(10001,$taskSheet.UsedRange.Row+$taskSheet.UsedRange.Rows.Count-1)
  if($taskLast -gt 10000){throw 'Too many rows'}
  $taskWidth=if($taskName -eq 'CSQ'){46}else{45}
  $taskRange=$taskSheet.Range($taskSheet.Cells.Item(1,1),$taskSheet.Cells.Item($taskLast,$taskWidth))
  $taskValues=$taskRange.Value2
  # Template formulas extend to row 1000. Only materialized order rows belong to the import.
  $taskFirst=if($taskName -eq 'CSQ'){5}else{6}
  $taskIdentity=if($taskName -eq 'CSQ'){@(1,2,15)}else{@(3,4,5)}
  $taskDataLast=$taskFirst-1
  for($taskR=$taskFirst;$taskR -le $taskLast;$taskR++){foreach($taskC in $taskIdentity){if($null -ne $taskValues[$taskR,$taskC] -and [string]$taskValues[$taskR,$taskC] -ne ''){$taskDataLast=$taskR;break}}}
  $taskLast=$taskDataLast
  $taskCells=@{'!ref'="A1:AT$taskLast"};$taskMerges=New-Object 'System.Collections.Generic.List[object]';$taskMergeSeen=@{}
  $taskFormulaCells=@{}
  if($taskLast -ge $taskFirst){for($taskC=1;$taskC -le $taskWidth;$taskC++){
   $taskColumn=$taskSheet.Range($taskSheet.Cells.Item($taskFirst,$taskC),$taskSheet.Cells.Item($taskLast,$taskC))
   $taskHasFormula=$taskColumn.HasFormula
   if($taskHasFormula -eq $true){for($taskR=$taskFirst;$taskR -le $taskLast;$taskR++){$taskFormulaCells["$taskR,$taskC"]=$true}}
   elseif($taskHasFormula -ne $false){for($taskR=$taskFirst;$taskR -le $taskLast;$taskR++){if($taskSheet.Cells.Item($taskR,$taskC).HasFormula){$taskFormulaCells["$taskR,$taskC"]=$true}}}
  }}
  $taskLetters=@{};for($taskC=1;$taskC -le $taskWidth;$taskC++){if($taskC -le 26){$taskLetters[$taskC]=[string][char](64+$taskC)}else{$taskLetters[$taskC]='A'+[char](64+$taskC-26)}}
  for($taskR=1;$taskR -le $taskLast;$taskR++){
   $taskRowRange=$taskSheet.Range($taskSheet.Cells.Item($taskR,1),$taskSheet.Cells.Item($taskR,$taskWidth))
   $taskHasMerges=$taskRowRange.MergeCells -ne $false
   for($taskC=1;$taskC -le $taskWidth;$taskC++){
   $taskValue=$taskValues[$taskR,$taskC];if($null -eq $taskValue){continue}
   $taskAddress=$taskLetters[$taskC]+$taskR
   $taskCell=@{v=$taskValue;t=if($taskValue -is [string]){'s'}else{'n'}}
   # Protected sheets may hide formula text. Only expose a formula marker, never extract hidden formulas.
   if($taskFormulaCells.ContainsKey("$taskR,$taskC")){$taskCell.f='FORMULA'}
   if($taskValue -is [Runtime.InteropServices.ErrorWrapper]){$taskCell.t='e';$taskCell.v='Excel error'}
   $taskCells[$taskAddress]=$taskCell
   if($taskHasMerges){$taskNative=$taskSheet.Cells.Item($taskR,$taskC);if($taskNative.MergeCells){$taskArea=$taskNative.MergeArea;$taskKey=$taskArea.Address($false,$false);if(-not $taskMergeSeen.ContainsKey($taskKey)){$taskMergeSeen[$taskKey]=$true;$taskMerges.Add(@{s=@{r=$taskArea.Row-1;c=$taskArea.Column-1};e=@{r=$taskArea.Row+$taskArea.Rows.Count-2;c=$taskArea.Column+$taskArea.Columns.Count-2}})}}}
  }}
  $taskCells['!merges']=$taskMerges.ToArray();$taskSheets[$taskName]=$taskCells
 }
 if(-not $taskSheets.Count){throw 'Expected tracking worksheet missing'}
 @{Sheets=$taskSheets;SheetNames=@($taskSheets.Keys);Workbook=@{WBProps=@{date1904=[bool]$taskBook.Date1904}}} | ConvertTo-Json -Depth 10 -Compress | Set-Content -LiteralPath $OutputFile -Encoding UTF8
} finally {
 if($taskBook){$taskBook.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskBook)}
 if($taskExcel){$taskExcel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskExcel)}
}
