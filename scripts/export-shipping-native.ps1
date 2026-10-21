param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
$taskRecipe=Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskExcel=$null;$taskBooks=New-Object 'System.Collections.Generic.List[object]';$taskOutput=$null
function Set-TaskCell($sheet,$address,$value){
 $original=$sheet.Range($address);$cell=$original.MergeArea.Cells.Item(1,1);if($cell.Address() -ne $original.Address()){return}
 if($null -eq $value){[void]$cell.MergeArea.ClearContents()}elseif($value -is [ValueType]){$cell.Value2=[double]$value}else{$text=[string]$value;if($text -match '^[=+@-]|^[0-9]+$'){$text="'"+$text};$cell.Value2=$text}
}
try{
 $taskExcel=New-Object -ComObject Excel.Application;$taskExcel.Visible=$false;$taskExcel.DisplayAlerts=$false;$taskExcel.ScreenUpdating=$false;$taskExcel.EnableEvents=$false;$taskExcel.AskToUpdateLinks=$false
 foreach($taskFile in $taskRecipe.sources){$taskBooks.Add($taskExcel.Workbooks.Open([string]$taskFile,0,$true))}
 $taskExcel.Calculation=-4135
 $taskBooks[0].SaveCopyAs($OutputFile);$taskOutput=$taskExcel.Workbooks.Open($OutputFile,0,$false)
 for($i=1;$i -lt $taskBooks.Count;$i++){foreach($sheet in $taskBooks[$i].Worksheets){[void]$sheet.Copy([Type]::Missing,$taskOutput.Worksheets.Item($taskOutput.Worksheets.Count))}}
 foreach($taskSpec in $taskRecipe.sheets){
  $sheet=$taskOutput.Worksheets.Item([string]$taskSpec.name)
  if($sheet.ProtectContents){throw '原表受保護，未更動保護設定。'}
  if($taskSpec.body){
   $body=$taskSpec.body;$start=[int]$body.start;$finish=[int]$body.end;$last=$start+@($body.rows).Count-1
   $source=$null;foreach($book in $taskBooks){foreach($candidate in $book.Worksheets){if($candidate.Name -eq $sheet.Name){$source=$candidate;break}};if($source){break}}
   foreach($insert in $taskSpec.insertColumns){foreach($targetSheet in @($source,$sheet)){[void]$targetSheet.Range($targetSheet.Cells.Item(1,[int]$insert.at),$targetSheet.Cells.Item(1,([int]$insert.at+[int]$insert.count-1))).EntireColumn.Insert()}}
   if($taskRecipe.template -like 'cisalfa-*'){$finish=$source.UsedRange.Row+$source.UsedRange.Rows.Count-1}
   $sheet.Rows.Item("${start}:${finish}").UnMerge() | Out-Null
   $sheet.Rows.Item("${start}:${finish}").ClearContents() | Out-Null
   if($last -gt $finish){$sheet.Rows.Item("$($finish+1):$last").Insert() | Out-Null}
   $offset=0
   if($taskRecipe.template -in @('factory-packing','shipment-tracking') -and $last -ge $start){
    if($taskRecipe.template -eq 'shipment-tracking'){[void]$source.Range('A8:P11').UnMerge();$sheet.Rows.Item("${start}:${last}").RowHeight=$source.Rows.Item(8).RowHeight}
    $lastColumn=if($taskRecipe.template -eq 'factory-packing'){'U'}else{'P'};$prototype=if($taskRecipe.template -eq 'factory-packing'){7}else{8};[void]$source.Range("A${prototype}:${lastColumn}${prototype}").Copy($sheet.Range("A${start}:${lastColumn}${last}"))
    $matrix=New-Object 'object[,]' @(@($body.rows).Count,[int]$body.columns)
    for($r=0;$r -lt @($body.rows).Count;$r++){for($c=0;$c -lt [int]$body.columns;$c++){$v=$body.rows[$r].values[$c];if($null -ne $v){if($v -is [ValueType]){$matrix[$r,$c]=[double]$v}else{$text=[string]$v;if($text -match '^[=+@-]|^[0-9]+$'){$text="'"+$text};$matrix[$r,$c]=$text}}}}
    $sheet.Range("A${start}:${lastColumn}${last}").Value2=$matrix
   }else{
   foreach($record in $body.rows){$target=$start+$offset;[void]$source.Rows.Item([int]$record.source).Copy($sheet.Rows.Item($target));$sheet.Range($sheet.Cells.Item($target,1),$sheet.Cells.Item($target,[int]$body.columns)).ClearContents() | Out-Null;for($c=0;$c -lt $record.values.Count;$c++){Set-TaskCell $sheet ($sheet.Cells.Item($target,$c+1).Address()) $record.values[$c]};$offset++}
   }
   if($last -lt $finish){$sheet.Rows.Item("$($last+1):$finish").Delete() | Out-Null}
  }
  foreach($patch in $taskSpec.patches){Set-TaskCell $sheet ([string]$patch[0]) $patch[1]}
  if($taskRecipe.template -eq 'factory-packing'){
   foreach($column in @('J','K','L','R','S','T','U')){
    $fm=New-Object 'object[,]' @(@($body.rows).Count,1)
    foreach($formula in $taskSpec.formulas){if([string]$formula[0] -match "^$column([0-9]+)$"){$rowNumber=[int]$Matches[1];$fm[($rowNumber-$start),0]=[string]$formula[1]}}
    $sheet.Range("${column}${start}:${column}${last}").Formula=$fm
   }
  }else{
  foreach($formula in $taskSpec.formulas){try{$formulaCell=$sheet.Range([string]$formula[0]);if($formulaCell.NumberFormat -eq '@'){$formulaCell.NumberFormat='0'};$formulaCell.Formula=[string]$formula[1]}catch{throw ('Formula '+$sheet.Name+'!'+$formula[0]+': '+$_.Exception.Message)}}
  }
 }
 $taskExcel.CalculateFull();$taskOutput.Save();Write-Output 'Shipping original workbook exported with native Excel.'
}catch{throw ($_.Exception.Message+' '+$_.ScriptStackTrace)}finally{
 if($taskOutput){$taskOutput.Close($false)}
 foreach($book in $taskBooks){$book.Close($false)}
 if($taskExcel){$taskExcel.Quit()}
}
