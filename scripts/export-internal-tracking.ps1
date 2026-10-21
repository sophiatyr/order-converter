param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskTemplate=Join-Path $taskRoot 'CSQ參考資料/訂單追蹤/訂單進度.xlsx'
$taskPayload=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskRows=@($taskPayload.rows)
if(-not $taskRows.Count -or $taskRows.Count -gt 3000){throw '內部原表明細數不符。'}
foreach($taskRow in $taskRows){if($taskRow.values.Count -ne 46){throw '內部原表欄位數不符。'}}
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$taskStream=New-Object IO.FileStream($taskTemplate,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite)
$taskZip=New-Object IO.Compression.ZipArchive($taskStream,[IO.Compression.ZipArchiveMode]::Read,$false)
try{$taskReader=New-Object IO.StreamReader($taskZip.GetEntry('xl/worksheets/sheet1.xml').Open());try{[xml]$taskXml=$taskReader.ReadToEnd()}finally{$taskReader.Dispose()}}finally{$taskZip.Dispose()}
$taskOriginalMerges=@($taskXml.SelectNodes('//*[local-name()="mergeCell"]') | ForEach-Object {$_.ref})
$taskFormulaAddresses=@($taskXml.SelectNodes('//*[local-name()="c"][*[local-name()="f"]]') | ForEach-Object {$_.r})
$taskExcel=$null;$taskSource=$null;$taskBook=$null
function Get-TaskKey($sc,$po,$sku){return "$sc`n$po`n$sku"}
function Merge-TaskRange($sheet,$col,$first,$last){if($last -gt $first){[void]$sheet.Range("${col}${first}:${col}${last}").Merge()}}
try{
 $taskExcel=New-Object -ComObject Excel.Application
 $taskExcel.Visible=$false;$taskExcel.DisplayAlerts=$false;$taskExcel.AskToUpdateLinks=$false;$taskExcel.ScreenUpdating=$false;$taskExcel.EnableEvents=$false
 $taskSource=$taskExcel.Workbooks.Open($taskTemplate,0,$true)
 $taskExcel.Calculation=-4135
 $taskSheet=$taskSource.Worksheets.Item('CSQ')
 if($taskSheet.Range('A2').Text -ne 'P/I NO.' -or $taskSheet.Range('B2').Text -ne 'S/C NO.'){throw '內部原表版本與欄位不符。'}
 if($taskSheet.ProtectContents){throw '內部原表受保護，未更動保護設定。'}
 $taskLast=$taskSheet.UsedRange.Row+$taskSheet.UsedRange.Rows.Count-1
 $taskSourceValues=$taskSheet.Range("A1:AT$taskLast").Value2
 $taskSourceByKey=@{};$taskSourcePo=@{};$taskSourceFormula=@{}
 for($taskR=5;$taskR -le $taskLast;$taskR++){
  $taskSC=[string]$taskSourceValues[$taskR,1];$taskPO=[string]$taskSourceValues[$taskR,2];$taskSKU=[string]$taskSourceValues[$taskR,15]
  if(-not $taskSC -or -not $taskPO -or -not $taskSKU){continue}
  $taskKey=Get-TaskKey $taskSC $taskPO $taskSKU
  if(-not $taskSourceByKey.ContainsKey($taskKey)){$taskSourceByKey[$taskKey]=@()}
  $taskSourceByKey[$taskKey]+=$taskR
  $taskPoKey=Get-TaskKey $taskSC $taskPO ''
  if(-not $taskSourcePo.ContainsKey($taskPoKey)){$taskSourcePo[$taskPoKey]=@()}
  $taskSourcePo[$taskPoKey]+=$taskR
 }
 foreach($taskAddress in $taskFormulaAddresses){$taskCell=$taskSheet.Range($taskAddress);$taskSourceFormula[$taskAddress]=[string]$taskCell.FormulaR1C1}
 $taskMappings=New-Object 'System.Collections.Generic.List[object]'
 $taskGroups=New-Object 'System.Collections.Generic.List[object]'
 $taskMap=@{}
 # Group-Object sorts by its keys; restore the shared preview/payload PO order.
 $taskOrderRanks=@{}
 for($taskIndex=0;$taskIndex -lt $taskRows.Count;$taskIndex++){$taskRecord=$taskRows[$taskIndex];$taskPoKey=Get-TaskKey $taskRecord.sc $taskRecord.po '';if(-not $taskOrderRanks.ContainsKey($taskPoKey)){$taskOrderRanks[$taskPoKey]=$taskIndex}}
 foreach($taskGroup in ($taskRows | Group-Object -Property sc,po | Sort-Object {$taskOrderRanks[(Get-TaskKey $_.Group[0].sc $_.Group[0].po '')]})){
  $taskEntries=@();$taskPoKey=Get-TaskKey $taskGroup.Group[0].sc $taskGroup.Group[0].po ''
  foreach($taskRecord in $taskGroup.Group){
   $taskMatches=@();foreach($taskAlias in $taskRecord.aliases){$taskKey=Get-TaskKey $taskRecord.sc $taskRecord.po $taskAlias;if($taskSourceByKey.ContainsKey($taskKey)){$taskMatches+=@($taskSourceByKey[$taskKey])}}
   $taskMatches=@($taskMatches | Select-Object -Unique)
   if($taskMatches.Count -gt 1){$taskMatches=@($taskMatches | Where-Object {[string]$taskSourceValues[$_,10] -eq $taskRecord.factory})}
   if($taskMatches.Count -gt 1){throw '原表有重複款號，須先核對工廠。'}
   $taskOriginal=$taskMatches.Count -eq 1
   $taskFrom=if($taskOriginal){[int]$taskMatches[0]}else{5}
   if(-not $taskOriginal){
    for($taskProto=5;$taskProto -le $taskLast;$taskProto++){if([string]$taskSourceValues[$taskProto,10] -eq $taskRecord.factory -and $null -ne $taskSourceValues[$taskProto,8] -and $null -ne $taskSourceValues[$taskProto,12]){$taskFrom=$taskProto;break}}
   }
   $taskEntries+= [pscustomobject]@{Record=$taskRecord;From=$taskFrom;Original=$taskOriginal;Sort=if($taskOriginal){$taskFrom}else{100000+$taskEntries.Count}}
  }
  $taskEntries=@($taskEntries | Sort-Object Sort)
  $taskFirst=5+$taskMappings.Count
  $taskComplete=$taskSourcePo.ContainsKey($taskPoKey) -and @($taskSourcePo[$taskPoKey]).Count -eq $taskEntries.Count -and @($taskEntries | Where-Object {-not $_.Original}).Count -eq 0
  foreach($taskEntry in $taskEntries){$taskTo=5+$taskMappings.Count;$taskMappings.Add([pscustomobject]@{Record=$taskEntry.Record;From=$taskEntry.From;To=$taskTo;Original=$taskEntry.Original;Complete=$taskComplete});if($taskEntry.Original){$taskMap[$taskEntry.From]=$taskTo}}
  $taskGroups.Add([pscustomobject]@{First=$taskFirst;Last=4+$taskMappings.Count;Complete=$taskComplete;Entries=$taskEntries})
 }
 # All edits occur on disposable in-memory copies; the supplied template is never saved.
 $taskSheet.Range("A5:AT$taskLast").UnMerge()
 $taskSource.SaveCopyAs($OutputFile)
 $taskBook=$taskExcel.Workbooks.Open($OutputFile,0,$false)
 $taskOutput=$taskBook.Worksheets.Item('CSQ')
 $taskOutput.Range("A5:AT$taskLast").UnMerge();$taskOutput.Range("A5:AT$taskLast").ClearContents()
 for($taskIndex=0;$taskIndex -lt $taskMappings.Count;){
  $taskStartMap=$taskMappings[$taskIndex];$taskStop=$taskIndex
  while($taskStop+1 -lt $taskMappings.Count -and $taskMappings[$taskStop+1].From -eq $taskMappings[$taskStop].From+1){$taskStop++}
  $taskStopMap=$taskMappings[$taskStop]
  [void]$taskSheet.Rows.Item("$($taskStartMap.From):$($taskStopMap.From)").Copy($taskOutput.Rows.Item("$($taskStartMap.To):$($taskStopMap.To)"))
  $taskIndex=$taskStop+1
 }
 $taskValues=New-Object 'object[,]' $taskMappings.Count,46
 for($taskR=0;$taskR -lt $taskMappings.Count;$taskR++){for($taskC=0;$taskC -lt 46;$taskC++){
  $taskValue=$taskMappings[$taskR].Record.values[$taskC]
  if($null -eq $taskValue){$taskValue=''}elseif($taskValue -is [ValueType]){$taskValue=[double]$taskValue}elseif($taskValue -is [string] -and $taskValue -match '^[=+@-]'){$taskValue="'"+$taskValue}
  $taskValues[$taskR,$taskC]=$taskValue
 }}
 $taskEnd=4+$taskMappings.Count
 $taskOutput.Range("A5:AT$taskEnd").Value2=$taskValues
 foreach($taskMapping in $taskMappings){
  foreach($taskCol in @('M','N','V')){
   $taskAddress="$taskCol$($taskMapping.From)"
   if($taskSourceFormula.ContainsKey($taskAddress) -and ($taskMapping.Complete -or $taskCol -eq 'V')){$taskOutput.Range("$taskCol$($taskMapping.To)").FormulaR1C1=$taskSourceFormula[$taskAddress]}
  }
  if(-not $taskMapping.Complete){$taskOutput.Range("V$($taskMapping.To)").Formula="=IF(ISNUMBER(U$($taskMapping.To)),U$($taskMapping.To)-TODAY(),`"`" )"}
 }
 foreach($taskMerge in $taskOriginalMerges){
  if($taskMerge -match '^([A-Z]+)(\d+):([A-Z]+)(\d+)$'){
   $taskCol=$Matches[1];$taskStart=[int]$Matches[2];$taskFinish=[int]$Matches[4]
   if($taskStart -lt 5){continue}
   if($taskMap.ContainsKey($taskStart) -and $taskMap.ContainsKey($taskFinish)){
    $taskToStart=$taskMap[$taskStart];$taskToEnd=$taskMap[$taskFinish]
    $taskOwner=@($taskGroups | Where-Object {$_.Complete -and $_.First -le $taskToStart -and $_.Last -ge $taskToEnd})
    if($taskOwner.Count -and $taskCol -eq $Matches[3]){Merge-TaskRange $taskOutput $taskCol $taskToStart $taskToEnd}
   }
  }
 }
 # New/changed PO groups extend the original row styles and the same live calculations.
 foreach($taskGroup in @($taskGroups | Where-Object {-not $_.Complete})){
  $taskFirst=$taskGroup.First;$taskLastGroup=$taskGroup.Last
  foreach($taskCol in @('H','I','N')){Merge-TaskRange $taskOutput $taskCol $taskFirst $taskLastGroup}
  $taskCostRefs=New-Object 'System.Collections.Generic.List[string]'
  $taskOffset=$taskFirst
  while($taskOffset -le $taskLastGroup){
   $taskRecord=$taskMappings[$taskOffset-5].Record;$taskLastCost=$taskOffset
   while($taskLastCost -lt $taskLastGroup -and $taskMappings[$taskLastCost-4].Record.scopes.L -eq $taskRecord.scopes.L){$taskLastCost++}
   foreach($taskCol in @('L','M')){Merge-TaskRange $taskOutput $taskCol $taskOffset $taskLastCost}
   if($taskRecord.currency -eq 'RMB'){
    if($null -ne $taskRecord.rate -and $taskRecord.rate -gt 0){$taskRate=([double]$taskRecord.rate).ToString('R',[Globalization.CultureInfo]::InvariantCulture);$taskOutput.Range("M$taskOffset").Formula="=L$taskOffset/$taskRate"}else{$taskOutput.Range("M$taskOffset").MergeArea.ClearContents()}
    $taskCostRefs.Add("M$taskOffset")
   }else{$taskOutput.Range("M$taskOffset").MergeArea.ClearContents();$taskCostRefs.Add("L$taskOffset")}
   $taskOffset=$taskLastCost+1
  }
  $taskCostExpression=$taskCostRefs -join ',';$taskCostCount=$taskCostRefs.Count
  $taskOutput.Range("N$taskFirst").Formula="=IF(AND(ISNUMBER(H$taskFirst),H$taskFirst<>0,COUNT($taskCostExpression)=$taskCostCount),(H$taskFirst-SUM($taskCostExpression))/H$taskFirst,`"`" )"
 }
 if($taskLast -gt $taskEnd){$taskOutput.Rows.Item("$($taskEnd+1):$taskLast").Delete()}
 if($taskOutput.FilterMode){$taskOutput.ShowAllData()}
 if($taskOutput.AutoFilterMode){$taskOutput.AutoFilterMode=$false}
 $taskOutput.Range("A4:AT$taskEnd").AutoFilter() | Out-Null
 $taskExcel.CalculateFull()
 $taskBook.Save()
 Write-Output "Internal template exported: $($taskMappings.Count) rows; original sheets, headers, fonts, widths, row styles and live formulas retained."
}catch{throw ($_.Exception.Message+" at "+$_.ScriptStackTrace)}finally{ if($taskBook){$taskBook.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskBook)}
 if($taskSource){$taskSource.Close($false);[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskSource)}
 if($taskExcel){$taskExcel.Quit();[void][Runtime.InteropServices.Marshal]::ReleaseComObject($taskExcel)}
}
